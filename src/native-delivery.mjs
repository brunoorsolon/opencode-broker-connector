import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { provenance } from '../vendor/broker/reference/runtime.mjs';

// Same sortable timestamp layout as OpenCode 1.19.4 Identifier.ascending.
// Random UUID-derived message IDs break native chronological ordering.
let last = 0n;
function nativeID(prefix) {
  const clock = BigInt(Date.now()) * 4096n;
  last = clock > last ? clock + 1n : last + 1n;
  return `${prefix}_${(last & 0xffffffffffffn).toString(16).padStart(12, '0')}${randomBytes(7).toString('hex')}`;
}

export function nativeSelection(info) {
    const bounded = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value);
    if (!bounded(info?.agent) || !bounded(info?.model?.providerID) || !bounded(info?.model?.id)
      || info.model.variant !== undefined && !bounded(info.model.variant)) return null;
    return { agent: info.agent, model: { providerID: info.model.providerID, modelID: info.model.id }, variant: info.model.variant ?? 'default' };
  }

/** Native SDK submission, NOT the generic exclusive-input-lease scheduler.
 * OpenCode serializes model runners, not all input writers. Never retry an
 * ambiguous submit. Exact message readback proves persistence, not model read.
 */
export function createNativeDelivery({ native, sessionID, inbox, signal, verify,
  interval = 250, receiptWait = 2000, onDiagnostic = () => {}, selectionSnapshot = null, onSelectionChange = () => {} }) {
  let stopped = false, running, timer, paused = false, generation = 0;
  inbox.transaction(() => inbox.db.exec(`CREATE TABLE IF NOT EXISTS native_submissions (
    broker_message_id TEXT PRIMARY KEY REFERENCES inbox(message_id) ON DELETE CASCADE,
    session_id TEXT NOT NULL, message_id TEXT NOT NULL, part_id TEXT NOT NULL, injection_id TEXT NOT NULL,
    agent TEXT NOT NULL, provider_id TEXT NOT NULL, model_id TEXT NOT NULL, variant TEXT NOT NULL
  )`));
  const ownMessages = new Set();
  const active = () => !stopped && !signal.aborted;
  const diagnostic = code => { try { onDiagnostic({ code }); } catch {} };
  async function call(method, options) {
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(2000)]);
    let listener;
    try {
      return await Promise.race([
        Promise.resolve().then(() => method({ ...options, signal: bounded })),
        new Promise((_, reject) => {
          listener = () => reject(new Error('native_request_incomplete'));
          if (bounded.aborted) listener(); else bounded.addEventListener('abort', listener, { once: true });
        }),
      ]);
    } finally { bounded.removeEventListener('abort', listener); }
  }
  async function safe() {
    if (!active() || paused) return false;
    const info = await verify();
    if (!info || info.id !== sessionID || info.revert || info.time?.archived || !nativeSelection(info)) return false;
    if (!selectionSnapshot || JSON.stringify(nativeSelection(info)) !== JSON.stringify(selectionSnapshot)) {
      paused = true; onSelectionChange(); diagnostic('native_selection_changed'); return false;
    }
    const status = await call(options => native.client.session.status(options), {});
    return active() && !paused && !status?.error && status?.data
      && (!status.data[sessionID] || status.data[sessionID].type === 'idle') ? nativeSelection(info) : null;
  }
  async function reconcile(head, expectedEpoch = generation) {
    const target = inbox.db.prepare('SELECT * FROM native_submissions WHERE broker_message_id=?').get(head.message_id);
    if (!target || target.session_id !== sessionID || target.injection_id !== head.injection_id
      || !/^msg_[0-9a-f]{26}$/.test(target.message_id) || !/^prt_[0-9a-f]{26}$/.test(target.part_id)) return false;
    const current = await verify();
    if (!active() || expectedEpoch !== generation || !current || current.id !== sessionID || current.revert || current.time?.archived) return false;
    const observed = await call(options => native.client.session.message(options), { path: { id: sessionID, messageID: target.message_id } });
    const info = observed?.data?.info, part = observed?.data?.parts?.find(p => p.id === target.part_id);
    if (observed?.error || info?.id !== target.message_id || info.sessionID !== sessionID || info.role !== 'user'
      || info.agent !== target.agent || info.model?.providerID !== target.provider_id || info.model?.modelID !== target.model_id
      || (info.model?.variant ?? 'default') !== target.variant
      || part?.sessionID !== sessionID || part.messageID !== target.message_id || part.type !== 'text'
      || part.synthetic !== true || part.text !== provenance(head.envelope) || part.metadata?.origin !== 'broker_agent'
      || part.metadata?.authority !== 'untrusted_agent_input' || part.metadata?.broker_message_id !== head.message_id) return false;
    const after = await verify();
    if (!active() || expectedEpoch !== generation || !after || after.id !== sessionID || after.revert || after.time?.archived) return false;
    inbox.recordNativeAcceptance(head.message_id, target.injection_id, {
      accepted: true, receipt_id: `${sessionID}/${target.message_id}/${target.part_id}`,
    });
    return true;
  }
  async function deliver() {
    const head = inbox.head();
    if (!head) return;
    if (head.state !== 'pending') {
      // Read-only reconciliation: a lost submit response must never cause a
      // second model turn. Missing proof leaves the exact FIFO head blocked.
      if (['injecting', 'uncertain'].includes(head.state) && await reconcile(head)) diagnostic('native_persistence_reconciled');
      return;
    }
    const selected = await safe();
    if (!selected) return;
    const epoch = generation;
    const messageID = nativeID('msg'), partID = nativeID('prt');
    const text = provenance(head.envelope);
    const injectionID = inbox.beginInjection(head.message_id);
    // Journal proof target BEFORE the externally visible side effect.
    inbox.transaction(() => inbox.db.prepare(`INSERT INTO native_submissions VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(broker_message_id) DO UPDATE SET session_id=excluded.session_id,
      message_id=excluded.message_id,part_id=excluded.part_id,injection_id=excluded.injection_id,
      agent=excluded.agent,provider_id=excluded.provider_id,model_id=excluded.model_id,variant=excluded.variant`)
      .run(head.message_id, sessionID, messageID, partID, injectionID, selected.agent, selected.model.providerID, selected.model.modelID, selected.variant));
    ownMessages.add(messageID);
    try {
      if (!active() || epoch !== generation || JSON.stringify(await safe()) !== JSON.stringify(selected)) {
        // No host request has been issued: this is definitive non-acceptance,
        // unlike any error/timeout after promptAsync begins.
        inbox.recordNativeRejection(head.message_id, injectionID, { definitelyNotAccepted: true });
        return;
      }
      paused = true; // Only a genuine native idle event reopens the next FIFO turn.
      const submitted = await call(options => native.client.session.promptAsync(options), { path: { id: sessionID }, body: {
        // Explicit host selection only; an omitted agent would choose OpenCode's default.
        ...selected, messageID, parts: [{ id: partID, type: 'text', synthetic: true, text,
          metadata: { origin: 'broker_agent', authority: 'untrusted_agent_input', broker_message_id: head.message_id } }],
      } });
      if (submitted?.error) { diagnostic('native_submission_uncertain'); return; }
      const deadline = Date.now() + receiptWait;
      do {
        if (!active() || epoch !== generation) return;
        if (await reconcile({ ...head, injection_id: injectionID }, epoch)) {
          diagnostic('native_persistence_confirmed');
          return;
        }
        await delay(25, undefined, { signal }).catch(() => {});
      } while (active() && Date.now() < deadline);
      diagnostic('native_submission_uncertain');
    } finally { ownMessages.delete(messageID); }
  }
  function tick() {
    if (!active() || running) return running;
    running = Promise.resolve().then(deliver).catch(() => diagnostic('native_delivery_paused'))
      .finally(() => { running = null; });
    return running;
  }
  return {
    start() { if (!timer && active()) { timer = setInterval(tick, interval); timer.unref?.(); } },
    tick,
    chat(input) { if (!ownMessages.has(input.messageID)) paused = true; },
    event(event) {
      const id = event.properties?.sessionID ?? event.properties?.info?.id;
      if (id !== sessionID) return;
      if (event.type === 'session.updated' && JSON.stringify(nativeSelection(event.properties?.info)) !== JSON.stringify(selectionSnapshot)) {
        generation++; paused = true; onSelectionChange();
      }
      if (event.type === 'session.idle' || event.type === 'session.status' && event.properties?.status?.type === 'idle') paused = false;
      if (event.type === 'session.compacted' || event.type === 'message.removed' || event.type === 'session.deleted'
        || event.type === 'session.updated' && event.properties?.info?.revert) { generation++; paused = true; }
    },
    async stop() { stopped = true; clearInterval(timer); await running; },
  };
}

import { ACK_DEFINITION } from './tool-catalog.mjs';
import { mkdtempSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createOpenCodeAdapter, nativeShape } from './opencode-adapter.mjs';
import { privateDirectory } from './config.mjs';

const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,256}$/.test(value);
/** Native, session-keyed cooperative tools. Does not attach to or control a TUI. */
export async function createNativePlugin({ native, tool, reference, config, clientFactory,
  adapterFactory = createOpenCodeAdapter }) {
  const directory = realpathSync(native.directory), worktree = realpathSync(native.worktree);
  const runDirectory = mkdtempSync(join(privateDirectory(config.stateDirectory), 'opencode-'));
  const sessions = new Map();
  let disposed = false;
  async function sessionInfo(id, signal) {
    if (!validId(id)) throw new reference.LocalError('session_mismatch');
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(2000)]);
    let listener;
    const result = await Promise.race([
      Promise.resolve().then(() => native.client.session.get({ path: { id } }, { signal: bounded })),
      new Promise((_, reject) => {
        listener = () => reject(new reference.LocalError('session_mismatch'));
        if (bounded.aborted) listener(); else bounded.addEventListener('abort', listener, { once: true });
      }),
    ]).finally(() => bounded.removeEventListener('abort', listener));
    if (disposed || bounded.aborted || result?.error || result?.data?.id !== id
      || realpathSync(result.data.directory) !== directory) throw new reference.LocalError('session_mismatch');
    return result.data;
  }
  async function close(id) {
    const state = sessions.get(id);
    if (!state) return;
    state.controller.abort();
    if (state.closing) return state.closing;
    state.closing = (async () => {
      await state.starting?.catch(() => {});
      await state.adapter?.stop();
      if (sessions.get(id) === state) sessions.delete(id);
    })();
    return state.closing;
  }
  async function getSession(id) {
    if (disposed || !validId(id)) throw new reference.LocalError('session_mismatch');
    let state = sessions.get(id);
    if (state?.closing) { await state.closing; state = undefined; }
    if (state) { await state.starting; return state; }
    if (sessions.size >= 64) throw new reference.LocalError('owner_conflict');
    state = { controller: new AbortController(), lifetime: Symbol('opencode plugin session'), adapter: null };
    sessions.set(id, state);
    state.starting = (async () => {
      await sessionInfo(id, state.controller.signal);
      if (state.controller.signal.aborted) throw new reference.LocalError('session_mismatch');
      const identity = reference.newSessionIdentity('opencode');
      const inbox = new reference.Inbox({ directory: join(runDirectory, createHash('sha256').update(id).digest('hex') + '-' + identity.session_instance_id), identity });
      const binding = { sessionID: id, directory, worktree, lifetime: state.lifetime, signal: state.controller.signal };
      const currentBinding = async () => {
        if (disposed || state.controller.signal.aborted || sessions.get(id) !== state) return null;
        try { await sessionInfo(id, state.controller.signal); } catch { return null; }
        return !disposed && !state.controller.signal.aborted && sessions.get(id) === state ? binding : null;
      };
      try {
        const client = clientFactory ? clientFactory(inbox) : new reference.BrokerClient({ ...config.broker, inbox });
        state.adapter = adapterFactory({ reference, tool, client, binding, currentBinding, cooperativeAck: true });
        await state.adapter.start({ name: config.name ?? 'OpenCode', model: { provider: null, id: null, source: 'unknown' }, project: null });
        if (!await currentBinding()) throw new reference.LocalError('session_mismatch');
      } catch (error) { if (state.adapter) await state.adapter.stop(); else inbox.close(); throw error; }
      return state;
    })();
    try { return await state.starting; }
    catch (error) { if (sessions.get(id) === state) sessions.delete(id); throw error; }
  }
  const catalog = [...reference.TOOL_DEFINITIONS, ACK_DEFINITION];
  const proxies = Object.fromEntries(catalog.map(definition => [definition.name, tool({
    description: definition.description,
    args: nativeShape(tool.schema, definition.inputSchema),
    async execute(args, context) {
      try {
        if (!context || !validId(context.messageID) || !(context.abort instanceof AbortSignal)
          || context.abort.aborted || realpathSync(context.directory) !== directory || realpathSync(context.worktree) !== worktree) throw new reference.LocalError('session_mismatch');
        const state = await getSession(context.sessionID);
        return await state.adapter.tools[definition.name].execute(args, context);
      } catch (error) { return JSON.stringify(reference.safeError(error)); }
    },
  })]));
  async function dispose() {
    if (disposed) return;
    disposed = true;
    await Promise.all([...sessions.keys()].map(close));
  }
  return {
    tool: proxies,
    async event({ event }) {
      if (event.type === 'session.deleted') await close(event.properties?.info?.id);
      if (event.type === 'server.instance.disposed') await dispose();
    },
    async 'chat.message'(input, output) {
      if (output?.message?.role === 'user' && output.message.sessionID === input.sessionID) {
        // A missing broker must never prevent the user's ordinary chat.
        void getSession(input.sessionID).catch(() => {}); // Non-blocking warm-up; tools await their own binding.
      }
    },
    dispose,
  };
}

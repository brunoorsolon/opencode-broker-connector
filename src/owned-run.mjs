import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, lstatSync, realpathSync, unlinkSync, openSync, closeSync, fstatSync, constants, renameSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { loadBrokerReference } from './reference.mjs';
import { createOpenCodeAdapter, nativeShape } from './opencode-adapter.mjs';

export const OWNED_VERSION = '1.19.4';
export const LINUX_X64_SHA256 = '538fcb1b6408c8d4608822acee19f7ff5b3a3eb3383c0633c4f06170857312a7';
const fail = () => { throw new Error('owned_run_configuration_invalid'); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
function privateJSON(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.mode & 0o077 || stat.size > 32768
      || process.getuid && stat.uid !== process.getuid()) fail();
    const text = readFileSync(fd, 'utf8');
    if (Buffer.byteLength(text) > 32768) fail();
    const value = JSON.parse(text);
    if (!plain(value)) fail();
    return value;
  } finally { closeSync(fd); }
}
export function processIncarnation(pid = process.pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) fail();
  const text = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
  if (!/^[0-9]+$/.test(fields[19]) || fields[0] === 'Z') fail();
  return { pid, starttime: fields[19], bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() };
}
function sameProcess(expected) {
  if (!plain(expected)) return false;
  try { const actual = processIncarnation(expected.pid); return actual.starttime === expected.starttime && actual.bootId === expected.bootId; }
  catch { return false; }
}
export function ownedArguments(prompt, model) {
  if (typeof prompt !== 'string' || !prompt.trim() || !prompt.isWellFormed() || Buffer.byteLength(prompt) > 65536
    || model !== undefined && (typeof model !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.:/-]{0,255}$/.test(model))) fail();
  return ['run', '--format', 'json', ...(model ? ['--model', model] : []), '--', prompt];
}
export function ownedEnvironment(env, pluginPath, recordPath, nonce) {
  let overlay = {};
  if (env.OPENCODE_CONFIG_CONTENT) {
    try { overlay = JSON.parse(env.OPENCODE_CONFIG_CONTENT); } catch { throw new Error('existing_config_content_must_be_json_preserve_it_before_launch'); }
    if (!plain(overlay) || overlay.plugin !== undefined && !Array.isArray(overlay.plugin)) fail();
  }
  return { ...env, OPENCODE_CONFIG_CONTENT: JSON.stringify({ ...overlay,
    plugin: [...(overlay.plugin ?? []), pathToFileURL(pluginPath).href] }),
    OPENCODE_REVIEW_RUN_FILE: recordPath, OPENCODE_REVIEW_RUN_NONCE: nonce };
}
function readOwnedRecord(path, nonce) {
  const value = privateJSON(path);
  if (value.version !== 1 || value.nonce !== nonce || typeof nonce !== 'string' || nonce.length !== 36
    || value.opencodeVersion !== OWNED_VERSION || !isAbsolute(value.directory) || !isAbsolute(value.referenceDirectory)
    || !isAbsolute(value.inboxDirectory) || !plain(value.identity) || value.identity.client_type !== 'opencode'
    || !plain(value.broker) || !Number.isFinite(value.createdAt)
    || value.child?.pid !== process.pid || !sameProcess(value.child) || !sameProcess(value.launcher)) fail();
  return value;
}

/** A normal native plugin, enabled ONLY by our private fresh-run launcher. */
export async function createOwnedHooks({ native, tool, recordPath, nonce,
  reference: suppliedReference, clientFactory, adapterFactory = createOpenCodeAdapter }) {
  const record = readOwnedRecord(recordPath, nonce);
  if (realpathSync(native.directory) !== record.directory) fail();
  const reference = suppliedReference ?? await loadBrokerReference(record.referenceDirectory);
  const lifetime = Symbol('owned-opencode-run');
  const controller = new AbortController();
  let rootId, seenRootId, disposed = false, adapter, bindingPromise, inbox, stopPromise;
  const stop = () => stopPromise ??= (async () => { disposed = true; controller.abort(); await bindingPromise?.catch(() => {}); await adapter?.stop(); })();
  async function sessionInfo(id) {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(2000)]);
    let onAbort;
    const result = await Promise.race([
      Promise.resolve().then(() => native.client.session.get({ path: { id } }, { signal })),
      new Promise((_, reject) => {
        onAbort = () => reject(new reference.LocalError('session_mismatch'));
        if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]).finally(() => signal.removeEventListener('abort', onAbort));
    const info = result?.data;
    if (result?.error || !info || info.id !== id || info.parentID || realpathSync(info.directory) !== record.directory
      || !Number.isFinite(info.time?.created) || info.time.created < record.createdAt) throw new reference.LocalError('session_mismatch');
    return info;
  }
  async function currentBinding() {
    if (disposed || controller.signal.aborted || !rootId) return null;
    try { readOwnedRecord(recordPath, nonce); await sessionInfo(rootId); readOwnedRecord(recordPath, nonce); if (disposed || controller.signal.aborted) return null; }
    catch { return null; }
    return { sessionID: rootId, directory: native.directory, worktree: native.worktree, lifetime, signal: controller.signal };
  }
  const proxies = Object.fromEntries(reference.TOOL_DEFINITIONS.map(definition => [definition.name, tool({
    description: definition.description, args: nativeShape(tool.schema, definition.inputSchema),
    async execute(args, context) {
      if (disposed || !adapter || context?.sessionID !== rootId) return JSON.stringify(new reference.LocalError('session_mismatch').toJSON());
      return adapter.tools[definition.name].execute(args, context);
    },
  })]));
  return {
    tool: proxies,
    async event({ event }) {
      if (event.type === 'session.created' && !event.properties?.info?.parentID) {
        const id = event.properties?.info?.id;
        if (seenRootId && seenRootId !== id) { await stop(); return; }
        seenRootId = id;
      }
      if (event.type === 'session.deleted' && event.properties?.info?.id === rootId) await stop();
    },
    async 'chat.message'(input, output) {
      if (disposed || output?.message?.role !== 'user' || output.message.sessionID !== input.sessionID
        || !seenRootId || seenRootId !== input.sessionID) throw new reference.LocalError('session_mismatch');
      if (rootId && rootId !== input.sessionID) throw new reference.LocalError('session_mismatch');
      if (bindingPromise) return bindingPromise;
      rootId = input.sessionID;
      bindingPromise = (async () => {
        await sessionInfo(rootId);
        if (disposed) throw new reference.LocalError('session_mismatch');
        inbox = new reference.Inbox({ directory: record.inboxDirectory, identity: record.identity });
        try {
          const client = clientFactory ? clientFactory(inbox) : new reference.BrokerClient({ ...record.broker, inbox });
          adapter = adapterFactory({ reference, tool, client, binding: { sessionID: rootId, directory: native.directory,
            worktree: native.worktree, lifetime, signal: controller.signal }, currentBinding });
          await adapter.start({ name: 'OpenCode owned run', model: { provider: null, id: null, source: 'unknown' }, project: null });
          if (!await currentBinding()) throw new reference.LocalError('session_mismatch');
          writeFileSync(`${recordPath}.bound`, JSON.stringify({ nonce, child: record.child, rootId }), { mode: 0o600, flag: 'wx' });
        } catch (error) { controller.abort(); if (adapter) await adapter.stop(); else inbox.close(); throw error; }
      })();
      return bindingPromise;
    },
    dispose: stop,
  };
}

/** Fixed fresh headless process only; never attach, resume, change permissions or inject a prompt into another host. */
export async function launchOwnedRun({ configPath, prompt, env = process.env, cwd = process.cwd(), spawnImpl = spawn }) {
  const config = privateJSON(configPath);
  if (Object.keys(config).some(key => !['opencodeExecutable', 'referenceDirectory', 'stateDirectory', 'broker', 'model'].includes(key))
    || !isAbsolute(config.opencodeExecutable) || !isAbsolute(config.referenceDirectory) || !isAbsolute(config.stateDirectory)
    || !plain(config.broker) || Object.keys(config.broker).some(key => !['url', 'tokenFile', 'caFile'].includes(key))
    || !isAbsolute(config.broker.tokenFile)) fail();
  const binary = realpathSync(config.opencodeExecutable);
  if (process.platform !== 'linux' || process.arch !== 'x64'
    || createHash('sha256').update(readFileSync(binary)).digest('hex') !== LINUX_X64_SHA256) throw new Error('unsupported_opencode_binary_use_verified_linux_x64_1_19_4');
  const reference = await loadBrokerReference(config.referenceDirectory);
  const args = ownedArguments(prompt, config.model);
  mkdirSync(config.stateDirectory, { recursive: true, mode: 0o700 });
  const stat = lstatSync(config.stateDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.mode & 0o077 || realpathSync(config.stateDirectory) !== config.stateDirectory || process.getuid && stat.uid !== process.getuid()) fail();
  const runDirectory = mkdtempSync(join(config.stateDirectory, 'run-'));
  const recordPath = join(runDirectory, 'owner.json'), nonce = randomUUID();
  const record = { version: 1, nonce, opencodeVersion: OWNED_VERSION, createdAt: Date.now(), directory: realpathSync(cwd),
    launcher: processIncarnation(), child: null, referenceDirectory: config.referenceDirectory, inboxDirectory: join(runDirectory, 'inbox'), identity: reference.newSessionIdentity('opencode'), broker: config.broker };
  writeFileSync(recordPath, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
  const pluginPath = new URL('../plugin/owned-run.ts', import.meta.url);
  let child;
  try {
    const childEnv = ownedEnvironment(env, fileURLToPath(pluginPath), recordPath, nonce);
    child = spawnImpl(binary, args, { cwd: record.directory, env: childEnv, stdio: ['ignore', 'inherit', 'inherit'] });
    if (child.pid) {
      record.child = processIncarnation(child.pid);
      const next = `${recordPath}.next`;
      writeFileSync(next, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
      renameSync(next, recordPath);
    }
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    if (result.code === 0) {
      let proof;
      try { proof = privateJSON(`${recordPath}.bound`); } catch { throw new Error('owned_native_broker_unavailable'); }
      if (proof.nonce !== nonce || JSON.stringify(proof.child) !== JSON.stringify(record.child)
        || typeof proof.rootId !== 'string' || !proof.rootId) throw new Error('owned_native_broker_unavailable');
    }
    return result;
  } finally {
    // Revoke the private lifetime marker. Durable inbox content is never deleted.
    try { unlinkSync(recordPath); } catch {}
    try { unlinkSync(`${recordPath}.bound`); } catch {}
    // Native dispose normally closes the lease. A killed child cannot; after exit
    // its SQLite ownership lock is released, so the same exact identity can close.
    if (child && (child.exitCode !== null || child.signalCode)) {
      let journal;
      try {
        journal = new reference.Inbox({ directory: record.inboxDirectory, identity: record.identity });
        const client = new reference.BrokerClient({ ...record.broker, inbox: journal, maxAttempts: 1, requestTimeoutMs: 5000 });
        if (client.attachment.lease_epoch) await client.closeSession({ signal: AbortSignal.timeout(5000) });
      } catch { /* No raw credential-bearing diagnostics; broker lease remains bounded. */ }
      finally { journal?.close(); }
    }
  }
}

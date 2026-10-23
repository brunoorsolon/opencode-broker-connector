import { loadBrokerReference } from '../src/reference.mjs';
import { createOpenCodeAdapter } from '../src/opencode-adapter.mjs';

/**
 * Called by a trusted native host owner, NOT by model input or a generic
 * project plugin initializer. The owner must already possess lifecycle proof.
 * Each invocation creates a NEW broker identity; it never resumes by session ID.
 */
export async function attachVerifiedSession({ referenceDirectory, tool, host,
  inboxDirectory, broker, metadata = { name: 'OpenCode',
    model: { provider: null, id: null, source: 'unknown' }, project: null } }) {
  if (!host || typeof host.currentBinding !== 'function') throw new Error('Verified native host ownership is required.');
  const reference = await loadBrokerReference(referenceDirectory);
  const inbox = new reference.Inbox({ directory: inboxDirectory, identity: reference.newSessionIdentity('opencode') });
  let adapter;
  try {
    const client = new reference.BrokerClient({ url: broker.url, tokenFile: broker.tokenFile, caFile: broker.caFile, inbox });
    adapter = createOpenCodeAdapter({ reference, tool, client, binding: host.binding,
      currentBinding: () => host.currentBinding() });
    await adapter.start(metadata);
    return { hooks: { tool: adapter.tools }, close: () => adapter.stop() };
  } catch (error) {
    if (adapter) await adapter.stop();
    else inbox.close();
    throw error;
  }
}

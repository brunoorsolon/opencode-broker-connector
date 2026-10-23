import { verifyReference } from './reference-pin.mjs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BROKER_REFERENCE_COMMIT = 'e015a6f5d7cc32d0c0a90bd633fab8d94195417a';

/** Trusted operator path to a pinned broker checkout; never a model argument. */
export async function loadBrokerReference(directory) {
  if (typeof directory !== 'string' || !isAbsolute(directory)) throw new Error('Use an absolute path to the pinned broker reference checkout.');
  verifyReference(directory);
  const load = file => import(pathToFileURL(join(directory, file)).href);
  const [inbox, client, runtime, tools, stdio, errors] = await Promise.all([
    load('reference/inbox.mjs'), load('reference/client.mjs'), load('reference/runtime.mjs'),
    load('reference/tools.mjs'), load('reference/mcp-stdio.mjs'), load('reference/errors.mjs'),
  ]);
  return { Inbox: inbox.Inbox, newSessionIdentity: inbox.newSessionIdentity,
    BrokerClient: client.BrokerClient, AdapterRuntime: runtime.AdapterRuntime,
    createTools: tools.createTools, invokeTool: tools.invokeTool,
    TOOL_DEFINITIONS: stdio.TOOL_DEFINITIONS, LocalError: errors.LocalError, safeError: errors.safeError };
}

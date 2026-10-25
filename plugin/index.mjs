import { tool } from '@opencode-ai/plugin';
import { loadBrokerReference } from '../src/reference.mjs';
import { createNativePlugin } from '../src/native-plugin.mjs';
import { createConnectionLoader, readExistingConnection } from '../src/enrollment.mjs';
export default async function PsstPlugin(native) {
  return createNativePlugin({ native, tool, reference: await loadBrokerReference(),
    connectFile: createConnectionLoader({ directory: native.directory }),
    experimentalNativeDelivery: process.env.PSST_EXPERIMENTAL_NATIVE_DELIVERY === 'fixed-session-snapshot',
    config: process.env.PSST_CONFIG_FILE ? await readExistingConnection(process.env.PSST_CONFIG_FILE) : undefined });
}

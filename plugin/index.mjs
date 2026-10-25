import { tool } from '@opencode-ai/plugin';
import { readConfig } from '../src/config.mjs';
import { loadBrokerReference } from '../src/reference.mjs';
import { createNativePlugin } from '../src/native-plugin.mjs';
export default async function PsstPlugin(native) {
  return createNativePlugin({ native, tool, reference: await loadBrokerReference(),
    config: process.env.PSST_CONFIG_FILE ? readConfig(process.env.PSST_CONFIG_FILE) : undefined });
}

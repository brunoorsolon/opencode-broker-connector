import { tool } from '@opencode-ai/plugin';
import { loadBrokerReference } from '../src/reference.mjs';
import { createNativePlugin } from '../src/native-plugin.mjs';
import { createConnectionLoader, readExistingConnection } from '../src/enrollment.mjs';
import { readInstallation } from '../src/installation.mjs';
import { startPendingResume } from '../src/pending-resume.mjs';
import { createContextReceiver } from '../src/native-context.mjs';
export default async function PsstPlugin(native) {
  const reference = await loadBrokerReference();
  const config = process.env.PSST_CONFIG_FILE ? await readExistingConnection(process.env.PSST_CONFIG_FILE) : undefined;
  const contextReceiver = createContextReceiver({ directory: native.directory });
  const resume = startPendingResume();
  try {
    return await createNativePlugin({ native, tool, reference, config, contextReceiver,
      connectFile: createConnectionLoader({ directory: native.directory }),
      loadInstallation: readInstallation, onDispose: resume.stop,
      experimentalNativeDelivery: process.env.PSST_EXPERIMENTAL_NATIVE_DELIVERY === 'fixed-session-snapshot' });
  } catch (error) { resume.stop(); contextReceiver.close(); throw error; }
}

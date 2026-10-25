import { tool } from '@opencode-ai/plugin';
import { createOwnedHooks } from '../src/owned-run.mjs';

export default async function(native) {
  return createOwnedHooks({ native, tool, recordPath: process.env.OPENCODE_REVIEW_RUN_FILE,
    nonce: process.env.OPENCODE_REVIEW_RUN_NONCE });
}

import { readFileSync, lstatSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
export const REFERENCE_COMMIT = 'e015a6f5d7cc32d0c0a90bd633fab8d94195417a';
const HASHES = Object.freeze({
  "reference/inbox.mjs": "93f75786eab29429ace024974e0f61d6ad46d2c5fe065dae387e54fd2373b167",
  "reference/client.mjs": "f661b45acba106be03d97dacba3cd90ac18b09e7ff9eb93b995d5036d9d1c785",
  "reference/runtime.mjs": "49f933d10bd5575d1888dee415dc884b83600f3508fdb2139699364b8c8b0bbf",
  "reference/tools.mjs": "5e6355cef1bec56170dca14b93142a7da8c102f411c5dbf437d84acda7351acf",
  "reference/mcp-stdio.mjs": "10a93788af426ce898c398e38dd41ac77b6e0129a7697bdc36c8d4f6d6e20138",
  "reference/errors.mjs": "e33231d94f514b5a1b59fdd4184f5881dd3712bde725a1cf53352c26293452ac",
  "src/protocol.mjs": "f3ff24b4429dddc8a9c10513ab72dbc613c91244591132458c7866a812d6316b"
});
/** Verify reviewed source bytes before importing any trusted local module. */
export function verifyReference(directory) {
  if (typeof directory !== 'string' || !isAbsolute(directory)) throw new Error('absolute_reference_required');
  for (const [file, digest] of Object.entries(HASHES)) {
    const path = join(directory, file), stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024 || createHash('sha256').update(readFileSync(path)).digest('hex') !== digest) throw new Error('reference_snapshot_mismatch');
  }
}

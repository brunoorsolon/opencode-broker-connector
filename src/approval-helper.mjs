import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const APPROVAL_SHA256 = 'a60c3a0ccd7deb50556586cd67841bb89a300ea3c7f1af3a91d437f856b7a2d5';
export async function loadApprovalHelper() {
  const path = fileURLToPath(new URL('../vendor/enrollment/approval.mjs', import.meta.url));
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536
    || createHash('sha256').update(readFileSync(path)).digest('hex') !== APPROVAL_SHA256) throw new Error('approval_snapshot_mismatch');
  return import('../vendor/enrollment/approval.mjs');
}

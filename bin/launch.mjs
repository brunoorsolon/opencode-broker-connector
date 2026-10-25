#!/usr/bin/env node
import { launchOwnedRun } from '../src/owned-run.mjs';
const [configPath, ...prompt] = process.argv.slice(2);
try {
  if (!configPath || !prompt.length) throw Error('usage');
  const result = await launchOwnedRun({ configPath, prompt: prompt.join(' ') });
  process.exitCode = result.code ?? 1;
} catch {
  process.stderr.write('Owned OpenCode run unavailable. Use a private config, the pinned Linux x64 1.19.4 binary, exact reference checkout and an explicit prompt. No permission override or automatic retry was applied.\n');
  process.exitCode = 1;
}

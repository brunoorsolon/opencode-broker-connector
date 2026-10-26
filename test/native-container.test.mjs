import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('container engine keeps runner HOME/XDG while native application gets isolated HOME', t => {
  const dir=mkdtempSync(join(tmpdir(),'psst-native-https-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const engine=join(dir,'engine'),log=join(dir,'engine.log');
  writeFileSync(engine,'#!/bin/bash\nif [[ "$1" == run ]]; then printf "%s\\n" "$HOME" "${XDG_CONFIG_HOME-unset}" "${XDG_DATA_HOME-unset}" "${XDG_RUNTIME_DIR-unset}" "$@" > "'+log+'"; fi\n',{mode:0o700});
  const result=spawnSync('bash',['scripts/native-container.sh','serve'],{encoding:'utf8',env:{
    PATH:process.env.PATH,HOME:join(dir,'home'),XDG_DATA_HOME:join(dir,'home/data'),
    PSST_CONTAINER_RUNTIME:engine,PSST_CONTAINER_IMAGE:'fixture-image',PSST_CONTAINER_REPO:process.cwd(),
    PSST_REAL_OPENCODE_BINARY:'/fixture/opencode',PSST_CONTAINER_RUNTIME_HOME:'/runner/home',
    PSST_CONTAINER_RUNTIME_XDG_RUNTIME_DIR:'/runner/runtime',PSST_CONTAINER_RUNTIME_XDG_CONFIG_HOME:'/runner/config'
  }});
  assert.equal(result.status,0,result.stderr);
  const lines=readFileSync(log,'utf8').split('\n');
  assert.deepEqual(lines.slice(0,4),['/runner/home','/runner/config','unset','/runner/runtime']);
  assert(lines.includes('HOME='+join(dir,'home')));
  assert(lines.includes('XDG_DATA_HOME='+join(dir,'home/data')));
});

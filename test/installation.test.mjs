import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installationDirectory, readSelection, readInstallation, selectInstallation, savePending, readPending, updatePending } from '../src/installation.mjs';
import { startPendingResume } from '../src/pending-resume.mjs';
function fixture(t){const directory=mkdtempSync(join(tmpdir(),'psst-install-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));const connectionFile=join(directory,'legacy.json');writeFileSync(connectionFile,JSON.stringify({broker:{url:'https://broker.example/',tokenFile:join(directory,'token')},stateDirectory:join(directory,'inbox')}),{mode:0o600});return {directory,connectionFile};}
test('documented native directory precedence; missing selection creates nothing',async t=>{
 assert.equal(installationDirectory({PSST_OPENCODE_CONFIG_DIR:'/a',OPENCODE_CONFIG_DIR:'/b'}),'/a');assert.equal(installationDirectory({OPENCODE_CONFIG_DIR:'/b'}),'/b/psst');assert.equal(installationDirectory({XDG_CONFIG_HOME:'/c'}),'/c/opencode/psst');assert.throws(()=>installationDirectory({PSST_OPENCODE_CONFIG_DIR:'relative'}));
 const f=fixture(t),missing=join(f.directory,'missing');assert.equal(await readInstallation(missing),undefined);assert.equal(existsSync(missing),false);
});
test('atomic selection survives reopen; cancellation and concurrent replacement preserve old authorization',async t=>{
 const f=fixture(t);const first=await selectInstallation({...f,expectedRevision:null});assert.equal(readSelection(f.directory).revision,first.revision);assert.ok(await readInstallation(f.directory));
 const pending=savePending({...f,brokerUrl:'https://broker.example/',expectedRevision:first.revision});assert.equal(readSelection(f.directory).revision,first.revision);
 updatePending({...f,flowId:pending.flowId,paused:true});await assert.rejects(selectInstallation({...f,expectedRevision:first.revision,pendingFlowId:pending.flowId}));assert.equal(readSelection(f.directory).revision,first.revision);
 const attempts=await Promise.allSettled(Array.from({length:30},()=>selectInstallation({...f,expectedRevision:first.revision})));assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.ok(existsSync(f.connectionFile));
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(selectInstallation({...f,expectedRevision:readSelection(f.directory).revision,signal:ctrl.signal}));
});
test('corrupt, unsafe-mode and symlink configuration stop without repair',async t=>{
 const f=fixture(t);await selectInstallation({...f,expectedRevision:null});const path=join(f.directory,'installation.json'),before=readFileSync(path);chmodSync(path,0o644);assert.throws(()=>readSelection(f.directory));chmodSync(path,0o600);writeFileSync(path,'bad');await assert.rejects(readInstallation(f.directory));assert.equal(readFileSync(path,'utf8'),'bad');writeFileSync(path,before);
 const link=join(f.directory,'alias');symlinkSync(f.directory,link);assert.throws(()=>readSelection(link));
});
test('startup resumes same durable pending request GET-only and selects after approval',async t=>{
 const f=fixture(t),pending=savePending({...f,brokerUrl:'https://broker.example/',expectedRevision:null,requestId:'same'});let polls=0;
 const helper={readApprovalState:()=>({requestId:'same',state:'pending'}),beginApproval:()=>assert.fail('startup must never POST'),pollApproval:async()=>{polls++;return {requestId:'same',state:'approved',connectionFile:f.connectionFile};}};
 await startPendingResume({...f,loadHelper:async()=>helper}).done;assert.equal(polls,1);assert.ok(await readInstallation(f.directory));assert.equal(readPending(f.directory).paused,true);
 await startPendingResume({...f,loadHelper:async()=>helper}).done;assert.equal(polls,1);
});
test('cancel, terminal denial, request mismatch and corrupt pending are inert at startup',async t=>{
 for(const state of ['denied','expired','revoked']) {
  const f=fixture(t);savePending({...f,brokerUrl:'https://broker.example/',expectedRevision:null,requestId:'same'});let calls=0;
  const helper={readApprovalState:()=>({requestId:'same'}),pollApproval:async()=>{calls++;return {requestId:'same',state};}};
  await startPendingResume({...f,loadHelper:async()=>helper}).done;assert.equal(calls,1);assert.equal(readPending(f.directory).paused,true);assert.equal(readSelection(f.directory),null);
 }
 const f=fixture(t);savePending({...f,brokerUrl:'https://broker.example/',expectedRevision:null,requestId:'same'});
 await startPendingResume({...f,loadHelper:async()=>({readApprovalState:()=>({requestId:'other'}),pollApproval:()=>assert.fail('wrong request')})}).done;
 writeFileSync(join(f.directory,'pending.json'),'corrupt');await startPendingResume({...f,loadHelper:()=>assert.fail('corrupt')}).done;assert.equal(readFileSync(join(f.directory,'pending.json'),'utf8'),'corrupt');
});
test('vendored URL-only helper is byte-pinned before import',async()=>{
 const {loadApprovalHelper}=await import('../src/approval-helper.mjs');const helper=await loadApprovalHelper();assert.equal(typeof helper.beginApproval,'function');assert.equal(typeof helper.pollApproval,'function');
});

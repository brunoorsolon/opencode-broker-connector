import { loadApprovalHelper } from './approval-helper.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { installationDirectory, readPending, updatePending, selectInstallation } from './installation.mjs';
/** GET-only continuation of an explicitly persisted request. Never creates credentials. */
export function startPendingResume({ directory = installationDirectory(), loadHelper = loadApprovalHelper,
  pause = (signal, ms = 2000) => delay(ms, undefined, { signal }), select = selectInstallation } = {}) {
 const controller = new AbortController();
 const done = (async () => {
  let pending;
  try { pending=readPending(directory); } catch { return; }
  if(!pending || pending.paused)return;
  const flowId=pending.flowId;
  const helper=await loadHelper();
  while(!controller.signal.aborted) {
   let waitMs=2000;
   try {
    pending=readPending(directory);
    if(!pending||pending.flowId!==flowId||pending.paused)return;
    const options={directory,brokerUrl:pending.brokerUrl,clientType:'opencode'};
    const saved=helper.readApprovalState(options);
    if(!saved || pending.requestId && saved.requestId!==pending.requestId)return;
    const result=await helper.pollApproval(options); // Deliberately no beginApproval anywhere in this module.
    if(controller.signal.aborted)return;
    if(result.requestId!==saved.requestId)return;
    if(result.state==='approved') {
     await select({directory,connectionFile:result.connectionFile,expectedRevision:pending.expectedRevision,pendingFlowId:flowId,signal:controller.signal});
     return;
    }
    if(result.state!=='pending') { updatePending({directory,flowId,paused:true});return; }
   } catch(error) {
    if(!error.retryable)return; // Invalid local/auth state is inert; never reset or replace it.
    waitMs=Math.min(300000,Math.max(2000,error.retryAfterMs||2000));
   }
   await pause(controller.signal,waitMs);
  }
 })().catch(()=>{});
 return {done,stop:()=>controller.abort()};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContextReceiver, startContextPublisher, contextMarker } from '../src/native-context.mjs';
function fixture(t){const root=mkdtempSync(join(tmpdir(),'psst-context-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
test('supported native route binds exact server incarnation; route change and stale owner expire',t=>{
 const directory=fixture(t),base=join(directory,'runtime');let now=10000;
 const first=createContextReceiver({directory,base,now:()=>now}),second=createContextReceiver({directory,base,now:()=>now});t.after(()=>{first.close();second.close();});
 const api={route:{current:{name:'session',params:{sessionID:'ses_one'}}},state:{path:{directory},config:{command:{'psst-status':{template:contextMarker(first.id)}}}},lifecycle:{onDispose(){}}};
 const publisher=startContextPublisher(api,{base,now:()=>now});t.after(publisher.stop);
 assert.deepEqual([...first.read()],['ses_one']);assert.equal(second.read().size,0);
 api.route.current.params.sessionID='ses_two';publisher.update();assert.deepEqual([...first.read()],['ses_two']);
 now+=6000;assert.equal(first.read().size,0);publisher.update();assert.deepEqual([...first.read()],['ses_two']);
 api.route.current={name:'home'};publisher.update();assert.equal(first.read().size,0);
});
test('two container runtime roots and same project/session identifiers cannot cross',t=>{
 const directory=fixture(t),a=join(directory,'container-a'),b=join(directory,'container-b');
 const receiver=createContextReceiver({directory,base:a});t.after(receiver.close);
 const api={route:{current:{name:'session',params:{sessionID:'same'}}},state:{path:{directory},config:{command:{'psst-status':{template:contextMarker(receiver.id)}}}},lifecycle:{onDispose(){}}};
 const wrong=startContextPublisher(api,{base:b});t.after(wrong.stop);assert.equal(receiver.read().size,0);
 const correct=startContextPublisher(api,{base:a});t.after(correct.stop);assert.deepEqual([...receiver.read()],['same']);correct.stop();assert.equal(receiver.read().size,0);
});

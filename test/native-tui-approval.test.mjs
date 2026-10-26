import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,copyFileSync,existsSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
test('actual native TUI URL form, admin approval and existing-idle session attachment without a model turn', {skip:!process.env.OPENCODE_BINARY || !process.env.PSST_APPROVAL_BROKER_DIR,timeout:45000},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'psst-tui-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const { approvalTlsFixture }=await import(pathToFileURL(join(process.env.PSST_APPROVAL_BROKER_DIR,'test','approval-tls-fixture.mjs')).href);
 const authority=await approvalTlsFixture(t);
 const home=join(dir,'home'),project=join(dir,'project'),config=join(home,'config','opencode');mkdirSync(config,{recursive:true});mkdirSync(project);
 symlinkSync(fileURLToPath(new URL('../node_modules',import.meta.url)),join(config,'node_modules'));
 copyFileSync(fileURLToPath(new URL('../package-lock.json',import.meta.url)),join(config,'package-lock.json'));
 writeFileSync(join(config,'package.json'),JSON.stringify({dependencies:{'@opencode-ai/plugin':'1.19.4'}}));
 const probe=join(dir,'tui-session-fixture.mjs');
 writeFileSync(probe,`import {writeFileSync} from 'node:fs';import plugin from ${JSON.stringify(new URL('../plugin/tui.mjs',import.meta.url).href)};export default {id:'psst-fixture',tui:async api=>{await plugin.tui(api);const created=await api.client.session.create({directory:${JSON.stringify(project)}});if(!created.data?.id)throw new Error('fixture_session_failed');api.route.navigate('session',{sessionID:created.data.id});const inspect=async()=>{const messages=await api.client.session.messages({sessionID:created.data.id});writeFileSync(${JSON.stringify(join(dir,'session.json'))},JSON.stringify({id:created.data.id,messages:messages.data?.length}));};await inspect();const timer=setInterval(()=>{void inspect();},500);api.lifecycle.onDispose(()=>clearInterval(timer));}};`);
 writeFileSync(join(config,'tui.json'),JSON.stringify({plugin:[pathToFileURL(probe).href],theme:'opencode'}));
 writeFileSync(join(project,'opencode.json'),JSON.stringify({plugin:[new URL('../plugin/index.mjs',import.meta.url).href],autoupdate:false,enabled_providers:[],permission:{bash:'deny'}}));
 const child=spawn('python3',[fileURLToPath(new URL('./tui-fixture.py',import.meta.url)),process.env.OPENCODE_BINARY],{cwd:project,env:{PATH:process.env.PATH,NODE_EXTRA_CA_CERTS:authority.certFile,HOME:home,TERM:'xterm-256color',XDG_CONFIG_HOME:join(home,'config'),XDG_DATA_HOME:join(home,'data'),XDG_CACHE_HOME:join(home,'cache'),XDG_STATE_HOME:join(home,'state'),OPENCODE_DISABLE_MODELS_FETCH:'1'},stdio:['pipe','pipe','pipe']});
 t.after(()=>{child.stdin.write(JSON.stringify({stop:true})+'\n');child.stdin.end();});
 let buffer='',output='',errors='';child.stderr.on('data',x=>errors+=x);child.stdout.on('data',x=>{buffer+=x;let end;while((end=buffer.indexOf('\n'))>=0){const row=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);output+=Buffer.from(row.output,'base64').toString();}});
 const send=text=>child.stdin.write(JSON.stringify({input:Buffer.from(text).toString('base64')})+'\n');
 const type=async text=>{for(const char of text){send(char);await delay(25);}};
 const screen=()=>output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'');
 async function waitFor(text){for(let i=0;i<200;i++){if(screen().includes(text))return;await delay(100);}assert.fail('Native TUI did not display '+text+'; '+screen().slice(-2500)+' '+errors);}
 await waitFor('1.19.4');await delay(2000);send('\x1b\x10');await waitFor('broker URL');
 await type('not-a-url');send('\r');await delay(500);
 send('\x1b\x10');await delay(300);await type(authority.brokerUrl);send('\r');
 const pending=join(config,'psst','pending.json');for(let i=0;i<100&&!existsSync(pending);i++)await delay(100);assert.ok(existsSync(pending),'native form must persist request before transport');
 assert.equal(JSON.parse(readFileSync(pending,'utf8')).brokerUrl,authority.brokerUrl+'/');
 assert.equal(existsSync(join(config,'psst','installation.json')),false,'unapproved candidate must never become active');
 const opts={brokerUrl:authority.brokerUrl,directory:join(config,'psst'),clientType:'opencode'};
 let request;
 for(let i=0;i<100;i++){request=await authority.helper('readApprovalState',opts);if(request)break;await delay(50);}
 assert.equal(request.state,'pending');await authority.decide(request.requestId);
 for(let i=0;i<150&&!existsSync(join(config,'psst','installation.json'));i++)await delay(100);
 assert.ok(existsSync(join(config,'psst','installation.json')),'native UI commits only approved private installation');
 let rows=[];
 for(let i=0;i<100;i++){rows=authority.store.db.prepare("SELECT id FROM sessions WHERE type='opencode'").all();if(rows.length)break;await delay(100);}
 assert.equal(rows.length,1,'private supported TUI context attaches the already idle native session');
 assert.ok(existsSync(join(dir,'session.json')));assert.equal(JSON.parse(readFileSync(join(dir,'session.json'),'utf8')).messages,0,'setup and idle attach never create a model turn');

});

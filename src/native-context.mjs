import { randomUUID } from 'node:crypto';
import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync, fstatSync, lstatSync, realpathSync, renameSync, readdirSync, rmSync, constants } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { privateDirectory } from './config.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validID = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,256}$/.test(value);
const marker = /\[psst-native-context:([0-9a-f-]{36})\]/;
export function runtimeRoot() { return join(tmpdir(), `psst-opencode-${process.getuid?.() ?? 'user'}`); }
export function contextMarker(id) { return `[psst-native-context:${id}]`; }
function root(path) { return privateDirectory(path); }
function read(path) {
 let fd;try {
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=fstatSync(fd);
  if(!stat.isFile() || stat.mode&0o077 || stat.size>4096 || process.getuid && stat.uid!==process.getuid()) throw new Error();
  return JSON.parse(readFileSync(fd,'utf8'));
 } finally { if(fd!==undefined)closeSync(fd); }
}
/** Random server incarnation, never a broker credential or persisted session identity. */
export function createContextReceiver({ directory, base = runtimeRoot(), now = Date.now } = {}) {
 const id=randomUUID(),path=join(root(base),id);mkdirSync(path,{mode:0o700});
 return {id,
  read(){
   const sessions=new Set();
   for(const name of readdirSync(path).slice(0,64)) {
    if(!uuid.test(name))continue;
    try { const value=read(join(path,name));
     if(value.server===id && value.directory===directory && validID(value.sessionID)
       && Number.isFinite(value.at) && value.at<=now()+1000 && value.at>=now()-5000) sessions.add(value.sessionID);
    } catch { /* Untrusted/stale local hints are inert, never repaired into authorization. */ }
   }
   return sessions;
  },
  close(){rmSync(path,{recursive:true,force:true});}
 };
}
/** Supported TUI context only. Does not submit any input or touch native history. */
export function startContextPublisher(api, { base = runtimeRoot(), interval = 1000, now = Date.now } = {}) {
 const owner=randomUUID();let lastPath;
 const clear=()=>{if(lastPath){rmSync(lastPath,{force:true});lastPath=undefined;}};
 function update(){
  try {
   const route=api.route.current,template=api.state.config?.command?.['psst-status']?.template;
   const server=typeof template==='string'?template.match(marker)?.[1]:undefined;
   if(route.name!=='session'||!validID(route.params?.sessionID)||!server||!uuid.test(server)){clear();return;}
   const path=join(root(base),server),stat=lstatSync(path);
   if(!stat.isDirectory()||stat.isSymbolicLink()||stat.mode&0o077||realpathSync(path)!==path||process.getuid&&stat.uid!==process.getuid())throw new Error();
   const next=join(path,owner);if(lastPath&&lastPath!==next)clear();
   const temp=join(path,`.${owner}`),fd=openSync(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   try{writeFileSync(fd,JSON.stringify({server,sessionID:route.params.sessionID,directory:realpathSync(api.state.path.directory),at:now()}));}finally{closeSync(fd);}
   renameSync(temp,next);lastPath=next;
  } catch { clear(); }
 }
 update();const timer=setInterval(update,interval);timer.unref?.();
 const stop=()=>{clearInterval(timer);clear();};api.lifecycle.onDispose(stop);
 return {update,stop};
}

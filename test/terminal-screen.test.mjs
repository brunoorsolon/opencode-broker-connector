import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TerminalScreen } from './terminal-screen.mjs';
test('captured official TUI differential frames preserve unchanged request-label cells',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/native-approval-delta.json',import.meta.url),'utf8'));
 const stream=fixture.frames.join('');
 const flattened=stream.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
 assert(!flattened.includes('Request ID: '+fixture.requestId),'old ANSI-stripping observer loses unchanged cells');
 for(const chunkSize of [1,7,stream.length]){
  const terminal=new TerminalScreen();
  for(let i=0;i<stream.length;i+=chunkSize)terminal.write(stream.slice(i,i+chunkSize));
  assert(terminal.text().includes('Request ID: '+fixture.requestId));
  assert(terminal.text().includes('Open https://127.0.0.1:43131/admin'));
 }
});
test('VT cursor edits, erasure and repeated characters reconstruct exact request UUID',()=>{
 const terminal=new TerminalScreen(80,4);
 terminal.write('\x1b[2;1HRequest ID: 9b4ee182-e180-47e1-892f-80d1ee1db60b');
 terminal.write('\x1b[2;14H'+'b4e'+'\x1b[2;18H'+'182-'+'\x1b[2;23H'+'180');
 assert(terminal.text().includes('Request ID: 9b4ee182-e180-47e1-892f-80d1ee1db60b'));
 terminal.write('\x1b[3;1Haa\x1b[2b\x1b[3;3H\x1b[K');
 assert.equal(terminal.text().split('\n')[2].trim(),'aa');
 terminal.write('\x1b[2J');assert.equal(terminal.text().trim(),'');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';

const Uri={parse:value=>{const u=new URL(value);return {scheme:u.protocol.slice(0,-1),authority:u.host+(u.username?'@'+u.username:''),path:decodeURIComponent(u.pathname),query:u.search.slice(1),fragment:u.hash.slice(1),toString:()=>value};}};
test('native UI rejects credentials, fragments, non-loopback destinations and executable schemes',async()=>{
  const {loopbackUiUri}=await sourceModule('views/native-runtime.ts',{Uri});
  assert.equal(loopbackUiUri('http://127.0.0.1:18789/').authority,'127.0.0.1:18789');
  for(const uri of ['command:run','https://evil.test/','http://u:secret@127.0.0.1/','http://127.0.0.1/#token=secret','http://127.0.0.1/?token=secret','http://127.0.0.1/%3Ftoken=secret','http://127.0.0.1:99999/'])assert.throws(()=>loopbackUiUri(uri));
});
test('native browser requires explicit review, rechecks connection, and never creates an agent request',async()=>{
  for(const mode of ['cancel','changed','open','unsupported']){
    const calls=[],opened=[],connection={generation:1,profile:{label:'Fixture',transport:'local',installationId:'installation'},call:async(name,args)=>{
      calls.push({name,args});return name==='operator_identity'?{}:{data:{nativeUi:{available:mode!=='unsupported',scheme:'http',port:18789,pathname:'/',reason:'No supported UI'}}};
    }};
    const api={Uri,env:{openExternal:async uri=>{opened.push(uri.toString());return true;}},window:{showInformationMessage:async(_message,_opts,...buttons)=>{if(mode==='changed')connection.generation++;return mode==='cancel'?undefined:buttons[0];}}};
    const {openNativeRuntime}=await sourceModule('views/native-runtime.ts',api);
    if(mode==='changed')await assert.rejects(openNativeRuntime(connection),/Connection changed/);else await openNativeRuntime(connection);
    assert.equal(opened.length,mode==='open'?1:0);assert.ok(calls.every(call=>['operator_snapshot','operator_identity'].includes(call.name)));
  }
});

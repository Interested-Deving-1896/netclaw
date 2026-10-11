import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
import {createHash} from 'node:crypto';
function fixture(){
  const calls=[],state=new Map();let pick=0;
  const api={ViewColumn:{Beside:2},workspace:{openTextDocument:async value=>value},window:{showTextDocument:async()=>{},showQuickPick:async()=>++pick===1?{id:'risk/phone'}:'camera.capture',showInformationMessage:async()=>'Request phone consent'}};
  const context={globalState:{get:key=>state.get(key),update:async(key,value)=>state.set(key,value)}};
  const connection={generation:1,identity:{hostId:'host',installationId:'installation',principalId:'principal'},call:async(name,args)=>{
    calls.push({name,args:structuredClone(args)});
    if(args.action==='mobile-inventory')return {data:{captureSupported:true,items:[{id:'risk/phone',label:'Phone',enrolled:true,connected:true,capabilities:['camera.capture']}],limitation:'Capture needs phone consent.'}};
    if(args.action==='mobile-capture-preview')return {data:{consentReference:'review',label:'Phone',notice:'Wait for native device consent'}};
    if(name==='operator_resources')return {data:{operations:[]}};
    return {operationId:'operation',state:'admitted'};
  }};return {api,context,connection,calls,state};
}
test('capture command binds explicit confirmation to one reviewed phone and never grants native device consent',async()=>{
  const f=fixture(),{openMobile}=await sourceModule('views/mobile.ts',f.api);await openMobile(f.context,f.connection);
  const sent=f.calls.find(row=>row.args.action==='mobile-capture-request');assert.equal(sent.args.args.id,'risk/phone');assert.equal(sent.args.args.consentReference,'review');assert.equal(sent.args.args.capability,'camera.capture');
});
test('connection replacement during capture confirmation prevents admission',async()=>{
  const f=fixture();f.api.window.showInformationMessage=async()=>{f.connection.generation++;return 'Request phone consent';};
  const {openMobile}=await sourceModule('views/mobile.ts',f.api);await assert.rejects(openMobile(f.context,f.connection),/Connection changed/);assert.equal(f.calls.some(row=>row.args.action==='mobile-capture-request'),false);
});
test('media is saved only after every bounded chunk and the final SHA-256 match',async()=>{
  const bytes=Buffer.alloc(70000,17),sha256=createHash('sha256').update(bytes).digest('hex'),writes=[],offsets=[];
  const api={window:{showSaveDialog:async()=>({path:'/reviewed/capture.bin'}),showInformationMessage:async()=>{}},workspace:{fs:{writeFile:async(uri,value)=>writes.push(Buffer.from(value))}}};
  const connection={generation:1,call:async(name,args)=>{
    if(name==='operator_operation_get')return {};
    const offset=args.args.offset,end=Math.min(offset+32768,bytes.length);offsets.push(offset);
    return {data:{offset,nextOffset:end<bytes.length?end:null,bytes:bytes.length,sha256,contentType:'image',content:bytes.subarray(offset,end).toString('base64')}};
  }};
  const operation={kind:'mobile-capture',operationId:'owned',state:'succeeded',result:{decision:'captured',media:{bytes:bytes.length,sha256,contentType:'image'}}};
  const {saveCapture}=await sourceModule('views/mobile.ts',api);await saveCapture(connection,operation);assert.deepEqual(offsets,[0,32768,65536]);assert.deepEqual(writes,[bytes]);
  const call=connection.call;connection.call=async(...args)=>{const value=await call(...args);if(value.data)value.data.content=Buffer.alloc(Math.min(32768,bytes.length-value.data.offset),18).toString('base64');return value;};
  await assert.rejects(saveCapture(connection,operation),/integrity check/);assert.equal(writes.length,1);
});

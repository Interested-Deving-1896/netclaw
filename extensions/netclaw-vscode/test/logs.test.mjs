import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
function fixture(){
  const calls=[],documents=[],writes=[];let text='';
  const connection={generation:1,identity:{installationId:'selected'},call:async(name,args)=>{calls.push({name,args});
    if(name==='operator_identity')return {installationId:'selected',sourceVersion:'fixture'};
    return !args.id?{data:{sources:[{id:'gateway',name:'Selected gateway'}],scope:'Selected logs'}}:{data:{available:true,source:'gateway',readAt:'fixture',rows:[{message:'redacted preview'}],truncated:true,undatedExcluded:2,totalMatches:1,sourceReference:{sourceId:'gateway',byteStart:100,byteEnd:200},timeWindow:{since:args.filters.since,until:args.filters.until}}};
  }};
  const api={window:{showQuickPick:async rows=>typeof rows[0]==='string'?rows.includes('Custom time range')?'Custom time range':'error':rows[0],
    showInputBox:async options=>options.title.includes('since')?'2026-10-11T10:00:00Z':options.title.includes('until')?'2026-10-11T11:00:00Z':'match',showTextDocument:async()=>{},
    showInformationMessage:async()=> 'Save reviewed local copy',showSaveDialog:async()=>({scheme:'file',path:'/chosen/preview.txt'})},
    workspace:{openTextDocument:async value=>{documents.push(value);text=value.content;return {getText:()=>text};},fs:{writeFile:async(uri,bytes)=>writes.push({uri,text:bytes.toString()})}}};
  return {calls,documents,writes,connection,api,edit(value){text=value;}};
}
test('log filters preserve time/source bounds and export only the visible reviewed text',async()=>{
  const f=fixture();f.api.window.showInformationMessage=async()=>{assert.match(f.documents[0].content,/Undated rows excluded.*2/);f.edit('Further redacted by operator');return 'Save reviewed local copy';};
  const {openLogs}=await sourceModule('views/logs.ts',f.api);await openLogs(f.connection);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1].args.filters)),{query:'match',severity:'error',since:'2026-10-11T10:00:00Z',until:'2026-10-11T11:00:00Z'});
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].text,'Further redacted by operator');assert.equal(f.calls.length,2);
});
test('cancelled export, connection switch and nonlocal destinations cannot save diagnostics',async()=>{
  for(const mode of ['cancel','switch','nonlocal']){
    const f=fixture();f.api.window.showInformationMessage=async()=>{if(mode==='switch')f.connection.generation++;return mode==='cancel'?undefined:'Save reviewed local copy';};
    if(mode==='nonlocal')f.api.window.showSaveDialog=async()=>({scheme:'https',path:'/upload'});
    const {exportDiagnostics}=await sourceModule('views/logs.ts',f.api),context={extension:{packageJSON:{version:'0.1.0'}}};
    if(mode==='cancel')await exportDiagnostics(context,f.connection);else await assert.rejects(exportDiagnostics(context,f.connection));
    assert.equal(f.writes.length,0);assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'operator_identity');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceModule} from './bundle-fixture.mjs';
test('documentation renders backend markup as plain text and follows only fixed official destinations',async()=>{
  let opened;const api={env:{},window:{showQuickPick:async rows=>rows[0],showTextDocument:async()=>{}},workspace:{openTextDocument:async value=>{opened=value;return value;}}};
  const {openDocumentation,approvedGuide}=await sourceModule('views/documentation.ts',api);
  const calls=[],connection={ready:true,generation:1,identity:{sourceVersion:'fixture',contract:{major:1},installationId:'fixture-installation'},call:async(name,args)=>{calls.push(args);return args.resourceId?{data:{path:'docs/fixture.md',content:'<script>attack()</script> [run](command:bad)'}}:{data:{items:[{id:'fixture',title:'Example',category:'Help',path:'docs/fixture.md'}]}};}};
  await openDocumentation({},connection);assert.equal(opened.language,'plaintext');assert.ok(opened.content.includes('<script>attack()</script>'));assert.equal(calls.length,2);
  for(const url of ['command:bad','javascript:alert(1)','https://code.visualstudio.com.evil.invalid/docs/remote/wsl','https://github.com/attacker'])assert.equal(approvedGuide(url),undefined);
  assert.equal(approvedGuide('https://code.visualstudio.com/docs/remote/wsl'),'https://code.visualstudio.com/docs/remote/wsl');
});

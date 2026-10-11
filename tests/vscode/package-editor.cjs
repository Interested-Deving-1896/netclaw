const vscode=require('vscode'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
exports.run=async()=>{
  const phase=process.env.NETCLAW_PACKAGE_PHASE,extension=vscode.extensions.getExtension('NetClaw.netclaw');
  if(phase==='disabled'){assert.ok(!extension||!extension.isActive);return;}
  assert.ok(extension,'Packaged extension discovered');
  assert.ok(extension.extensionPath.startsWith(process.env.NETCLAW_PACKAGE_EXTENSIONS),'Running the installed VSIX, not source development code');
  assert.equal(extension.packageJSON.version,process.env.NETCLAW_PACKAGE_VERSION);
  const api=await extension.activate(),f=JSON.parse(process.env.NETCLAW_PACKAGE_FIXTURE);
  let profile;
  if(phase==='initial'){
    assert.equal(api.profiles.list().length,0);
    profile=await api.profiles.save({label:'Retained package qualification',transport:'local',nodePath:process.env.NETCLAW_TEST_NODE,launcherPath:path.join(process.env.NETCLAW_TEST_ROOT,'scripts/netclaw-operator.mjs'),home:f.home,harness:f.kind,installationId:f.installationId});
    fs.writeFileSync(process.env.NETCLAW_PACKAGE_RECEIPT,JSON.stringify({profileId:profile.id,installationId:f.installationId}));
  }else{
    const receipt=JSON.parse(fs.readFileSync(process.env.NETCLAW_PACKAGE_RECEIPT,'utf8'));
    const all=api.profiles.list();assert.equal(all.length,1);profile=all[0];assert.equal(profile.id,receipt.profileId);assert.equal(profile.installationId,receipt.installationId);
  }
  const identity=await api.connection.connect(profile);assert.equal(identity.installationId,f.installationId);
  const settings=await api.connection.call('operator_snapshot',{domain:'settings'});assert.ok(settings.data.revision);
  if(process.env.NETCLAW_PACKAGE_LIVE==='1'){
    const nonce=()=>`${Date.now()}:${require('node:crypto').randomUUID()}`;
    let receipt=JSON.parse(fs.readFileSync(process.env.NETCLAW_PACKAGE_RECEIPT,'utf8'));
    if(phase==='initial'){
      const context=await api.connection.call('operator_workspace',{action:'rag-stage',nonce:nonce(),args:{name:'Package qualification context',content:'Synthetic package lifecycle reference'}});
      const canvas=await api.connection.call('operator_workspace',{action:'canvas-import',nonce:nonce(),args:{name:'Retained investigation',content:JSON.stringify({v:1,nodes:[{id:'root',messages:[{role:'user',content:'Saved fixture investigation'}]}]})}});
      const conversation=await api.connection.call('operator_conversation_open',{nonce:nonce(),view:'chat'});
      const admitted=await api.connection.call('operator_request_submit',{nonce:nonce(),conversationId:conversation.conversationId,prompt:'remember violet',contextIds:[context.contextId]});
      let operation;
      for(let attempt=0;attempt<120;attempt++){operation=await api.connection.call('operator_operation_get',{operationId:admitted.operationId});if(['succeeded','failed','unknown'].includes(operation.state))break;await new Promise(resolve=>setTimeout(resolve,250));}
      assert.equal(operation.state,'succeeded');assert.match(operation.result.output,/violet/i);
      receipt={...receipt,operationId:admitted.operationId,conversationId:conversation.conversationId,canvasId:canvas.id,contextId:context.contextId};fs.writeFileSync(process.env.NETCLAW_PACKAGE_RECEIPT,JSON.stringify(receipt));
    }
    const operation=await api.connection.call('operator_operation_get',{operationId:receipt.operationId});assert.equal(operation.state,'succeeded');assert.match(operation.result.output,/violet/i);
    const saved=await api.connection.call('operator_workspace',{action:'canvas-export',args:{id:receipt.canvasId}});assert.equal(saved.content.nodes[0].messages[0].content,'Saved fixture investigation');
    const knowledge=await api.connection.call('operator_snapshot',{domain:'knowledge'});assert.ok(knowledge.data.contexts.some(value=>value.id===receipt.contextId));assert.ok(knowledge.data.conversations.some(value=>value.id===receipt.conversationId));
  }
  await api.connection.disconnect();
};

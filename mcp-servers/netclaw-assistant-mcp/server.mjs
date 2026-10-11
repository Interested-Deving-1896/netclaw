import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { schemas,parseAssistantInput } from './schemas.mjs';
import { safeError,fail,invariant } from '../../ui/netclaw-visual/src/management/errors.js';
import { authorize } from '../../ui/netclaw-visual/src/management/policy.js';
import { assistantOutputs,validateAssistantOutput } from '../netclaw-operator-mcp/responses.mjs';

function disclosedOperation(grant,operation){
  if(!operation.result)return operation;
  const {usage,...answer}=operation.result;
  // A retained cancel receipt contains the original operation as its result.
  // Apply the same disclosure to that nested receipt, not only the outer row.
  if(answer.result&&typeof answer.result==='object'&&typeof answer.operationId==='string')answer.result=disclosedOperation(grant,answer).result;
  return {...operation,result:{...(grant.disclosure.includes('conversation')?answer:{code:answer.code,summary:'Owned result available for human review.'}),
    ...(grant.disclosure.includes('usage')?{usage:usage??null}:{})}};
}

export async function assistantCall(service,credentialRef,name,raw){
  const input=parseAssistantInput(name,raw),principal=service.clients.resolve(credentialRef);
  const value=await dispatchAssistant(service,credentialRef,name,input);
  service.clients.validate(principal);
  return validateAssistantOutput(name,input,service.clean(value));
}
async function dispatchAssistant(service,credentialRef,name,raw){
  const input=parseAssistantInput(name,raw),grant=service.clients.resolve(credentialRef);
  if(name==='netclaw_status'){
    const identity=service.identity();return {installationId:identity.installationId,harness:identity.harness,role:identity.role,configurationRevision:identity.configurationRevision,
      capabilities:{...identity.capabilities,delegation:await service.delegationCapability()},grant:{id:grant.grantId,generation:grant.generation,actions:grant.actions,targets:grant.targets,disclosure:grant.disclosure,expiresAt:grant.expiresAt},
      billing:'NetClaw usage does not include the external assistant’s inference.'};
  }
  if(name==='netclaw_inventory'){
    authorize(grant,'inspect',[]);
    invariant(['overview','integration','skill','member','peer','edge'].includes(input.kind),'DENIED');
    if(['member','peer','edge'].includes(input.kind)){
      authorize(grant,'inspect',[service.binding.installationId]);
      invariant(grant.disclosure.includes('summary'),'DENIED');
      // Details expose capability names only under the separately reviewed
      // evidence scope; summary grants disclose identity/harness/model/counts.
      if(input.resourceId)invariant(grant.disclosure.includes('evidence'),'DENIED');
      const result=await service.resources(grant,input);
      return {...result,data:{items:result.data.items.map(row=>({id:row.id,kind:row.kind,state:row.state,harness:row.harness,model:row.model,
        stale:row.stale,receivedAt:row.receivedAt,inventory:row.inventory,executionVerified:null,
        ...(input.resourceId?{capabilities:row.capabilities,skills:row.skills,knowledge:row.knowledge}:{} )})),total:result.data.total,
        ...(result.data.nextCursor?{nextCursor:result.data.nextCursor}:{}),qualification:result.data.qualification}};
    }
    const result=await service.resources(grant,input);
    if(input.kind==='overview')return {installationId:service.binding.installationId,harness:service.binding.kind,operations:service.journal.list(grant).map(value=>disclosedOperation(grant,value))};
    // Minimal disclosure does not expose configured file paths, variable names or arbitrary descriptions.
    return {...result,data:{items:(result.data.items||[]).map(row=>({id:row.id,registered:row.registered,installed:row.installed,executionVerified:row.executionVerified})),total:result.data.total,...(result.data.nextCursor?{nextCursor:result.data.nextCursor}:{})}};
  }
  if(name==='netclaw_evidence'){
    authorize(grant,'evidence',[]);invariant(grant.disclosure.includes(input.kind==='usage'?'usage':'evidence'),'DENIED');
    if(input.kind==='usage')return service.envelope({scope:'This client grant’s owned operations',operations:service.journal.list(grant).map(({operationId,state,result})=>({operationId,state,usage:result?.usage??null}))},'Owned NetClaw request usage');
    fail('UNQUALIFIED');
  }
  if(name==='netclaw_propose_change'){
    authorize(grant,'propose',input.targets);const value=await service.proposals.prepare(grant,input);
    return {operationId:value.operationId,proposalId:value.proposalId,state:value.state,approvalRequired:true,review:'A human must review and initiate this change. Production actions additionally require independent approval. This client cannot apply changes.'};
  }
  if(name==='netclaw_request_status'){
    authorize(grant,'inspect',[]);let result=input.requestId?service.journal.get(grant,input.requestId):service.journal.byNonce(grant,input.nonce);invariant(result,'DENIED');
    if(result.kind==='assistant-request'&&result.state==='unknown')result=await service.assistants.reconcile(grant,result.operationId);
    return service.clean(disclosedOperation(grant,result));
  }
  if(name==='netclaw_request')return disclosedOperation(grant,await service.assistants.submit(grant,input));
  if(name==='netclaw_cancel')return disclosedOperation(grant,await service.assistants.cancel(grant,input));
  fail('DENIED');
}
export function assistantServer(service,credentialRef){
  const server=new McpServer({name:'netclaw-assistant',version:'0.1.0'});
  for(const [name,inputSchema] of Object.entries(schemas))server.registerTool(name,{inputSchema,outputSchema:assistantOutputs[name],
    description:`Scoped NetClaw ${name.replace('netclaw_','').replaceAll('_',' ')}. No self-approval or private operator access.`,
    annotations:{readOnlyHint:['netclaw_status','netclaw_inventory','netclaw_evidence','netclaw_request_status'].includes(name),openWorldHint:false},
  },async args=>{
    try{const value=validateAssistantOutput(name,args,service.clean(await assistantCall(service,credentialRef,name,args)));return{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};}
    catch(error){const value={error:safeError(error)};return{isError:true,content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};}
  });return server;
}
export async function serveAssistant(service,credentialRef){service.clients.resolve(credentialRef);const server=assistantServer(service,credentialRef);await server.connect(new StdioServerTransport());return server;}

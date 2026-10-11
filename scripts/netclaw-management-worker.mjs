#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ManagementService } from '../ui/netclaw-visual/src/management/service.js';
import { invariant } from '../ui/netclaw-visual/src/management/errors.js';
const {values}=parseArgs({options:{home:{type:'string'},runtime:{type:'string'},installation:{type:'string'},operation:{type:'string'}},strict:true,allowPositionals:false});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let service,lease,heartbeat;
try{
  invariant(/^[a-f\d-]{36}$/.test(values.operation||''));
  service=new ManagementService({root,home:values.home,kind:values.runtime,expectedInstallationId:values.installation});
  const row=service.journal._row(values.operation);
  // The fixed worker executes only admitted backend operation kinds; never a command from a request.
  invariant(['apply','conversation-request','assistant-request','rag-index','assessment-reconsider','mobile-capture','terminal-intent','peer-chat','peer-execution','defense-scan'].includes(row.kind),'UNSUPPORTED');
  if(row.kind==='conversation-request')await service.conversations.run(values.operation);
  else if(row.kind==='assistant-request')await service.assistants.run(values.operation);
  else if(row.kind==='rag-index')await service.workspace.runIndex(values.operation);
  else if(row.kind==='assessment-reconsider')await service.science.run(values.operation);
  else if(row.kind==='mobile-capture')await service.mobile.run(values.operation);
  else if(row.kind==='peer-chat')await service.peerConversations.run(values.operation);
  else if(row.kind==='peer-execution')await service.peerExecution.run(values.operation);
  else if(row.kind==='defense-scan')await service.defenseScans.run(values.operation);
  else if(row.kind==='terminal-intent')await service.intent.run(values.operation);
  else lease=service.journal.claim(values.operation,{pid:process.pid,start:new Date().toISOString()});
  if(lease){
    heartbeat=setInterval(()=>{try{service.journal.renew(values.operation,lease);}catch{process.exitCode=1;}},5000);heartbeat.unref();
    const chunks=[];let size=0;
    for await(const chunk of process.stdin){size+=chunk.length;invariant(size<=1024*1024);chunks.push(chunk);}
    const transient=JSON.parse(Buffer.concat(chunks).toString()||'{}');
    invariant(Object.keys(transient).every(key=>key==='replacements'));
    const input=JSON.parse(row.input);
    await service.proposals.apply(service.binding.principal,{proposalId:input.proposalId,expectedRevision:input.expectedRevision,approvalReference:input.approvalReference,nonce:row.nonce,replacements:transient.replacements||{}},{lease});
  }
}catch(error){
  if(service&&lease){try{service.journal.finish(values.operation,lease,'unknown',{code:'UNKNOWN_OUTCOME'});}catch{}}
  process.exitCode=1;
}finally{clearInterval(heartbeat);if(service)await service.close().catch(()=>{});}

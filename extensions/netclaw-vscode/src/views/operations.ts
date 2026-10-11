import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';

type Operation={operationId:string;kind:string;state:string;createdAt?:string;result?:{proposalId?:string;approvalClosed?:boolean;recoveryVerified?:boolean}};
type Proposal={action:string;targets:string[];expectedRevision:string;impact:string;changeClass:string;state:string;expiresAt:number;patch:{fields?:{key:string;intent:string}[]};baseline?:{hash:string};rollback?:{hash:string}};

/** Human review is native UI, never an action accepted from model/webview text. */
export async function applyReviewedProposal(connection:Connection,proposalId:string):Promise<Operation|undefined>{
  const call=boundCaller(connection),installationId=connection.identity?.installationId;
  const {data:proposal}=await call<{data:Proposal}>('operator_evidence',{kind:'approval',id:proposalId});
  if(proposal.state!=='pending-approval')throw Error(`This proposal is ${proposal.state}. Inspect its retained outcome before preparing another change.`);
  if(proposal.expiresAt<=Date.now())throw Error('This proposal expired. Prepare and review a new proposal.');
  if(!['operator-local','production','terminal-local'].includes(proposal.changeClass))throw Error('This proposal has no supported approval authority.');
  const detail=[`Installation: ${installationId}`,`Targets: ${proposal.targets.join(', ')}`,proposal.impact,
    `Approval class: ${proposal.changeClass}`,`Expires: ${new Date(proposal.expiresAt).toISOString()}`,
    `Baseline SHA-256: ${proposal.baseline?.hash||'Unavailable'}`,`Rollback SHA-256: ${proposal.rollback?.hash||'Unavailable'}`,
    JSON.stringify(proposal.patch,null,2)].join('\n');
  if(await vscode.window.showInformationMessage(`Review ${proposal.action}`,{modal:true,detail},'Apply reviewed change')!=='Apply reviewed change')return;
  const replacements:Record<string,string>={};
  try{
    for(const field of proposal.patch.fields||[]){
      if(field.intent!=='replace'||!/KEY|TOKEN|PASSWORD|SECRET|AUTH|CREDENTIAL/i.test(field.key))continue;
      const value=await vscode.window.showInputBox({title:`Replace ${field.key}`,password:true,prompt:'Blank keeps the existing value. This input is sent only to the reviewed backend.'});
      if(value===undefined)return;replacements[field.key]=value;
    }
    let approvalReference:string|undefined;
    if(proposal.changeClass!=='operator-local'){
      approvalReference=(await vscode.window.showInputBox(proposal.changeClass==='production'?{
        title:'Independently approved ServiceNow change reference',prompt:'NetClaw verifies current Implement state, independent approval and exact scope. Entering a reference does not approve it.',
      }:{title:'API-created Local/Lab change record',prompt:'The backend verifies designated endpoints, explicit intent, baseline, rollback and APPLY phase. Generic lab mode is not approval.'}))?.trim();
      if(!approvalReference)return;
    }
    return await call<Operation>('operator_change_apply',{proposalId,nonce:`${Date.now()}:${randomUUID()}`,expectedRevision:proposal.expectedRevision,replacements,...(approvalReference?{approvalReference}:{})});
  }finally{
    // Do not retain values in panel state, logs or another command invocation.
    for(const key of Object.keys(replacements))delete replacements[key];
  }
}

export async function reviewProposal(context:vscode.ExtensionContext,connection:Connection,id?:string):Promise<void>{
  const call=boundCaller(connection);
  let proposalId=id;
  if(!proposalId){
    const {data}=await call<{data:{operations:Operation[]}}>('operator_resources',{kind:'overview'});
    const selected=await vscode.window.showQuickPick(data.operations.filter(o=>o.state==='waiting-approval'&&o.result?.proposalId).map(o=>({label:o.result!.proposalId!,description:o.kind})),{title:'Pending managed proposals'});
    proposalId=selected?.label;
  }
  if(!proposalId)return;
  await call('operator_identity');
  const receipt=await applyReviewedProposal(connection,proposalId);if(!receipt)return;
  openDataView(context,connection,{title:'Change outcome',kind:'change',load:()=>call('operator_operation_get',{operationId:receipt.operationId})});
}

export async function openOperations(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),{data}=await call<{data:{operations:Operation[]}}>('operator_resources',{kind:'overview'});
  if(!data.operations.length){void vscode.window.showInformationMessage('No retained management operations for this installation.');return;}
  const selected=await vscode.window.showQuickPick(data.operations.map(operation=>({label:`${operation.kind} · ${operation.state}`,description:operation.operationId,operation})),{title:'NetClaw operations',matchOnDescription:true});if(!selected)return;
  const current=await call<Operation>('operator_operation_get',{operationId:selected.operation.operationId});
  if(current.state==='waiting-approval'&&current.result?.proposalId){await reviewProposal(context,connection,current.result.proposalId);return;}
  openDataView(context,connection,{title:`Operation · ${current.state}`,kind:'operation',load:async()=>{
    const operation=await call('operator_operation_get',{operationId:current.operationId}),events=await call('operator_events',{operationId:current.operationId,limit:200});
    return {operation,events,recoveryNote:'Unknown outcomes are retained for reconciliation. Refresh never resubmits work. Failed changes do not close their approval record.'};
  }});
}

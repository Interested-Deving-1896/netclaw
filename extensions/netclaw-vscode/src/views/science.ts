import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';

type Assessment={id:string;conversationId:string;operationId:string;parent:string|null};
type Detail={assessment:{assessment_id:string;status:string};related:{assessmentId:string;parent:string|null}[]};
type Review={reviewId:string;request:unknown;prepared:{endpoint:string;reserved_cost_usd:number;approval_required:boolean};budgets:unknown;notice:string};
type Pending={nonce:string;operationId?:string};
type Operation={operationId:string;state:string;result?:unknown};

/** Native dialogs own selection and consent. No model or webview approves work. */
export async function openScience(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),identity=connection.identity;if(!identity)throw Error('Connect to an existing installation first.');
  const key=`science.pending.${identity.hostId}.${identity.installationId}.${identity.principalId}`;
  const show=async(value:unknown)=>{
    const document=await vscode.workspace.openTextDocument({content:JSON.stringify(value,null,2),language:'json'});
    await vscode.window.showTextDocument(document,{preview:true,preserveFocus:true,viewColumn:vscode.ViewColumn.Beside});
  };
  const pending=context.globalState.get<Pending>(key);
  if(pending){
    const result=pending.operationId?await call<Operation>('operator_operation_get',{operationId:pending.operationId}):(await call<{data:{operation?:Operation}}>('operator_resources',{kind:'overview',filters:{query:pending.nonce}})).data.operation;
    if(!result){await vscode.window.showInformationMessage('The previous reconsideration admission is unconfirmed. Reopen Science Officer to reconcile it; the request will not be resent.');return;}
    await show(result);
    if(!['succeeded','failed','cancelled','denied','expired'].includes(result.state)){await vscode.window.showInformationMessage(`Jev reconsideration is ${result.state}. The backend owns the request. Reopen Science Officer to check its result.`);return;}
    await context.globalState.update(key,undefined);
  }
  const listing=await call<{data:{taskOwnedAssessments:Assessment[];qualification:string}}>('operator_resources',{kind:'advisor'});
  if(!listing.data.taskOwnedAssessments.length){await show(listing.data);return;}
  const chosen=await vscode.window.showQuickPick(listing.data.taskOwnedAssessments.map(row=>({label:row.id,description:`${row.parent?'Reconsidered':'Original'} advice · conversation ${row.conversationId}`,id:row.id})),{title:'Science Officer — task-owned advice',placeHolder:'Advice cannot authorize or execute a change'});if(!chosen)return;
  const detail=(await call<{data:Detail}>('operator_workspace',{action:'assessment-read',args:{id:chosen.id}})).data;await show(detail);
  const options=detail.related.map(row=>({label:row.parent?'Open reconsidered advice':'Open original advice',value:row.assessmentId}));
  const ref=listing.data.taskOwnedAssessments.find(row=>row.id===chosen.id);
  if(!ref?.parent&&detail.assessment.status==='ok'&&!detail.related.length)options.push({label:'Review a reconsideration question',value:'reconsider'});
  if(!options.length)return;
  const selected=await vscode.window.showQuickPick(options,{title:'Science Officer assessment'});if(!selected)return;
  if(selected.value!=='reconsider'){await show((await call<{data:unknown}>('operator_workspace',{action:'assessment-read',args:{id:selected.value}})).data);return;}
  const query=await vscode.window.showInputBox({title:'Question about the earlier advice',prompt:'Jev will receive the retained typed assessment and this question. Original raw state and current device observations are not included.',validateInput:value=>value.trim()&&value.length<=4000?undefined:'Enter 1–4000 characters'});if(!query)return;
  const review=(await call<{data:Review}>('operator_workspace',{action:'assessment-preview',args:{id:chosen.id,query}})).data;await show(review);
  const consent=await vscode.window.showInformationMessage('Submit this reviewed Jev reconsideration?',{modal:true,detail:`Destination: ${review.prepared.endpoint}\nMaximum reservation: $${review.prepared.reserved_cost_usd}\n${review.prepared.approval_required?'This private request also requires the exact backend disclosure grant in the review. This confirmation cannot create it.\n':''}The result is advice only. Jev enforces its existing budgets and one reconsideration per original assessment.`},'Submit reconsideration');if(consent!=='Submit reconsideration')return;
  // Revalidate generation before retaining a nonce or submitting to a host.
  await call('operator_resources',{kind:'advisor'});
  const next:Pending={nonce:`${Date.now()}:${randomUUID()}`};await context.globalState.update(key,next);
  const admitted=await call<Operation>('operator_workspace',{action:'assessment-reconsider',nonce:next.nonce,args:{id:chosen.id,query,reviewId:review.reviewId}});
  await context.globalState.update(key,{...next,operationId:admitted.operationId});
  await vscode.window.showInformationMessage(`Jev reconsideration ${admitted.operationId} is ${admitted.state}. Reopen Science Officer or Operations to inspect it.`);
}

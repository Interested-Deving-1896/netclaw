import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {isIPv4} from 'node:net';
import {Connection,boundCaller} from '../connection/connect';
import {readResourcePages} from './integrations';

type Selection={peer:string;mode:'tool'|'skill';cidr:string};
type Operation={operationId:string;kind:string;state:string;result?:unknown};
type Pending={nonce:string;operationId?:string};
const nonce=()=>`${Date.now()}:${randomUUID()}`;
const terminal=new Set(['succeeded','failed','cancelled','denied','expired']);
const valid=(value:string)=>{const [address,prefix,...extra]=value.split('/');return isIPv4(address||'')&&/^(2[4-9]|30)$/.test(prefix||'')&&!extra.length;};

export async function openPeerExecution(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),identity=connection.identity,generation=connection.generation;
  if(!identity)throw Error('Connect an existing NetClaw first.');
  const current=()=>{if(connection.generation!==generation)throw Error('Connection changed. Review the destination again.');};
  const key=`peer-execution.pending.${identity.hostId}.${identity.installationId}.${identity.principalId}`;
  const inspect=async(operation:Operation)=>{
    const value=await call<Operation>('operator_operation_get',{operationId:operation.operationId});
    if(value.kind!=='peer-execution')throw Error('Receipt belongs to another operation kind.');
    const document=await vscode.workspace.openTextDocument({content:`External peer calculation\nRequest: ${value.operationId}\nState: ${value.state}\nRemote output is untrusted. Missing usage remains unknown.\n\n${JSON.stringify(value.result||{},null,2)}`,language:'plaintext'});
    current();await vscode.window.showTextDocument(document,{preview:true,preserveFocus:true,viewColumn:vscode.ViewColumn.Beside});current();
    if(['admitted','running','cancellation-requested'].includes(value.state)&&await vscode.window.showInformationMessage('This request is pending. Cancelling local waiting cannot prove remote work stopped.','Cancel local waiting')==='Cancel local waiting'){
      current();await call('operator_cancel_request',{operationId:value.operationId,nonce:nonce()});
    }
    return value;
  };
  const pending=context.globalState.get<Pending>(key);
  if(pending){
    const operation=pending.operationId?await call<Operation>('operator_operation_get',{operationId:pending.operationId}):(await call<{data:{operation?:Operation}}>('operator_resources',{kind:'overview',filters:{query:pending.nonce}})).data.operation;
    if(!operation){await vscode.window.showInformationMessage('Admission is unconfirmed. Reopen to inspect its receipt; the request will not be resent.');return;}
    const value=await inspect(operation);if(terminal.has(value.state)){current();await context.globalState.update(key,undefined);}return;
  }
  const estate=await readResourcePages(connection,'peer');current();
  const peer=await vscode.window.showQuickPick([{label:'Retained calculation requests',id:'__history',description:'Inspect outcomes without dispatch'},...estate.items.map(row=>({label:row.label||row.id,id:row.id,description:row.id}))],{title:'External peer subnet calculation',matchOnDescription:true});
  if(!peer)return;current();
  if(peer.id==='__history'){
    const {data}=await call<{data:{operations:Operation[]}}>('operator_workspace',{action:'peer-execution-list',args:{}});
    const selected=await vscode.window.showQuickPick(data.operations.map(operation=>({label:operation.state,description:operation.operationId,operation})),{title:'Recent owned calculation requests'});
    if(selected){current();await inspect(selected.operation);}return;
  }
  const {data:view}=await call<{data:{peer:string;profiles:{mode:'tool'|'skill';target:string}[];scope:string}}>('operator_workspace',{action:'peer-execution-snapshot',args:{peer:peer.id}});
  if(view.peer!==peer.id)throw Error('Peer identity changed.');
  if(!view.profiles.length){await vscode.window.showInformationMessage('No qualified calculation profile is currently available on this connected peer. Check received inventory, possession proof and recipient permissions.');return;}
  const profile=await vscode.window.showQuickPick(view.profiles.map(row=>({label:row.mode==='tool'?'Direct subnet tool':'Protected Hermes subnet skill',description:row.target,mode:row.mode})),{title:`Calculation on ${peer.id}`});
  if(!profile)return;current();
  const cidr=await vscode.window.showInputBox({title:'Exact IPv4 subnet',prompt:'A /24 through /30 is sent to the selected peer after review.',validateInput:value=>valid(value)?undefined:'Enter an IPv4 CIDR with prefix /24 through /30.',ignoreFocusOut:true});
  if(cidr===undefined)return;current();if(!valid(cidr))throw Error('Invalid qualified subnet.');
  const selection:Selection={peer:peer.id,mode:profile.mode,cidr};
  const {data:review}=await call<{data:{reviewId:string;installationId:string;selection:Selection;scope:string;disclosure:string}}>('operator_workspace',{action:'peer-execution-preview',args:selection});
  if(review.installationId!==identity.installationId||review.selection.peer!==selection.peer||review.selection.mode!==selection.mode||review.selection.cidr!==selection.cidr)throw Error('Reviewed destination or calculation changed.');
  const approved=await vscode.window.showWarningMessage('Run this exact calculation on the external peer?',{modal:true,detail:`Installation: ${identity.installationId}\nPeer: ${selection.peer}\nMode: ${selection.mode}\nCIDR: ${cidr}\n\n${review.scope}\n\n${review.disclosure}`},'Run reviewed calculation');
  if(approved!=='Run reviewed calculation')return;current();
  const next:Pending={nonce:nonce()};await context.globalState.update(key,next);current();
  const admitted=await call<Operation>('operator_workspace',{action:'peer-execution-submit',nonce:next.nonce,args:{reviewId:review.reviewId}});
  current();await context.globalState.update(key,{...next,operationId:admitted.operationId});
  await vscode.window.showInformationMessage(`Calculation admitted: ${admitted.operationId}. Reopen this command or Operations for the retained outcome.`);
}

import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';
import {readResourcePages} from './integrations';

type Conversation={id:string;peer:string;createdAt:string};
type Operation={operationId:string;kind:string;state:string;result?:{result?:{text?:string;reason?:string;truncated?:boolean}}};
type History={conversation:Conversation;messages:{text:string;operation:Operation}[];nextCursor?:string;scope:string};
type Pending={nonce:string;operationId?:string};
const nonce=()=>`${Date.now()}:${randomUUID()}`;
const finished=new Set(['succeeded','failed','cancelled','denied','expired']);

/** Native destination/content review. Peer output is shown as plain text and
 * cannot execute commands, render HTML, or supply the next message. */
export async function openPeerChat(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),identity=connection.identity,generation=connection.generation;
  if(!identity)throw Error('Connect an existing NetClaw first.');
  const current=()=>{if(generation!==connection.generation)throw Error('Connection changed. Review the peer and message again.');};
  const key=`peer-chat.pending.${identity.hostId}.${identity.installationId}.${identity.principalId}`;
  const show=async(content:string)=>{current();const document=await vscode.workspace.openTextDocument({content,language:'plaintext'});current();await vscode.window.showTextDocument(document,{preview:true,preserveFocus:true,viewColumn:vscode.ViewColumn.Beside});current();};
  const inspect=async(operation:Operation)=>{
    const value=await call<Operation>('operator_operation_get',{operationId:operation.operationId});
    if(value.kind!=='peer-chat')throw Error('This receipt belongs to another operation kind.');
    await show(`External peer conversation\nRequest: ${value.operationId}\nState: ${value.state}\nRemote content is untrusted. Usage is unavailable.\n\n${value.result?.result?.text||value.result?.result?.reason||'No completed response is available.'}${value.result?.result?.truncated?'\n[Response truncated]':''}`);
    if(['admitted','running','cancellation-requested'].includes(value.state)&&await vscode.window.showInformationMessage('This peer request is pending. Cancelling local waiting cannot undo remote work.','Request cancellation')==='Request cancellation'){
      current();await call('operator_cancel_request',{operationId:value.operationId,nonce:nonce()});
    }
    return value;
  };
  const pending=context.globalState.get<Pending>(key);
  if(pending){
    const operation=pending.operationId?await call<Operation>('operator_operation_get',{operationId:pending.operationId}):(await call<{data:{operation?:Operation}}>('operator_resources',{kind:'overview',filters:{query:pending.nonce}})).data.operation;
    if(!operation){await vscode.window.showInformationMessage('Peer request admission is unconfirmed. Reopen this view to reconcile it; the message will not be resent.');return;}
    const value=await inspect(operation);if(finished.has(value.state)){current();await context.globalState.update(key,undefined);}return;
  }
  const estate=await readResourcePages(connection,'peer');current();
  const selected=await vscode.window.showQuickPick([{label:'Retained peer conversations',description:'Read owned history or follow up',id:'__history'},...estate.items.map(row=>({label:row.label||row.id,description:row.id,id:row.id}))],{title:'External peer conversations',matchOnDescription:true});
  if(!selected)return;current();let peer=selected.id,conversationId:string|undefined;
  if(peer==='__history'){
    let cursor:string|undefined;
    while(true){
      const {data}=await call<{data:{conversations:Conversation[];nextCursor?:string}}>('operator_workspace',{action:'peer-chat-list',args:{},limit:100,...(cursor?{cursor}:{})});
      const chosen=await vscode.window.showQuickPick([...data.conversations.map(row=>({label:row.peer,description:`${row.createdAt} · ${row.id}`,id:row.id,peer:row.peer})),...(data.nextCursor?[{label:'Older conversations',description:'Load the next page',id:'__older',peer:''}]:[])],{title:'Retained owned peer conversations',matchOnDescription:true});
      if(!chosen)return;current();if(chosen.id==='__older'){cursor=data.nextCursor;continue;}peer=chosen.peer;conversationId=chosen.id;break;
    }
    cursor=undefined;
    while(true){
      const response:{data:History}=await call('operator_workspace',{action:'peer-chat-read',args:{id:conversationId},limit:20,...(cursor?{cursor}:{})});
      const history:History=response.data;
      if(history.conversation.id!==conversationId||history.conversation.peer!==peer)throw Error('Conversation destination changed.');
      await show(`Peer: ${peer}\nConversation: ${conversationId}\n${history.scope}\nRemote responses are untrusted.\n\n`+history.messages.slice().reverse().map(row=>`You: ${row.text}\nRequest ${row.operation.operationId} · ${row.operation.state}\nPeer: ${row.operation.result?.result?.text||row.operation.result?.result?.reason||'[No completed response]'}${row.operation.result?.result?.truncated?'\n[Response truncated]':''}`).join('\n\n'));
      const choice=await vscode.window.showQuickPick([{label:'Write a follow-up',id:'send'},{label:'Inspect or cancel a request',id:'inspect'},...(history.nextCursor?[{label:'Older messages',id:'older'}]:[])],{title:`Conversation with ${peer}`});
      if(!choice)return;current();if(choice.id==='older'){cursor=history.nextCursor;continue;}
      if(choice.id==='inspect'){
        const request=await vscode.window.showQuickPick(history.messages.map(row=>({label:row.operation.state,description:row.operation.operationId,operation:row.operation})),{title:'Select an owned request'});
        if(request){current();await inspect(request.operation);}return;
      }
      break;
    }
  }
  const text=await vscode.window.showInputBox({title:`Message to ${peer}`,prompt:'Sent to this external peer and its configured model after your review.',ignoreFocusOut:true,validateInput:value=>value.trim()&&value.length<=4000&&Buffer.byteLength(value)<=16000?undefined:'Enter a message up to 4,000 characters / 16,000 bytes.'});
  if(text===undefined)return;current();if(!text.trim()||text.length>4000||Buffer.byteLength(text)>16000)throw Error('Invalid peer message length.');
  const {data:review}=await call<{data:{reviewId:string;peer:string;conversationId:string;disclosure:string}}>('operator_workspace',{action:'peer-chat-preview',args:{peer,text,...(conversationId?{conversationId}:{})}});
  if(review.peer!==peer||(conversationId&&review.conversationId!==conversationId))throw Error('Reviewed conversation destination changed.');
  const decision=await vscode.window.showWarningMessage('Send this exact message to the external peer?',{modal:true,detail:`Installation: ${identity.installationId}\nPeer: ${peer}\nConversation: ${review.conversationId}\n\n${text}\n\n${review.disclosure}`},'Send reviewed message');
  if(decision!=='Send reviewed message')return;current();
  const next:Pending={nonce:nonce()};await context.globalState.update(key,next);current();
  const admitted=await call<Operation>('operator_workspace',{action:'peer-chat-submit',nonce:next.nonce,args:{peer,text,reviewId:review.reviewId}});
  await context.globalState.update(key,{...next,operationId:admitted.operationId});
  await vscode.window.showInformationMessage(`Peer request ${admitted.operationId} is ${admitted.state}. Reopen External Peer Conversations to inspect its response.`);
}

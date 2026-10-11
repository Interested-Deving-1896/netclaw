import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';
export async function searchMemory(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  const query=await vscode.window.showInputBox({title:'Search NetClaw memory',prompt:'Literal text search of recorded facts, decisions and graph links; validity windows remain visible.',validateInput:value=>value.trim()&&value.length<=4000?undefined:'Enter 1–4000 characters'});if(query===undefined)return;
  await call('operator_identity');
  openDataView(context,connection,{title:'Recorded memory',kind:'memory',load:()=>call('operator_workspace',{action:'memory-search',args:{query}})});
}

async function showKnowledge(value:unknown):Promise<void>{
  const document=await vscode.workspace.openTextDocument({content:JSON.stringify(value,null,2),language:'json'});
  await vscode.window.showTextDocument(document,{preview:true,preserveFocus:true,viewColumn:vscode.ViewColumn.Beside});
}

export async function analyzeSelectedContext(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  let cursor:string|undefined;
  for(;;){
    const listing=await call<{data:{contexts:{id:string;name:string;size:number}[];nextCursor?:string}}>('operator_workspace',{action:'gcf-read',args:{},...(cursor?{cursor}:{})});
    if(!listing.data.contexts.length){await vscode.window.showInformationMessage('Select and retain context in RAG, Chat or Meetings first. GCF measures one selected context locally.');return;}
    const options=listing.data.contexts.map(row=>({label:row.name,description:`${row.size} bytes`,id:row.id}));
    if(listing.data.nextCursor)options.push({label:'Load older contexts',description:'Next page',id:''});
    const selected=await vscode.window.showQuickPick(options,{title:'Analyze selected context with GCF',placeHolder:'Local measurement; no model request or runtime setting change'});if(!selected)return;
    if(!selected.id){cursor=listing.data.nextCursor;continue;}
    await showKnowledge(await call('operator_workspace',{action:'gcf-read',args:{id:selected.id}}));return;
  }
}

type MeetingEntry={timestamp:number;kind:string;participantName?:string;text?:string;truncated:boolean;source:string;citation:unknown};
type MeetingContext={available:boolean;id:string;source:string;networkObservation:false;authority:string;retention:string;entries:MeetingEntry[]};
export async function openMeetings(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  const listing=await call<{data:{available:boolean;meetings:{id:string;state:string}[]}}>('operator_workspace',{action:'meeting-read',args:{}});
  if(!listing.data.available||!listing.data.meetings.length){await showKnowledge(listing);return;}
  const chosen=await vscode.window.showQuickPick(listing.data.meetings.map(row=>({label:row.id,description:row.state,id:row.id})),{title:'Live meeting context',placeHolder:'Read the existing Zoom process; recording and listening settings remain under its control'});if(!chosen)return;
  const result=await call<{data:MeetingContext}>('operator_workspace',{action:'meeting-read',args:{id:chosen.id}});await showKnowledge(result);
  if(!result.data.available||!result.data.entries.length)return;
  const selected=await vscode.window.showQuickPick(result.data.entries.map((entry,index)=>({label:`${entry.participantName||entry.kind}: ${(entry.text||'Meeting event').slice(0,150)}`,description:entry.source+(entry.truncated?' · excerpt truncated':''),index})),{title:'Select meeting excerpts to retain as context',canPickMany:true,placeHolder:'Optional; only selected excerpts will be retained after review'});if(!selected?.length)return;
  const content=JSON.stringify({source:result.data.source,meetingId:result.data.id,networkObservation:false,authority:result.data.authority,retention:result.data.retention,entries:selected.map(row=>result.data.entries[row.index])},null,2);
  const preview=await vscode.workspace.openTextDocument({content,language:'json'});await vscode.window.showTextDocument(preview,{preview:true,preserveFocus:true,viewColumn:vscode.ViewColumn.Beside});
  if(await vscode.window.showInformationMessage('Retain these reviewed meeting excerpts as NetClaw context?',{modal:true,detail:'This explicitly saves a copy in the selected installation after the live buffer expires. It is shared with the configured model only when you select this context in a submitted Chat or Canvas request. Meeting statements are not current network observations.'},'Retain selected excerpts')!=='Retain selected excerpts')return;
  await call('operator_workspace',{action:'rag-stage',nonce:`${Date.now()}:${randomUUID()}`,args:{name:`Meeting ${chosen.id}`.slice(0,200),content}});
  await vscode.window.showInformationMessage('Reviewed meeting excerpts are available as optional context in Chat and Canvas.');
}

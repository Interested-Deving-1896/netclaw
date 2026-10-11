import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
export async function openLogs(connection:Connection):Promise<void>{
  const call=boundCaller(connection),installationId=connection.identity?.installationId;
  const sources=await call<{data:{sources:{id:string;name:string}[];scope:string}}>('operator_evidence',{kind:'log'});
  const selected=await vscode.window.showQuickPick(sources.data.sources.map(source=>({label:source.name,id:source.id})),{title:'Logs from this installation'});if(!selected)return;
  const severity=await vscode.window.showQuickPick(['all','info','warning','error'],{title:'Log severity filter'});if(!severity)return;
  const query=await vscode.window.showInputBox({title:'Filter log messages',prompt:'Optional text filter, applied after credential-pattern redaction',validateInput:value=>value.length<=200?undefined:'Use at most 200 characters'});if(query===undefined)return;
  const result=await call<{data:{available:boolean;reason?:string;source:string;scope?:string;readAt?:string;truncated?:boolean;rows?:{message:string}[]};truncation?:object}>('operator_evidence',{
    kind:'log',id:selected.id,filters:{query,...(severity==='all'?{}:{severity})},limit:500,
  });
  if(!result.data.available)throw Error(result.data.reason||'This log is unavailable.');
  const content=[`Installation: ${installationId}`,`Source: ${result.data.source}`,`Read at: ${result.data.readAt}`,result.data.scope,
    result.data.truncated||result.truncation?'This preview is truncated.':'Bounded preview.',
    'Review this redacted preview before saving or sharing it.','',...(result.data.rows||[]).map(row=>row.message)].join('\n');
  const document=await vscode.workspace.openTextDocument({content,language:'plaintext'});await vscode.window.showTextDocument(document,{preview:false});
}

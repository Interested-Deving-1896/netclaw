import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';

async function previewExport(connection:Connection,content:string,language:string):Promise<void>{
  const generation=connection.generation,current=()=>{if(connection.generation!==generation)throw Error('Connection changed. Reopen the diagnostic preview for its original installation.');};
  const document=await vscode.workspace.openTextDocument({content,language});current();
  await vscode.window.showTextDocument(document,{preview:false});current();
  if(await vscode.window.showInformationMessage('Review and, if needed, further redact this preview before saving. No upload is performed.','Save reviewed local copy')!=='Save reviewed local copy')return;current();
  const destination=await vscode.window.showSaveDialog({title:'Save the reviewed diagnostic preview',saveLabel:'Save local copy',filters:language==='json'?{JSON:['json']}:{Text:['txt','log']}});
  if(!destination)return;current();
  if(!['file','vscode-remote'].includes(destination.scheme))throw Error('Choose a local or connected workspace file for this private diagnostic export.');
  // Save the visible document, including any additional redaction by the user.
  await vscode.workspace.fs.writeFile(destination,Buffer.from(document.getText(),'utf8'));
}

const validTime=(value:string):boolean=>/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
export async function openLogs(connection:Connection):Promise<void>{
  const call=boundCaller(connection),installationId=connection.identity?.installationId,generation=connection.generation;
  const current=()=>{if(generation!==connection.generation)throw Error('Connection changed. Reopen logs for the selected installation.');};
  const sources=await call<{data:{sources:{id:string;name:string}[];scope:string}}>('operator_evidence',{kind:'log'});
  const selected=await vscode.window.showQuickPick(sources.data.sources.map(source=>({label:source.name,id:source.id})),{title:'Logs from this installation'});if(!selected)return;current();
  const severity=await vscode.window.showQuickPick(['all','info','warning','error','debug','unknown'],{title:'Log severity filter'});if(!severity)return;current();
  const period=await vscode.window.showQuickPick(['All timestamps in bounded tail','Last hour','Last 24 hours','Custom time range'],{title:'Log time filter',placeHolder:'A time filter excludes rows without a recognized timestamp.'});if(!period)return;current();
  let since:string|undefined,until:string|undefined;
  if(period==='Last hour'||period==='Last 24 hours'){until=new Date().toISOString();since=new Date(Date.parse(until)-(period==='Last hour'?1:24)*3600000).toISOString();}
  if(period==='Custom time range'){
    const options={prompt:'ISO timestamp with timezone, such as 2026-10-11T14:00:00Z. Blank leaves this bound open.',validateInput:(value:string)=>!value||validTime(value)?undefined:'Use a complete ISO timestamp with Z or a numeric timezone offset.'};
    const start=await vscode.window.showInputBox({...options,title:'Logs since (inclusive)'});if(start===undefined)return;current();
    const end=await vscode.window.showInputBox({...options,title:'Logs until (inclusive)'});if(end===undefined)return;current();
    if(start&&!validTime(start)||end&&!validTime(end)||start&&end&&Date.parse(start)>Date.parse(end))throw Error('Invalid log time range.');
    since=start||undefined;until=end||undefined;
  }
  const query=await vscode.window.showInputBox({title:'Filter log messages',prompt:'Optional text filter, applied after credential-pattern redaction',validateInput:value=>value.length<=200?undefined:'Use at most 200 characters'});if(query===undefined)return;
  current();const result=await call<{data:{available:boolean;reason?:string;source:string;scope?:string;readAt?:string;truncated?:boolean;undatedExcluded?:number;totalMatches?:number;sourceReference?:object;timeWindow?:object;rows?:{message:string}[]};truncation?:object}>('operator_evidence',{
    kind:'log',id:selected.id,filters:{query,...(severity==='all'?{}:{severity}),...(since?{since}:{}),...(until?{until}:{})},limit:500,
  });
  if(!result.data.available)throw Error(result.data.reason||'This log is unavailable.');
  const content=[`Installation: ${installationId}`,`Source: ${result.data.source}`,`Read at: ${result.data.readAt}`,result.data.scope,
    result.data.truncated||result.truncation?'This preview is truncated.':'Bounded preview.',
    `Matching rows before the 250-row cap: ${result.data.totalMatches??'Unknown'}. Undated rows excluded by time filter: ${result.data.undatedExcluded??0}.`,
    `Time window: ${JSON.stringify(result.data.timeWindow)}`,`Source reference: ${JSON.stringify(result.data.sourceReference)}`,
    'Review this redacted preview before saving or sharing it.','',...(result.data.rows||[]).map(row=>row.message)].join('\n');
  current();await previewExport(connection,content,'plaintext');
}

export async function exportDiagnostics(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),generation=connection.generation;
  const identity=await call('operator_identity');
  const content=JSON.stringify({generatedAt:new Date().toISOString(),extensionVersion:context.extension.packageJSON.version,identity,
    scope:'Selected backend identity, compatibility and declared capabilities only. No configuration values, log content or network evidence are collected by this command.'},null,2);
  if(connection.generation!==generation)throw Error('Connection changed. Reopen diagnostics.');
  await previewExport(connection,content,'json');
}

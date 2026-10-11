import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';

export async function openGait(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  openDataView(context,connection,{title:'GAIT audit trail',kind:'gait',load:()=>call('operator_evidence',{kind:'gait',limit:100})});
}

export async function exportGait(connection:Connection):Promise<void>{
  const call=boundCaller(connection),installationId=connection.identity?.installationId;
  const evidence=await call('operator_evidence',{kind:'gait',limit:500});
  const content=JSON.stringify({installationId,exportedAt:new Date().toISOString(),scope:'Bounded redacted management audit. Original history remains in the backend.',evidence},null,2);
  const document=await vscode.workspace.openTextDocument({content,language:'json'});await vscode.window.showTextDocument(document,{preview:false});
  if(await vscode.window.showInformationMessage('Review this audit preview before saving or sharing it.','Save local copy')!=='Save local copy')return;
  const destination=await vscode.window.showSaveDialog({filters:{JSON:['json']},saveLabel:'Save reviewed GAIT evidence'});
  if(destination)await vscode.workspace.fs.writeFile(destination,Buffer.from(content));
}

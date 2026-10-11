import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';
export async function searchMemory(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  const query=await vscode.window.showInputBox({title:'Search NetClaw memory',prompt:'Literal text search of recorded facts, decisions and graph links; validity windows remain visible.',validateInput:value=>value.trim()&&value.length<=4000?undefined:'Enter 1–4000 characters'});if(query===undefined)return;
  await call('operator_identity');
  openDataView(context,connection,{title:'Recorded memory',kind:'memory',load:()=>call('operator_workspace',{action:'memory-search',args:{query}})});
}

import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';

export async function openOpenShell(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  openDataView(context,connection,{title:'OpenShell and host confinement',kind:'openshell',load:async()=>{
    const result=await call<{data:{openshell?:unknown;effective:{openshell?:unknown;hostConfinement?:unknown;scope?:string;reason?:string};controls:{openshell:unknown}};source:string;observedAt:string}>('operator_snapshot',{domain:'security'});
    return {source:result.source,observedAt:result.observedAt,openshell:result.data.openshell||result.data.effective.openshell||{state:'unavailable',reason:result.data.effective.reason},
      hostConfinement:result.data.effective.hostConfinement||{state:'unavailable'},supportedActions:result.data.controls.openshell,
      scope:result.data.effective.scope||'No current selected-daemon observation.',interpretation:'Host confinement and OpenShell gateway/sandbox policy are separate controls.'};
  }});
}

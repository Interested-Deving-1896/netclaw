import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';

export async function openSecurity(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  openDataView(context,connection,{title:'DefenseClaw and federation posture',kind:'security',load:async()=>{
    const result=await call<{data:Record<string,unknown>;source:string;observedAt:string}>('operator_snapshot',{domain:'security'});
    return {...result,interpretation:'Stored configuration and the selected daemon’s observations are shown separately. Reported enforcement applies to federation preflight; stale reports and missing controls require investigation.'};
  }});
}

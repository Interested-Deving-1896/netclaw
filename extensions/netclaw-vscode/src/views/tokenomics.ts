import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';
export async function openTokenomics(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  const selection=await vscode.window.showQuickPick([
    {label:'Retained records',value:undefined},{label:'Last 24 hours',value:'day'},
    {label:'Last 7 days',value:'week'},{label:'Last 30 days',value:'month'},
  ],{title:'NetClaw recorded usage',placeHolder:'External assistant inference is billed by that client and is excluded here'});if(!selection)return;
  // Verify the binding after the dialog, before creating a view for that result.
  const args={domain:'usage',...(selection.value?{window:selection.value}:{})};
  await call('operator_identity');
  openDataView(context,connection,{title:`Tokenomics · ${selection.label}`,kind:'tokenomics',load:()=>call('operator_snapshot',args)});
}

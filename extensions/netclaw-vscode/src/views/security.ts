import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';

export async function openSecurity(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection);
  const choice=await vscode.window.showQuickPick([
    {label:'Guard configuration and observed posture',value:'status'},
    {label:'Retained component scans',value:'scans'},
    {label:'Tool rules',value:'rules'},
    {label:'Security events',value:'events'},
    {label:'Review guard mode change',value:'settings'},
  ],{title:'DefenseClaw'});if(!choice)return;
  if(choice.value==='settings'){
    const {data}=await call<{data:{revision:string;defenseclaw:{available:boolean;reason?:string;settings?:{supported:boolean;modes:string[];effect:string}}}}>('operator_snapshot',{domain:'security'});
    if(!data.defenseclaw.available||!data.defenseclaw.settings?.supported)throw Error(data.defenseclaw.reason||data.defenseclaw.settings?.effect||'No qualified component settings adapter is available.');
    const mode=await vscode.window.showQuickPick(data.defenseclaw.settings.modes,{title:'Stored guard mode',placeHolder:data.defenseclaw.settings.effect});if(!mode)return;
    const prepared=await call<{proposalId:string}>('operator_change_prepare',{nonce:`${Date.now()}:${randomUUID()}`,action:'security.patch',targets:[connection.identity!.installationId],expectedRevision:data.revision,patch:{mode}});
    await vscode.commands.executeCommand('netclaw.reviewProposal',prepared.proposalId);return;
  }
  openDataView(context,connection,{title:`DefenseClaw · ${choice.label}`,kind:'security',load:async()=>{
    const result=await call<{data:Record<string,unknown>;source:string;observedAt:string}>('operator_snapshot',{domain:'security'});
    if(choice.value==='status')return {...result,interpretation:'Stored configuration and the selected daemon’s observations are shown separately. Reported enforcement applies to federation preflight; stale reports and missing controls require investigation.'};
    const component=result.data.defenseclaw as {available:boolean;reason?:string;history?:{available:boolean;source?:string;scope?:string;reason?:string;[key:string]:unknown}};
    return {source:component.history?.source||result.source,observedAt:result.observedAt,scope:component.history?.scope,
      available:component.available&&component.history?.available,records:component.history?.[choice.value],reason:component.reason||component.history?.reason};
  }});
}

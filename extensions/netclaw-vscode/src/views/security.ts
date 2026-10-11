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
    {label:'Review connector tool rule',value:'tool-rule'},
  ],{title:'DefenseClaw'});if(!choice)return;
  if(choice.value==='tool-rule'){
    const identity=await call<{installationId:string;configurationRevision:string}>('operator_identity',{});
    const tool=await vscode.window.showInputBox({title:'Exact runtime tool name',prompt:'Applies only to this installation’s bound DefenseClaw connector. Enter the name seen by that runtime, without a source or connector prefix.',ignoreFocusOut:true,validateInput:value=>/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/.test(value)?undefined:'Enter a tool name up to 128 characters, without slashes or spaces.'});if(tool===undefined)return;
    if(!/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/.test(tool))throw Error('Invalid runtime tool name.');
    const {data}=await call<{data:{installationId:string;connector:string;tool:string;revision:string;effective:string;fallback:string;scope:string}}>('operator_workspace',{action:'security-rule',args:{tool}});
    if(data.installationId!==identity.installationId||data.tool!==tool)throw Error('Tool policy destination changed. Refresh and review again.');
    const selected=await vscode.window.showQuickPick([
      {label:'Block',policy:'block',description:'Block matching calls for this connector'},
      {label:'Allow',policy:'allow',description:'Bypass rule/pattern/judge scans; clear scoped logical file/runtime flags'},
      {label:'Inherit global policy',policy:'inherit',description:`Global fallback currently resolves to ${data.fallback}`},
    ],{title:`${data.connector} · ${tool} · stored policy ${data.effective}`});if(!selected)return;
    if(await vscode.window.showWarningMessage('Prepare this connector tool policy change?',{modal:true,detail:`Installation: ${identity.installationId}\nConnector: ${data.connector}\nTool: ${tool}\nPolicy: ${selected.policy}\n\n${data.scope}\nAlready dispatched work may continue. No file is moved or restored.`},'Prepare tool rule review')!=='Prepare tool rule review')return;
    const prepared=await call<{proposalId:string}>('operator_change_prepare',{nonce:`${Date.now()}:${randomUUID()}`,action:'security.tool-rule',targets:[identity.installationId],expectedRevision:identity.configurationRevision,patch:{tool,policy:selected.policy,expectedRuleRevision:data.revision}});
    await vscode.commands.executeCommand('netclaw.reviewProposal',prepared.proposalId);return;
  }
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

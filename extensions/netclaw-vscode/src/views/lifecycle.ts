import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';

type Service={id:string;available:boolean;active?:boolean;manager?:string;unit?:string;reason?:string;message?:string};
export async function configureService(connection:Connection):Promise<void>{
  const call=boundCaller(connection),installationId=connection.identity?.installationId;
  if(!installationId)throw Error('Connect to an existing installation first.');
  const {data}=await call<{data:{revision:string;services:Service[]}}>('operator_snapshot',{domain:'settings'});
  const selected=await vscode.window.showQuickPick(data.services.map(service=>({label:service.id,description:service.available?`${service.active?'Running':'Stopped'} · ${service.manager}`:service.reason||service.message,service})),{title:'Installation-owned services'});if(!selected)return;
  if(!selected.service.available)throw Error(selected.service.reason||selected.service.message||'This service has no qualified management binding.');
  const action=await vscode.window.showQuickPick(['start','stop','restart'],{title:`${selected.label} · ${selected.service.unit}`});if(!action)return;
  const disruptive=action!=='start';
  if(disruptive&&await vscode.window.showWarningMessage(`Prepare ${action} for this service?`,{modal:true,detail:`Installation: ${installationId}\nService manager: ${selected.service.manager}\nExact unit: ${selected.service.unit}\nActive or unknown jobs may be interrupted. The proposal will capture known management work; jobs started elsewhere are unknown. You will review the full proposal before any process change.`},'Prepare service review')!=='Prepare service review')return;
  const proposal=await call<{proposalId:string}>('operator_change_prepare',{nonce:`${Date.now()}:${randomUUID()}`,action:`service.${action}`,targets:[installationId],expectedRevision:data.revision,
    patch:{serviceId:selected.service.id,...(disruptive?{acknowledgeActiveWork:true}:{})}});
  await vscode.commands.executeCommand('netclaw.reviewProposal',proposal.proposalId);
}

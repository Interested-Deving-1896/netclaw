import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';

/** Environment values stay out of saved documents and webviews. Secrets are
 * requested only in the independent proposal-application review. */
export async function prepareEnvironmentChange(connection:Connection,keys?:string[]):Promise<void>{
  const call=boundCaller(connection),installationId=connection.identity?.installationId;
  if(!installationId)throw Error('Connect to an installation first.');
  const snapshot=await call<{data:{revision:string;environment:{managedFields:{key:string;secret:boolean}[]}}}>('operator_snapshot',{domain:'settings'});
  const fields=snapshot.data.environment.managedFields.filter(field=>!keys||keys.includes(field.key));
  if(!fields.length){void vscode.window.showInformationMessage('This integration has no supported environment change adapter. Review its backend setup guide.');return;}
  const selected=await vscode.window.showQuickPick(fields.map(field=>({label:field.key,description:field.secret?'Secret · presence only':'Configuration value',field})),{title:'Choose a managed environment field'});if(!selected)return;
  const intent=await vscode.window.showQuickPick(['keep','replace','clear'],{title:`${selected.label}: desired change`});if(!intent)return;
  if(intent==='keep'){void vscode.window.showInformationMessage('The existing value will be kept. No change was prepared.');return;}
  let value:string|undefined;
  if(!selected.field.secret&&intent==='replace'){value=await vscode.window.showInputBox({title:`New ${selected.label}`});if(value===undefined)return;}
  const prepared=await call<{proposalId:string}>('operator_change_prepare',{nonce:`${Date.now()}:${randomUUID()}`,action:'integration.configure',targets:[installationId],expectedRevision:snapshot.data.revision,patch:{fields:[{key:selected.label,intent,...(value===undefined?{}:{value})}]}});
  await vscode.commands.executeCommand('netclaw.reviewProposal',prepared.proposalId);
}

import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';
import {Profiles} from '../state/profiles';
import {AssistantProvider} from './provider';
import {ClientGrant,Registration,terminalPreview} from './registration';
const nonce=()=>`${Date.now()}:${randomUUID()}`;

export async function manageAssistant(connection:Connection,profiles:Profiles,provider:AssistantProvider):Promise<void>{
  const call=boundCaller(connection),profile=profiles.list().find(p=>p.id===connection.profile?.id);
  if(!profile?.installationId)throw Error('Connect and bind this installation first.');
  const choice=await vscode.window.showQuickPick(['Connect an assistant','Review or revoke a grant'],{title:'NetClaw assistant access'});if(!choice)return;
  if(choice==='Review or revoke a grant'){
    const {data}=await call<{data:{items:ClientGrant[]}}>('operator_resources',{kind:'client',limit:500});
    const selected=await vscode.window.showQuickPick(data.items.map(grant=>({label:`${grant.client} · ${grant.status}`,description:grant.grantId,grant})),{title:'Installation client grants'});if(!selected)return;
    const grant=selected.grant;
    const action=await vscode.window.showQuickPick(['Review setup','Hide from Copilot discovery','Revoke backend access'],{title:`${grant.client} · ${grant.grantId}`});
    if(action==='Hide from Copilot discovery'){await provider.forget(profile.id,grant.grantId);await provider.refresh();return;}
    if(action==='Revoke backend access'){
      if(await vscode.window.showWarningMessage('Revoke this assistant’s access?',{modal:true,detail:`Grant: ${grant.grantId}\nInstallation: ${profile.installationId}\nCached clients will be refused by the backend. Any in-flight work must still be reconciled.`},'Revoke')!=='Revoke')return;
      await call('operator_client_revoke',{grantId:grant.grantId,nonce:nonce()});await provider.forget(profile.id,grant.grantId);await provider.refresh();return;
    }
    if(action==='Review setup')await registrationPreview({profile,grant,enabled:true},provider);
    return;
  }
  const client=await vscode.window.showQuickPick(['copilot','claude-code','codex'] as const,{title:'Assistant client'});if(!client)return;
  const permission=await vscode.window.showQuickPick([
    {label:'Inspect and propose changes',actions:['inspect','propose','evidence'],description:'Human review is required to apply any proposal'},
    {label:'Inspect only',actions:['inspect','evidence'],description:'Inventory, status and scoped evidence'},
  ],{title:'Assistant permissions',placeHolder:'Runtime delegation remains unavailable until the backend qualifies scoped execution'});if(!permission)return;
  const lifetime=await vscode.window.showQuickPick([{label:'1 day',days:1},{label:'7 days',days:7},{label:'30 days',days:30}],{title:'Grant expiry'});if(!lifetime)return;
  const proposal=await call<{proposalId:string;expectedRevision:string;disclosureNotice:string}>('operator_client_prepare',{
    nonce:nonce(),client,actions:permission.actions,targets:[profile.installationId],disclosure:['summary','usage'],expiresAt:Date.now()+lifetime.days*86400000,
  });
  if(await vscode.window.showInformationMessage(`Allow ${client} to access this NetClaw?`,{modal:true,
    detail:`Installation: ${profile.installationId}\nHost: ${profile.context}\nPermissions: ${permission.actions.join(', ')}\nDisclosure: summaries and this grant’s NetClaw usage\nExpiry: ${lifetime.days} days\n${proposal.disclosureNotice}\nThis creates a backend credential in its private .env. No credential value enters client configuration. Delegation is not enabled.`},'Create reviewed grant')!=='Create reviewed grant')return;
  const result=await call<{state:string;result?:{grantId:string}}>('operator_client_apply',{proposalId:proposal.proposalId,expectedRevision:proposal.expectedRevision,nonce:nonce()});
  if(result.state!=='succeeded'||!result.result?.grantId)throw Error('Grant creation did not complete. Review backend operations before retrying.');
  const {data}=await call<{data:{items:ClientGrant[]}}>('operator_resources',{kind:'client',limit:500});
  const grant=data.items.find(value=>value.grantId===result.result!.grantId);if(!grant)throw Error('Created grant was not returned by this installation.');
  await registrationPreview({profile,grant,enabled:true},provider);
}

async function registrationPreview(registration:Registration,provider:AssistantProvider):Promise<void>{
  if(registration.grant.client==='copilot'){
    if(await vscode.window.showInformationMessage('Make this grant discoverable by Copilot?',{modal:true,detail:'VS Code may ask for MCP trust. Copilot availability and account policy are managed by VS Code. This opt-in adds no workspace configuration.'},'Enable discovery')!=='Enable discovery')return;
    await provider.remember(registration);await provider.refresh();
    void vscode.window.showInformationMessage('NetClaw is now available in VS Code MCP server discovery. Inspect its tool list and start it in the MCP interface.');return;
  }
  const content=terminalPreview(registration),document=await vscode.workspace.openTextDocument({content,language:'shellscript'});
  await vscode.window.showTextDocument(document,{preview:false});
}

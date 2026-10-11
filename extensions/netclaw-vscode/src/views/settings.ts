import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';

type Settings={revision:string;runtimeSelection?:{available:boolean;reason?:string;effect:string;choices:{id:string;harness:string;home:string;available:boolean;selected?:boolean;reason?:string;activeWork?:number}[]};risk?:{available:boolean;configuredRole:string|null;observedRole:string|null;riskName?:string;reason?:string;effect:string;activeWork?:unknown[];choices:{role:string;available:boolean;reason?:string}[]};managed:{runtime:'openclaw'|'hermes';providers:{id:string;models:string[]}[];model?:string;provider?:string;budget:{supported:boolean;reason?:string;fields?:string[];environmentOverrideSet?:boolean};legacyCredentials:boolean}};

/** Native dialogs keep password input and managed actions outside webviews. */
export async function configureSettings(connection:Connection):Promise<void>{
  const call=boundCaller(connection),installationId=connection.identity?.installationId;
  if(!installationId)throw Error('Connect to an installation first.');
  const {data}=await call<{data:Settings}>('operator_snapshot',{domain:'settings'});
  const selection=await vscode.window.showQuickPick([
    {label:'Provider and model',value:'model',description:'Choose from this installation’s configured provider models'},
    {label:'Session budget',value:'budget',description:data.managed.budget.supported?'Stored policy; effective state requires verification':data.managed.budget.reason},
    {label:'Normalize legacy credentials',value:'credentials',description:'Review moving existing credential values into backend .env references'},
    {label:'Standalone / Risk role',value:'role',description:data.risk?.available?`Saved: ${data.risk.configuredRole||'unset'} · Running: ${data.risk.observedRole}`:'Requires the existing federation daemon and Risk configuration'},
    {label:'Default harness for future launches',value:'runtime',description:'Select among explicitly registered existing installations'},
  ],{title:'NetClaw settings'});
  if(!selection)return;
  let action='settings.patch',patch:Record<string,unknown>,targets=[installationId];
  if(selection.value==='runtime'){
    const runtime=data.runtimeSelection;if(!runtime?.available)throw Error(runtime?.reason||'Register existing runtime installations first.');
    const chosen=await vscode.window.showQuickPick(runtime.choices.map(choice=>({label:`${choice.harness} · ${choice.id}`,description:choice.available?`${choice.selected?'Current default · ':''}${choice.home}`:choice.reason,choice})),{title:'Existing runtime installations'});if(!chosen)return;
    if(!chosen.choice.available)throw Error(chosen.choice.reason||'This runtime is unavailable.');
    if(await vscode.window.showWarningMessage(`Prepare ${chosen.choice.harness} as the future launch default?`,{modal:true,detail:`Target: ${chosen.choice.id}\nHome: ${chosen.choice.home}\n${chosen.choice.activeWork??0} active/unknown management requests on the target stay running.\n${runtime.effect}`},'Prepare harness review')!=='Prepare harness review')return;
    action='runtime.select';patch={runtimeId:chosen.choice.id,acknowledgeActiveWork:true};targets=[...new Set([installationId,chosen.choice.id])];
  }else if(selection.value==='role'){
    const risk=data.risk;if(!risk?.available)throw Error(risk?.reason||'A current installation-verified Risk baseline is unavailable.');
    const chosen=await vscode.window.showQuickPick(risk.choices.map(choice=>({label:choice.role,description:choice.available?'Save for next federation restart':choice.reason,choice})),{title:`Existing Risk: ${risk.riskName||'(unnamed)'}`});if(!chosen)return;
    if(!chosen.choice.available)throw Error(chosen.choice.reason||'Complete the existing Risk setup before selecting this role.');
    if(await vscode.window.showWarningMessage(`Prepare saved role ${chosen.choice.role}?`,{modal:true,detail:`Installation: ${installationId}\nRunning role: ${risk.observedRole}\nSaved role: ${risk.configuredRole||'unset'}\n${risk.activeWork?.length??0} active/unknown management requests will stay running.\n${risk.effect}\nThe review will preserve existing Risk metadata and capture affected work. Jobs started elsewhere are unknown.`},'Prepare role review')!=='Prepare role review')return;
    action='risk.role';patch={role:chosen.choice.role,acknowledgeActiveWork:true};
  }else if(selection.value==='credentials'){
    if(!data.managed.legacyCredentials){void vscode.window.showInformationMessage('No supported legacy credential source was found.');return;}
    patch={normalizeCredentials:true};
  }else if(selection.value==='budget'){
    if(!data.managed.budget.supported)throw Error(data.managed.budget.reason||'Budget settings unavailable.');
    const key=await vscode.window.showQuickPick(data.managed.budget.fields||[],{title:'Stored session budget control'});if(!key)return;
    let value:number|boolean;
    if(key==='allowOverride'){const answer=await vscode.window.showQuickPick(['false','true'],{title:'Allow an explicit operator budget override'});if(answer===undefined)return;value=answer==='true';}
    else{
      const answer=await vscode.window.showInputBox({title:key,prompt:data.managed.budget.environmentOverrideSet?'An environment override exists; saving this field alone may not change the effective limit.':'Enter a finite nonnegative limit. This does not reset usage.',validateInput:input=>input.trim()&&Number.isFinite(Number(input))&&Number(input)>=0?undefined:'Enter a finite nonnegative number'});
      if(answer===undefined)return;value=Number(answer);
    }
    action='budget.patch';patch={[key]:value};
  }else if(data.managed.runtime==='openclaw'){
    const choices=data.managed.providers.flatMap(provider=>provider.models.map(model=>({label:`${provider.id}/${model}`,provider:provider.id,model})));
    if(!choices.length)throw Error('No configured provider model is available. Configure the backend through its normal workflow first.');
    const selected=await vscode.window.showQuickPick(choices,{title:'Configured backend model'});if(!selected)return;
    patch={provider:selected.provider,model:selected.model};
  }else{
    const model=await vscode.window.showInputBox({title:'Hermes model',value:data.managed.model,prompt:`Existing provider: ${data.managed.provider||'backend default'}. This saves a pending restart setting; it does not send a provider request.`,validateInput:value=>/^[\w./:-]{1,200}$/.test(value)?undefined:'Enter a valid model identifier'});
    if(model===undefined)return;patch={model};
  }
  const prepared=await call<{proposalId:string}>('operator_change_prepare',{nonce:`${Date.now()}:${randomUUID()}`,action,targets,expectedRevision:data.revision,patch});
  await vscode.commands.executeCommand('netclaw.reviewProposal',prepared.proposalId);
}

import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';

type Pending={nonce:string;installationId:string;hostId:string;principalId:string};
type Device={id:string;name:string;host:string;port:number;protocol:string;supported:boolean};
type State={available:boolean;revision:string;scope:string;reason?:{message:string};devices:Device[];policy:{enabled:boolean;revision:string;devices:{id:string;valid:boolean}[]};operations:{operationId:string;state:string}[]};
const pendingKey='netclaw.intent.pending';

export async function openIntent(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),identity=connection.identity,generation=connection.generation;if(!identity)throw Error('Connect to an existing installation first.');
  const pending=context.workspaceState.get<Pending>(pendingKey);
  if(pending){
    if(pending.installationId!==identity.installationId||pending.hostId!==identity.hostId||pending.principalId!==identity.principalId)throw Error('A Terminal Intent submission is pending on another connection. Reconnect to that original installation to inspect it.');
    const retained=await call<{data:{operation:{operationId:string}|null}}>('operator_resources',{kind:'overview',filters:{query:pending.nonce}});
    if(!retained.data.operation)throw Error('The submitted nonce has no observed admission yet. Keep it pending and inspect the original backend; do not repeat a network request while its outcome is uncertain.');
    const id=retained.data.operation.operationId;await context.workspaceState.update(pendingKey,undefined);
    openDataView(context,connection,{title:'Recovered Terminal Intent',kind:'intent',load:()=>call('operator_workspace',{action:'intent-read',args:{id}})});return;
  }
  const {data:state}=await call<{data:State}>('operator_workspace',{action:'intent-state',args:{}});
  const choice=await vscode.window.showQuickPick([
    {label:'Inspect retained requests',value:'inspect',description:'Owned reports, actual transcript events and unresolved outcomes'},
    {label:'Read-only request',value:'read-only',description:state.available?'Inspect or explain; no configuration authorization':state.reason?.message},
    {label:'Configuration request',value:'change',description:'Existing production approval or exact designated Local/Lab endpoints'},
  ],{title:'NetClaw Terminal Intent'});if(!choice)return;
  if(choice.value==='inspect'){
    const selected=await vscode.window.showQuickPick(state.operations.map(operation=>({label:operation.operationId,description:operation.state,id:operation.operationId})),{title:'Retained Terminal Intent requests'});if(!selected)return;
    openDataView(context,connection,{title:'Terminal Intent evidence',kind:'intent',load:()=>call('operator_workspace',{action:'intent-read',args:{id:selected.id}})});return;
  }
  if(!state.available)throw Error(state.reason?.message||'Terminal Intent is unavailable for this installation.');
  const mode=await vscode.window.showQuickPick([
    {label:'Production',value:'production',description:choice.value==='change'?'Requires an approved ServiceNow CR matching this exact request':'Read-only; no configuration authorization'},
    ...(state.policy.enabled?[{label:'Local / Lab',value:'local-lab',description:'Only endpoints explicitly designated in existing Change control settings'}]:[]),
  ],{title:'Change control for this request'});if(!mode)return;
  const available=state.devices.filter(device=>device.supported&&(mode.value!=='local-lab'||state.policy.devices.some(allowed=>allowed.id===device.id&&allowed.valid)));
  const selected=await vscode.window.showQuickPick(available.map(device=>({label:device.name||device.id,description:`${device.id} · ${device.protocol} ${device.host}:${device.port}`,id:device.id})),{title:'Exact devices for this request',canPickMany:true});if(!selected?.length)return;
  const request=await vscode.window.showInputBox({title:choice.value==='change'?'Explicit configuration task':'Read-only request',prompt:'Describe the task on these selected devices. Use approved secret references; do not enter passwords or keys.',validateInput:value=>value.trim()&&value.length<=4000?undefined:'Enter a request of 1–4000 characters'});if(request===undefined)return;
  const args={request,requestKind:choice.value,changeMode:mode.value,targetDeviceIds:selected.map(device=>device.id),expectedRevision:state.revision,...(mode.value==='local-lab'?{policyRevision:state.policy.revision}:{})};
  const {data:preview}=await call<{data:{scope:string;approval:{actionDigest:string;targets:string[]}|null}}>('operator_workspace',{action:'intent-preview',args});
  openDataView(context,connection,{title:'Terminal Intent scope review',kind:'intent',load:async()=>preview});
  let approvalReference:string|undefined;
  if(preview.approval){
    const supplied=await vscode.window.showInputBox({title:'Approved ServiceNow change reference',prompt:`The live CR must be in Implement and match action digest ${preview.approval.actionDigest}. Review the exact targets in the scope view.`,validateInput:value=>/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(value)&&!value.includes('..')?undefined:'Enter the existing approved change reference'});if(supplied===undefined)return;approvalReference=supplied;
  }
  if(await vscode.window.showWarningMessage(`Submit this ${choice.value==='change'?'configuration':'read-only'} request?`,{modal:true,detail:`Installation: ${identity.installationId}\nMode: ${mode.label}\nDevices: ${args.targetDeviceIds.join(', ')}\nRequest: ${request}\n${preview.scope}\n${state.scope}`},'Submit scoped request')!=='Submit scoped request')return;
  const nonce=`${Date.now()}:${randomUUID()}`;
  if(connection.generation!==generation)throw Error('Connection changed. Review the request again for the selected installation.');
  await context.workspaceState.update(pendingKey,{nonce,installationId:identity.installationId,hostId:identity.hostId,principalId:identity.principalId});
  if(connection.generation!==generation){await context.workspaceState.update(pendingKey,undefined);throw Error('Connection changed before submission. No request was sent.');}
  const operation=await call<{operationId:string}>('operator_workspace',{action:'intent-submit',nonce,args:{...args,...(approvalReference?{approvalReference}:{})}});
  await context.workspaceState.update(pendingKey,undefined);
  openDataView(context,connection,{title:'Terminal Intent execution',kind:'intent',load:()=>call('operator_workspace',{action:'intent-read',args:{id:operation.operationId}})});
}

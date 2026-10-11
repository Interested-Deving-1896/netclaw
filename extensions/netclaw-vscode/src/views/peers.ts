import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';
import {readResourcePages} from './integrations';
import {openDataView} from '../webview/bridge';

type Grant={id:number;target_type:string;target_name:string;requires_approval:number;timeout_s:number|null};
type Policy={revision:string;policy:{identity:string;state:string;chatEnabled:boolean;grants:Grant[];work:unknown[];consent:{local_grant:boolean;remote_grant:boolean}};
  grantCandidates:{type:'tool'|'skill';name:string}[];grantCandidatesAvailable:boolean;grantCandidatesLimit:number};

/** Exact native review of local inbound peer permissions. This command never
 * connects a peer, changes certificate trust, or executes a remote capability. */
export async function openPeers(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),generation=connection.generation,installationId=connection.identity?.installationId;
  const current=()=>{if(generation!==connection.generation)throw Error('Connection changed. Review the selected peer again.');};
  if(!installationId)throw Error('Connect an existing NetClaw first.');
  const estate=await readResourcePages(connection,'peer');current();
  const selected=await vscode.window.showQuickPick(estate.items.map(row=>({label:row.label||row.id,description:row.id,detail:row.state,item:row})),{title:'Existing external peer permissions',matchOnDescription:true});
  if(!selected)return;current();const peer=selected.item.id;
  const {data}=await call<{data:Policy}>('operator_workspace',{action:'peer-policy',args:{id:peer}});
  if(data.policy.identity!==peer)throw Error('Peer identity changed. Refresh the estate.');
  const federated=data.policy.state==='federated'&&data.policy.consent.local_grant&&data.policy.consent.remote_grant;
  const choices=[{label:'Inspect local permissions',value:'inspect',description:'Received peer identity, current grants and known work'},
    ...(data.policy.chatEnabled?[{label:'Disable peer chat admission',value:'disable',description:'Already dispatched work may continue'}]:federated?[{label:'Enable peer chat admission',value:'enable',description:'Existing mutual federation consent is required'}]:[]),
    ...(federated&&data.grantCandidatesAvailable&&data.grantCandidates.length?[{label:'Grant one local tool or skill',value:'grant',description:'Each invocation still requires existing NCFED approval'}]:[]),
    ...(data.policy.grants.length?[{label:'Revoke selected invocation grants',value:'revoke',description:'Unselected grants and peer certificate trust are preserved'}]:[])];
  const action=await vscode.window.showQuickPick(choices,{title:`Peer: ${peer}`});if(!action)return;current();
  if(action.value==='inspect'){
    openDataView(context,connection,{title:'Peer permissions',kind:'peer-policy',load:()=>call('operator_workspace',{action:'peer-policy',args:{id:peer}})});return;
  }
  let managedAction='peer.trust';const patch:Record<string,unknown>={acknowledgeActiveWork:true};
  if(action.value==='enable')patch.chatEnabled=true;
  if(action.value==='disable'){managedAction='peer.untrust';patch.disableChat=true;}
  if(action.value==='grant'){
    const candidates=data.grantCandidates.filter(row=>!data.policy.grants.some(grant=>grant.target_type===row.type&&grant.target_name===row.name));
    const target=await vscode.window.showQuickPick(candidates.map(row=>({label:row.name,description:row.type,row})),{title:'Exact local grant target',placeHolder:`Up to ${data.grantCandidatesLimit} local candidates. Execution qualification and per-request approval remain required.`});
    if(!target)return;current();
    const timeout=await vscode.window.showInputBox({title:'Invocation timeout in seconds',value:'30',validateInput:value=>/^\d+$/.test(value)&&Number(value)>=1&&Number(value)<=600?undefined:'Enter an integer from 1 to 600.'});
    if(timeout===undefined)return;current();if(!/^\d+$/.test(timeout)||Number(timeout)<1||Number(timeout)>600)throw Error('Invalid invocation timeout.');
    patch.grant={type:target.row.type,name:target.row.name,requiresApproval:true,timeoutSeconds:Number(timeout)};
  }
  if(action.value==='revoke'){
    const grants=await vscode.window.showQuickPick(data.policy.grants.map(grant=>({label:`${grant.target_type} · ${grant.target_name}`,description:`Grant ${grant.id}`,grant})),{title:'Exact grants to revoke',canPickMany:true});
    if(!grants?.length)return;current();if(grants.length>100)throw Error('Review at most 100 grant revocations per change.');
    managedAction='peer.untrust';patch.revokeGrantIds=grants.map(row=>row.grant.id);
  }
  const detail=`Installation: ${installationId}\nPeer: ${peer}\n${data.policy.work.length} known active/uncertain tasks; already dispatched work may continue.\nOnly these local permissions will change. Peer consent, certificate pins, endpoints and BGP remain unchanged. No peer is contacted. Rollback cannot undo previously executed work.\n${JSON.stringify(patch,null,2)}`;
  if(await vscode.window.showWarningMessage('Prepare this exact peer permission change?',{modal:true,detail},'Prepare permission review')!=='Prepare permission review')return;current();
  const proposal=await call<{proposalId:string}>('operator_change_prepare',{nonce:`${Date.now()}:${randomUUID()}`,action:managedAction,targets:[installationId,peer],expectedRevision:data.revision,patch});
  current();await vscode.commands.executeCommand('netclaw.reviewProposal',proposal.proposalId);
}

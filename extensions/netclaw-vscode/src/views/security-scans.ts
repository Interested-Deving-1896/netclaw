import * as vscode from 'vscode';
import {randomUUID} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';
import {readResourcePages} from './integrations';

type Operation={operationId:string;kind:string;state:string;result?:unknown};
type Pending={nonce:string;operationId?:string};
type Inventory={scanner:{bound:boolean;reason?:string};reports:{id:string;name:string;state:string}[];operations:Operation[];nextCursor?:string;scope:string};
const nonce=()=>`${Date.now()}:${randomUUID()}`;
const terminal=new Set(['succeeded','failed','cancelled','denied','expired']);

export async function openSecurityScans(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),identity=connection.identity,generation=connection.generation;
  if(!identity)throw Error('Connect an existing NetClaw first.');
  const current=()=>{if(connection.generation!==generation)throw Error('Connection changed. Review the skill again.');};
  const key=`security-scan.pending.${identity.hostId}.${identity.installationId}.${identity.principalId}`;
  const show=async(content:string)=>{current();const document=await vscode.workspace.openTextDocument({content,language:'plaintext'});current();await vscode.window.showTextDocument(document,{preview:true,preserveFocus:true,viewColumn:vscode.ViewColumn.Beside});current();};
  const inspect=async(id:string)=>{
    const operation=await call<Operation>('operator_operation_get',{operationId:id});
    if(operation.kind!=='defense-scan')throw Error('This receipt belongs to another request kind.');
    await show(`Local static skill scan\nRequest: ${id}\nState: ${operation.state}\nFindings are untrusted analysis, not proof of safety or enforcement.\n\n${JSON.stringify(operation.result??{},null,2)}`);
    if(['admitted','running','cancellation-requested'].includes(operation.state)&&await vscode.window.showInformationMessage('The scan is pending. Cancellation stops only its owned scanner process.','Cancel scan')==='Cancel scan'){
      current();await call('operator_cancel_request',{operationId:id,nonce:nonce()});
    }
    return operation;
  };
  const pending=context.globalState.get<Pending>(key);
  if(pending){
    const operation=pending.operationId?await call<Operation>('operator_operation_get',{operationId:pending.operationId}):(await call<{data:{operation?:Operation}}>('operator_resources',{kind:'overview',filters:{query:pending.nonce}})).data.operation;
    if(!operation){await vscode.window.showInformationMessage('Scan admission is unconfirmed. Reopen this view to check its receipt; the scan will not be submitted again.');return;}
    const value=await inspect(operation.operationId);if(terminal.has(value.state)){current();await context.globalState.update(key,undefined);}return;
  }
  let cursor:string|undefined;
  while(true){
    const response:{data:Inventory}=await call('operator_workspace',{action:'security-scan-list',args:{},limit:100,...(cursor?{cursor}:{})});const inventory:Inventory=response.data;
    const choice=await vscode.window.showQuickPick([
      ...(inventory.scanner.bound?[{label:'Review a new local skill scan',id:'__new',choiceType:'new'}]:[]),
      ...inventory.operations.filter(row=>!terminal.has(row.state)).map(row=>({label:`${row.state} · ${row.operationId}`,id:row.operationId,choiceType:'operation'})),
      ...inventory.reports.map(row=>({label:`${row.name} · ${row.state}`,description:row.id,id:row.id,choiceType:'report'})),
      ...(inventory.nextCursor?[{label:'Older scan reports',id:'__older',choiceType:'older'}]:[]),
    ],{title:'Local static skill scans',placeHolder:inventory.scanner.bound?inventory.scope:inventory.scanner.reason});
    if(!choice)return;current();
    if(choice.choiceType==='older'){cursor=inventory.nextCursor;continue;}
    if(choice.choiceType==='operation'){await inspect(choice.id);return;}
    if(choice.choiceType==='report'){
      const {data}=await call<{data:unknown}>('operator_workspace',{action:'security-scan-read',args:{id:choice.id}});
      await show(`Local static skill scan\nFindings are untrusted analysis, not proof of safety or enforcement.\n\n${JSON.stringify(data,null,2)}`);return;
    }
    break;
  }
  const skills=await readResourcePages(connection,'skill');current();
  const selected=await vscode.window.showQuickPick(skills.items.map(row=>({label:row.id,id:row.id})),{title:'Installed skill to scan',placeHolder:skills.partial?`Showing ${skills.items.length} of ${skills.total} installed skills`:'Select the exact installed skill'});
  if(!selected)return;current();
  const {data:review}=await call<{data:{reviewId:string;name:string;profile:string;sourceRevision:string;files:{path:string;sha256:string}[];bytes:number;omittedEntries:number;disclosure:string}}>('operator_workspace',{action:'security-scan-preview',args:{name:selected.id}});
  if(review.name!==selected.id)throw Error('Reviewed skill changed. Refresh and review again.');
  await show(`Review local static scan\nInstallation: ${identity.installationId}\nSkill: ${review.name}\nProfile: ${review.profile}\nSnapshot: ${review.sourceRevision}\nFiles: ${review.files.length}\nBytes: ${review.bytes}\nOmitted entries/subtrees: ${review.omittedEntries}\n\n${review.disclosure}\n\n${review.files.map(file=>`${file.sha256}  ${file.path}`).join('\n')}`);
  if(await vscode.window.showWarningMessage('Scan this reviewed skill snapshot?',{modal:true,detail:`Installation: ${identity.installationId}\nSkill: ${review.name}\n${review.files.length} files / ${review.bytes} bytes\n\n${review.disclosure}`},'Run reviewed static scan')!=='Run reviewed static scan')return;
  current();const next:Pending={nonce:nonce()};await context.globalState.update(key,next);current();
  const operation=await call<Operation>('operator_workspace',{action:'security-scan-submit',nonce:next.nonce,args:{reviewId:review.reviewId}});
  await context.globalState.update(key,{...next,operationId:operation.operationId});
  await vscode.window.showInformationMessage(`Scan ${operation.operationId} is ${operation.state}. Reopen Local Static Skill Scans to inspect its report.`);
}

import * as vscode from 'vscode';
import {randomUUID,createHash} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';

type Member={id:string;label:string;enrolled:boolean;connected:boolean;enrollmentState:string;capabilities:string[]};
type Inventory={items:Member[];captureSupported:boolean;limitation:string};
type Media={bytes:number;sha256:string;contentType:string};
type Operation={operationId:string;kind:string;state:string;result?:{decision?:string;media?:Media}};
type Pending={nonce:string;operationId?:string};
const nonce=()=>`${Date.now()}:${randomUUID()}`;
const finished=new Set(['succeeded','failed','cancelled','denied','expired']);

export async function saveCapture(connection:Connection,operation:Operation):Promise<void>{
  const call=boundCaller(connection),media=operation.result?.media;
  if(operation.kind!=='mobile-capture'||operation.state!=='succeeded'||operation.result?.decision!=='captured'||!media||!Number.isInteger(media.bytes)||media.bytes<=0||media.bytes>6*1024*1024||!/^([a-f0-9]{64})$/.test(media.sha256))throw Error('No verified captured media is available for this operation.');
  const destination=await vscode.window.showSaveDialog({saveLabel:'Save reviewed capture',title:`${media.contentType} · ${media.bytes} bytes · ${media.sha256}`,filters:{'Captured media':['bin','png','jpg','wav','m4a']}});if(!destination)return;
  const chunks:Buffer[]=[];let offset=0;
  while(offset<media.bytes){
    const {data}=await call<{data:Media&{offset:number;nextOffset:number|null;content:string}}>('operator_workspace',{action:'mobile-capture-content',args:{id:operation.operationId,offset}});
    if(data.offset!==offset||data.sha256!==media.sha256||data.bytes!==media.bytes||data.contentType!==media.contentType||typeof data.content!=='string'||data.content.length>44000)throw Error('Captured media changed or exceeded its bound.');
    const bytes=Buffer.from(data.content,'base64');if(!bytes.length||bytes.length>32768||bytes.toString('base64')!==data.content)throw Error('Captured media chunk is invalid.');
    offset+=bytes.length;if(offset>media.bytes||data.nextOffset!==(offset<media.bytes?offset:null))throw Error('Captured media sequence changed.');chunks.push(bytes);
  }
  const bytes=Buffer.concat(chunks);if(createHash('sha256').update(bytes).digest('hex')!==media.sha256)throw Error('Captured media failed its integrity check.');
  await call('operator_operation_get',{operationId:operation.operationId});
  await vscode.workspace.fs.writeFile(destination,bytes);
  await vscode.window.showInformationMessage('The reviewed capture was saved locally. It has not been sent to a model or added to context.');
}

export async function openMobile(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  const call=boundCaller(connection),identity=connection.identity;if(!identity)throw Error('Connect to an existing installation first.');
  const key=`mobile.pending.${identity.hostId}.${identity.installationId}.${identity.principalId}`;
  const show=async(value:unknown)=>{const document=await vscode.workspace.openTextDocument({content:JSON.stringify(value,null,2),language:'json'});await vscode.window.showTextDocument(document,{preview:true,preserveFocus:true,viewColumn:vscode.ViewColumn.Beside});};
  const inspect=async(operation:Operation)=>{
    const current=await call<Operation>('operator_operation_get',{operationId:operation.operationId});await show(current);
    if(current.state==='succeeded'&&current.result?.decision==='captured'){
      if(await vscode.window.showInformationMessage('Save a local copy of this capture?','Review and save')==='Review and save'){
        await call('operator_operation_get',{operationId:current.operationId});await saveCapture(connection,current);
      }
    }else if(['admitted','running','cancellation-requested'].includes(current.state)){
      if(await vscode.window.showInformationMessage('This phone capture is still pending. Cancellation cannot undo a capture already sent to the device.','Request cancellation')==='Request cancellation')await call('operator_cancel_request',{operationId:current.operationId,nonce:nonce()});
    }
    return current;
  };
  const pending=context.globalState.get<Pending>(key);
  if(pending){
    const operation=pending.operationId?await call<Operation>('operator_operation_get',{operationId:pending.operationId}):(await call<{data:{operation?:Operation}}>('operator_resources',{kind:'overview',filters:{query:pending.nonce}})).data.operation;
    if(!operation){await vscode.window.showInformationMessage('Capture admission is unconfirmed. Reopen this view to reconcile it; it will not be resent.');return;}
    const current=await inspect(operation);if(finished.has(current.state))await context.globalState.update(key,undefined);return;
  }
  const {data:inventory}=await call<{data:Inventory}>('operator_workspace',{action:'mobile-inventory',args:{}});
  const selected=await vscode.window.showQuickPick([...inventory.items.map(row=>({label:row.label,description:`${row.enrolled?'Enrolled':'Not enrolled'} · ${row.connected?'Connected':'Offline'} · ${row.enrollmentState}`,id:row.id})),{label:'Retained capture operations',description:'Inspect status or explicitly save captured media',id:'__history'}],{title:'Mobile and edge — enrollment and connectivity'});if(!selected)return;
  if(selected.id==='__history'){
    const {data}=await call<{data:{operations:Operation[]}}>('operator_resources',{kind:'overview'});
    const chosen=await vscode.window.showQuickPick(data.operations.filter(row=>row.kind==='mobile-capture').map(row=>({label:`${row.state} · ${row.result?.decision||'Capture'}`,description:row.operationId,operation:row})),{title:'Owned mobile capture history'});if(chosen)await inspect(chosen.operation);return;
  }
  const member=inventory.items.find(row=>row.id===selected.id);if(!member)return;await show({...member,limitation:inventory.limitation});
  if(!inventory.captureSupported||!member.enrolled||!member.connected){await vscode.window.showInformationMessage(inventory.captureSupported?'This device must be enrolled and connected before requesting its consent.':inventory.limitation);return;}
  const capability=await vscode.window.showQuickPick(member.capabilities.filter(value=>['camera.capture','audio.record'].includes(value)),{title:'Request a device-advertised capture capability'});if(!capability)return;
  const preview=(await call<{data:{consentReference:string;label:string;notice:string}}>('operator_workspace',{action:'mobile-capture-preview',args:{id:member.id,capability}})).data;
  if(await vscode.window.showInformationMessage(`Request ${capability} from ${preview.label}?`,{modal:true,detail:`Device: ${member.id}\nInstallation: ${identity.installationId}\n${preview.notice}`},'Request phone consent')!=='Request phone consent')return;
  await call('operator_workspace',{action:'mobile-inventory',args:{}});
  const next:Pending={nonce:nonce()};await context.globalState.update(key,next);
  const admitted=await call<Operation>('operator_workspace',{action:'mobile-capture-request',nonce:next.nonce,args:{id:member.id,capability,consentReference:preview.consentReference}});
  await context.globalState.update(key,{...next,operationId:admitted.operationId});
  await vscode.window.showInformationMessage(`Capture request ${admitted.operationId} is ${admitted.state}. Reopen Mobile and Edge to inspect the phone’s decision.`);
}

import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';

/** Select settings for a new owned conversation; no runtime call is made here. */
export async function chooseConversationSettings(connection:Connection):Promise<{model?:string;effort?:string}|undefined>{
  const call=boundCaller(connection),generation=connection.generation;
  const check=()=>{if(generation!==connection.generation)throw Error('Connection changed. Review model settings for the intended installation again.');};
  const {data}=await call<{data:{conversation:{models:{id:string;efforts:string[]}[];reason?:string}}}>('operator_snapshot',{domain:'settings'});
  const models=data.conversation.models;
  const selected=await vscode.window.showQuickPick([{label:'Configured runtime default',model:undefined as typeof models[number]|undefined},...models.map(model=>({label:model.id,model}))],
    {title:'New NetClaw conversation model',placeHolder:data.conversation.reason||'The gateway verifies your explicit model and effort before inference.'});
  if(!selected)return;
  check();if(!selected.model)return {};
  let effort:string|undefined;
  if(selected.model.efforts.length){
    const choice=await vscode.window.showQuickPick(['Runtime default',...selected.model.efforts],{title:'Reasoning effort for this model'});
    if(!choice)return;check();if(choice!=='Runtime default')effort=choice;
  }
  return {model:selected.model.id,...(effort?{effort}:{})};
}

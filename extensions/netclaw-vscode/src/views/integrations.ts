import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';
import {prepareEnvironmentChange} from './configuration';

export type Resource={id:string;label?:string;state?:string;harness?:{type:string;version:string|null};stale?:boolean|null;inventory?:{available:boolean;detail:boolean;truncated:boolean;error?:string|null};notes?:string;registered?:boolean;installed?:boolean;reachable?:boolean|null;executionVerified?:boolean|null;configuration?:{key:string;isSet:boolean}[];source:string};
type Page={data:{items:Resource[];total:number;nextCursor?:string};source:string;observedAt:string;warnings:string[]};
export async function readResourcePages(connection:Connection,kind:'integration'|'skill'|'member'|'peer'|'edge'){
  const call=boundCaller(connection),items:Resource[]=[],seen=new Set<string>(),ids=new Set<string>();let cursor:string|undefined,last:Page|undefined,pages=0;
  do{
    if(cursor){if(seen.has(cursor))throw Error('Inventory cursor repeated. Refresh the selected installation.');seen.add(cursor);}
    last=await call<Page>('operator_resources',{kind,limit:250,...(cursor?{cursor}:{})});
    if(!Array.isArray(last.data.items)||last.data.items.length>250||last.data.items.some(item=>typeof item.id!=='string'))throw Error('The backend returned an invalid inventory page.');
    for(const item of last.data.items){if(ids.has(item.id))throw Error('Inventory changed during paging. Refresh the selected installation.');ids.add(item.id);}
    items.push(...last.data.items);cursor=last.data.nextCursor;pages++;
  }while(cursor&&items.length<2000&&pages<8);
  return {items,source:last!.source,observedAt:last!.observedAt,warnings:last!.warnings,total:last!.data.total,partial:Boolean(cursor)};
}
export async function openIntegrations(context:vscode.ExtensionContext,connection:Connection,kind:'integration'|'skill'='integration'):Promise<void>{
  const generation=connection.generation;
  const inventory=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Reading selected NetClaw inventory'},()=>readResourcePages(connection,kind));
  if(generation!==connection.generation)throw Error('Connection changed. Reopen the inventory.');
  const choice=await vscode.window.showQuickPick(inventory.items.map(item=>({label:item.id,description:kind==='skill'?'Installed definition; execution not verified':`${item.registered?'Registered':'Not registered'} · reachability ${item.reachable===true?'observed':'unknown'}`,detail:item.notes,item})),
    {title:kind==='skill'?'Installed NetClaw skills':'NetClaw integrations',matchOnDescription:true,matchOnDetail:true,placeHolder:inventory.partial?`Showing ${inventory.items.length} of ${inventory.total}; this result is bounded.`:`${inventory.items.length} entries · ${inventory.source}`});
  if(!choice)return;if(generation!==connection.generation)throw Error('Connection changed. Reopen the inventory.');
  const view=()=>openDataView(context,connection,{title:choice.item.id,kind:'integration',load:async()=>({resource:choice.item,source:inventory.source,observedAt:inventory.observedAt,warnings:inventory.warnings})});
  if(kind==='skill'||!choice.item.configuration?.length){view();return;}
  const action=await vscode.window.showQuickPick(['Inspect observed metadata','Prepare environment change'],{title:choice.item.id});
  if(generation!==connection.generation)throw Error('Connection changed. Review the integration again.');
  if(action==='Inspect observed metadata')view();
  if(action==='Prepare environment change')await prepareEnvironmentChange(connection,choice.item.configuration.map(field=>field.key));
}

import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
import {openDataView} from '../webview/bridge';
import {readResourcePages,Resource} from './integrations';

type Group='member'|'peer'|'edge'|'advisor';
type Node={label:string;generation:number;group?:Group;resourceKind?:'member'|'peer'|'edge';resource?:Resource;observedAt?:string;source?:string;description?:string;error?:string;command?:string};
/** Lazy native inventory: one unavailable federation source never hides the
 * local installation or independently available member/advisor branches. */
export class EstateTree implements vscode.TreeDataProvider<Node>,vscode.Disposable{
  private events=new vscode.EventEmitter<Node|undefined|void>();readonly onDidChangeTreeData=this.events.event;
  constructor(private connection:Connection){}
  refresh():void{this.events.fire();}
  dispose():void{this.events.dispose();}
  getTreeItem(node:Node):vscode.TreeItem{
    const item=new vscode.TreeItem(node.label,node.group?vscode.TreeItemCollapsibleState.Collapsed:vscode.TreeItemCollapsibleState.None);
    item.description=node.description;item.tooltip=node.error||node.description||node.label;
    item.iconPath=new vscode.ThemeIcon(node.error?'warning':node.group==='peer'?'globe':node.group==='edge'?'device-mobile':node.group==='advisor'?'beaker':node.group?'organization':'remote');
    item.accessibilityInformation={label:[node.label,node.description,node.error].filter(Boolean).join(', ')};
    if(node.resource)item.command={command:'netclaw.inspectEstateResource',title:'Inspect observed Claw',arguments:[node]};
    else if(node.command)item.command={command:node.command,title:node.label};
    return item;
  }
  async getChildren(node?:Node):Promise<Node[]>{
    const generation=this.connection.generation;
    if(!node){
      const identity=this.connection.identity;
      if(!identity)return [{label:'Connect an existing NetClaw',generation,command:'netclaw.selectConnection'}];
      return [{label:this.connection.profile?.label||'Selected installation',generation,description:`${identity.harness.type} · ${identity.role}`,command:'netclaw.openOverview'},
        ...([{label:'Internal Claws',group:'member'},{label:'External peers',group:'peer'},{label:'Mobile and edge',group:'edge'},{label:'Science Officer',group:'advisor'}] as const).map(row=>({...row,generation})),
        {label:'External peer permissions',generation,command:'netclaw.openPeers'},
        {label:'Mobile capture and consent',generation,command:'netclaw.openMobile'},
        {label:'Configured network inventory',generation,command:'netclaw.openNetwork'}];
    }
    if(node.generation!==generation)return [{label:'Connection changed — refresh this branch',generation}];
    if(!node.group)return [];
    try{
      if(node.group==='advisor'){
        const call=boundCaller(this.connection),result=await call<{data:{enabled:boolean;role:string;taskOwnedAssessments:unknown[]}}>('operator_resources',{kind:'advisor'});
        return [{label:'Jev · advice only',generation,description:result.data.enabled?'Enabled in configuration':'Disabled in configuration',command:'netclaw.openScience'}];
      }
      const result=await readResourcePages(this.connection,node.group);
      if(generation!==this.connection.generation)return [];
      const rows:Node[]=result.items.map(resource=>({label:resource.label||resource.id,generation,resource,resourceKind:node.group as 'member'|'peer'|'edge',observedAt:result.observedAt,source:result.source,
        description:`${resource.harness?.type||'unknown harness'} · ${resource.state||'unknown state'}${resource.inventory?.error?' · inventory unavailable':resource.stale?' · stale inventory':''}`}));
      if(result.partial)rows.push({label:`Showing ${rows.length} of ${result.total}; bounded result`,generation});
      if(!rows.length)rows.push({label:'No entries reported by this source',generation});
      return rows;
    }catch(error){if(generation!==this.connection.generation)return [];return [{label:'Source unavailable',generation,error:error instanceof Error?error.message:'Could not read this source'}];}
  }
}

export function inspectEstateResource(context:vscode.ExtensionContext,connection:Connection,node:unknown):void{
  if(!node||typeof node!=='object')throw Error('Select a Claw from the native estate tree.');
  const selected=node as Node;
  if(selected.generation!==connection.generation||!selected.resource)throw Error('Connection changed. Refresh the estate before inspecting this Claw.');
  if(!selected.resourceKind)throw Error('Refresh the estate before inspecting this Claw.');
  const call=boundCaller(connection),resourceId=selected.resource.id,kind=selected.resourceKind;
  openDataView(context,connection,{title:selected.label,kind:'claw',load:async()=>{
    const result=await call<{data:{items:Resource[]};source:string;observedAt:string;warnings:string[]}>('operator_resources',{kind,resourceId,limit:1});
    const resource=result.data.items[0];
    if(result.data.items.length!==1||!resource||resource.id!==resourceId)throw Error('This Claw is no longer present in the selected estate. Refresh the tree.');
    return {resource,observedAt:result.observedAt,source:result.source,warnings:result.warnings,
      qualification:'Fresh read of the received inventory cache; the peer is not contacted. Counts include omitted entries when detail is bounded. Advertisements, assigned specialties and verified execution are distinct. No capability here grants authority.'};
  }});
}

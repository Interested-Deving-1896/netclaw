import * as vscode from 'vscode';
import { Connection } from './connection/connect';
import { Profiles,ConnectionProfile,hostContext } from './state/profiles';
import { NavigationTree,connectionTree,Navigation } from './views/overview';
import { openDataView } from './webview/bridge';
import { openChat } from './views/chat';
import { openCanvas } from './views/canvas';
import { openRag } from './views/rag';
import { stageSelectedContext } from './commands/context';
import {configureSettings} from './views/settings';
import {AssistantProvider} from './assistants/provider';
import {manageAssistant} from './assistants/setup';
import {LocalState} from './state/local';
import path from 'node:path';
import {openDocumentation} from './views/documentation';
import {openLogs} from './views/logs';
import {openTokenomics} from './views/tokenomics';
import {searchMemory} from './views/knowledge';
import {prepareEnvironmentChange} from './views/configuration';
import {openIntegrations} from './views/integrations';
import {openOperations,reviewProposal} from './views/operations';
import {openGait,exportGait} from './views/gait';
import {EstateTree,inspectEstateResource} from './views/estate';
import {openSecurity} from './views/security';
import {openOpenShell} from './views/openshell';
import {configureService} from './views/lifecycle';
import {openNativeRuntime} from './views/native-runtime';
import {openAvatar} from './views/avatar';

type Domain={title:string;method:string;args:Record<string,unknown>;group:string;icon:string};
const domains:Record<string,Domain>={
  overview:{title:'Overview',method:'operator_resources',args:{kind:'overview'},group:'estate',icon:'dashboard'},
  estate:{title:'Risk / iN2N',method:'operator_resources',args:{kind:'member'},group:'estate',icon:'organization'},
  peers:{title:'External peers / eN2N',method:'operator_resources',args:{kind:'peer'},group:'estate',icon:'globe'},
  mobile:{title:'Mobile & edge',method:'operator_resources',args:{kind:'edge'},group:'estate',icon:'device-mobile'},
  science:{title:'Science Officer',method:'operator_resources',args:{kind:'advisor'},group:'knowledge',icon:'beaker'},
  network:{title:'Network',method:'operator_resources',args:{kind:'network'},group:'estate',icon:'type-hierarchy'},
  operations:{title:'Operations',method:'operator_resources',args:{kind:'overview'},group:'operations',icon:'tasklist'},
  gait:{title:'GAIT audit trail',method:'operator_evidence',args:{kind:'gait'},group:'operations',icon:'history'},
  integrations:{title:'MCP integrations',method:'operator_resources',args:{kind:'integration'},group:'integrations',icon:'plug'},
  skills:{title:'Installed skills',method:'operator_resources',args:{kind:'skill'},group:'integrations',icon:'tools'},
  settings:{title:'Runtime settings',method:'operator_snapshot',args:{domain:'settings'},group:'integrations',icon:'settings-gear'},
  configuration:{title:'Environment configuration',method:'operator_snapshot',args:{domain:'settings'},group:'integrations',icon:'key'},
  tokenomics:{title:'Tokenomics',method:'operator_snapshot',args:{domain:'usage'},group:'operations',icon:'graph'},
  security:{title:'DefenseClaw',method:'operator_snapshot',args:{domain:'security'},group:'security',icon:'shield'},
  openshell:{title:'OpenShell',method:'operator_snapshot',args:{domain:'security'},group:'security',icon:'lock'},
  knowledge:{title:'Knowledge & memory',method:'operator_snapshot',args:{domain:'knowledge'},group:'knowledge',icon:'library'},
  documentation:{title:'Documentation',method:'operator_snapshot',args:{domain:'documentation'},group:'help',icon:'book'},
};

export async function activate(context:vscode.ExtensionContext):Promise<{connection:Connection;profiles:Profiles}> {
  const output=vscode.window.createOutputChannel('NetClaw'),profiles=new Profiles(context.globalState,context.globalStorageUri.fsPath),connection=new Connection(output);
  const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,40);status.command='netclaw.selectConnection';status.name='NetClaw installation';
  context.subscriptions.push(output,connection,status);const trees:{refresh():void}[]=[];
  const assistants=new AssistantProvider(new LocalState(path.join(context.globalStorageUri.fsPath,'assistants')),connection,profiles);
  context.subscriptions.push(assistants,vscode.lm.registerMcpServerDefinitionProvider('netclaw.assistant',assistants));
  const refresh=()=>{for(const tree of trees)tree.refresh();status.text=connection.identity?`$(remote) ${connection.profile?.label} · ${connection.identity.harness.type}`:'$(remote) NetClaw: disconnected';status.tooltip=connection.identity?`${hostContext()}\n${connection.identity.installationId}\nManagement contract ${connection.identity.contract.major}`:'Select an existing installation';status.show();};
  context.subscriptions.push(connection.changed.event(refresh));
  function register(name:string,handler:(...args:unknown[])=>unknown):void {
    context.subscriptions.push(vscode.commands.registerCommand(`netclaw.${name}`,async(...args:unknown[])=>{try{return await handler(...args);}catch(error){const message=error instanceof Error?error.message:'NetClaw operation failed.';void vscode.window.showErrorMessage(message);}}));
  }
  async function connectProfile(profile:ConnectionProfile):Promise<void>{
    const identity=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:`Connecting to ${profile.label}`},()=>connection.connect(profile));
    if(!profile.installationId||!profile.principalId){
      const answer=await vscode.window.showInformationMessage(`Bind ${profile.label} to ${identity.harness.type} installation ${identity.installationId}?`,{modal:true,detail:`Host context: ${hostContext()}\nBackend source: ${identity.sourceVersion}\nPrincipal: ${identity.principalId}`},'Bind installation');
      if(answer!=='Bind installation'){await connection.disconnect();return;}
      await profiles.save({...profile,installationId:identity.installationId,hostId:identity.hostId,principalId:identity.principalId});
    }
    refresh();await assistants.refresh();
  }
  register('addConnection',async()=>{
    if(!vscode.workspace.isTrusted)throw Error('Trust this workspace before adding an operational connection.');
    const transport=await vscode.window.showQuickPick([{label:'This extension host',value:'local' as const,description:hostContext()},{label:'Existing SSH alias',value:'ssh' as const,description:'Uses your existing known-host and authentication configuration'}],{title:'Existing NetClaw location'});if(!transport)return;
    if(transport.value==='local'&&process.platform==='win32'){await vscode.commands.executeCommand('workbench.action.showCommands','WSL:');return;}
    const harness=await vscode.window.showQuickPick(['openclaw','hermes'],{title:'Installed NetClaw harness'});if(!harness)return;
    const label=await vscode.window.showInputBox({title:'Connection label',prompt:'A short name for this installation',validateInput:v=>v.trim()&&v.length<=100?undefined:'Enter a label of 1–100 characters'});if(!label)return;
    const sshAlias=transport.value==='ssh'?await vscode.window.showInputBox({title:'Existing SSH alias',prompt:'An alias already configured and trusted in your SSH client'}):undefined;if(transport.value==='ssh'&&!sshAlias)return;
    const nodePath=await vscode.window.showInputBox({title:'Backend Node executable',prompt:'Absolute path on the managed host; supported Node 24.19–24.x or 26.1+'});if(!nodePath)return;
    const launcherPath=await vscode.window.showInputBox({title:'Installed management launcher',prompt:'Absolute path ending in /scripts/netclaw-operator.mjs'});if(!launcherPath)return;
    const home=await vscode.window.showInputBox({title:'Existing runtime home',prompt:'Absolute path to the selected OpenClaw or Hermes home; no files are installed or upgraded'});if(!home)return;
    const profile=await profiles.save({label,transport:transport.value,home,nodePath,launcherPath,sshAlias,harness:harness as 'openclaw'|'hermes'});refresh();await connectProfile(profile);
  });
  register('selectConnection',async id=>{
    const items=profiles.list();const profile=typeof id==='string'?items.find(p=>p.id===id):(await vscode.window.showQuickPick(items.map(p=>({label:p.label,description:`${p.harness} · ${p.transport}`,profile:p})),{title:'Select NetClaw installation'}))?.profile;
    if(profile)await connectProfile(profile);else if(!items.length)await vscode.commands.executeCommand('netclaw.addConnection');
  });
  register('disconnect',()=>connection.disconnect());
  register('removeConnection',async()=>{const item=await vscode.window.showQuickPick(profiles.list().map(p=>({label:p.label,profile:p})));if(!item)return;if(connection.profile?.id===item.profile.id)await connection.disconnect();await profiles.remove(item.profile.id);refresh();});
  register('openDomain',async key=>{if(typeof key!=='string'||!Object.hasOwn(domains,key))throw Error('Unknown NetClaw view.');const view=domains[key]!;openDataView(context,connection,{title:view.title,kind:key,load:()=>connection.call(view.method,view.args)});});
  for(const [command,key] of Object.entries({openOverview:'overview',openSettings:'settings'}))register(command,()=>vscode.commands.executeCommand('netclaw.openDomain',key));
  register('openDocumentation',()=>openDocumentation(context,connection));
  register('openTokenomics',()=>openTokenomics(context,connection));
  register('openLogs',()=>openLogs(connection));
  register('searchMemory',()=>searchMemory(context,connection));
  register('help',async()=>{const document=await vscode.workspace.openTextDocument(vscode.Uri.joinPath(context.extensionUri,'README.md'));await vscode.window.showTextDocument(document);});
  register('refresh',refresh);
  register('openChat',()=>openChat(context,connection));
  register('openAvatar',()=>openAvatar(context,connection));
  register('openNativeRuntime',()=>openNativeRuntime(connection));
  register('openCanvas',()=>openCanvas(context,connection));
  register('openRag',()=>openRag(context,connection));
  register('addSelectedContext',()=>stageSelectedContext(connection));
  register('configureSettings',()=>configureSettings(connection));
  register('manageAssistants',()=>manageAssistant(connection,profiles,assistants));
  register('prepareChange',()=>prepareEnvironmentChange(connection));
  register('openIntegrations',()=>openIntegrations(context,connection));
  register('openSkills',()=>openIntegrations(context,connection,'skill'));
  register('reviewProposal',id=>reviewProposal(context,connection,typeof id==='string'?id:undefined));
  register('openOperations',()=>openOperations(context,connection));
  register('openGait',()=>openGait(context,connection));
  register('exportGait',()=>exportGait(connection));
  register('inspectEstateResource',node=>inspectEstateResource(context,connection,node));
  register('openNetwork',()=>vscode.commands.executeCommand('netclaw.openDomain','network'));
  register('openScience',()=>vscode.commands.executeCommand('netclaw.openDomain','science'));
  register('openSecurity',()=>openSecurity(context,connection));
  register('openOpenShell',()=>openOpenShell(context,connection));
  register('configureService',()=>configureService(connection));
  register('exportDiagnostics',async()=>{
    const result=await connection.call('operator_identity');const content=JSON.stringify({generatedAt:new Date().toISOString(),extensionVersion:'0.1.0',identity:result},null,2);
    const document=await vscode.workspace.openTextDocument({content,language:'json'});await vscode.window.showTextDocument(document);
    if(await vscode.window.showInformationMessage('Review these local diagnostics before saving or sharing.','Save local copy')!=='Save local copy')return;
    const destination=await vscode.window.showSaveDialog({filters:{JSON:['json']},saveLabel:'Save reviewed diagnostics'});if(destination)await vscode.workspace.fs.writeFile(destination,Buffer.from(content));
  });
  const connections=connectionTree(connection,profiles);trees.push(connections);context.subscriptions.push(vscode.window.registerTreeDataProvider('netclaw.connections',connections));
  const estate=new EstateTree(connection);trees.push(estate);context.subscriptions.push(estate,vscode.window.registerTreeDataProvider('netclaw.estate',estate));
  for(const group of ['operations','integrations','knowledge','security','help']){
    const tree=new NavigationTree(()=>{
      const items:Navigation[]=Object.entries(domains).filter(([,d])=>d.group===group).map(([key,d])=>({label:d.title,command:key==='security'?'netclaw.openSecurity':key==='openshell'?'netclaw.openOpenShell':key==='operations'?'netclaw.openOperations':key==='gait'?'netclaw.openGait':key==='integrations'?'netclaw.openIntegrations':key==='skills'?'netclaw.openSkills':key==='documentation'?'netclaw.openDocumentation':key==='tokenomics'?'netclaw.openTokenomics':'netclaw.openDomain',args:[key],icon:d.icon}));
      if(group==='help')items.push({label:'Getting started',command:'netclaw.help',icon:'info'});
      if(group==='knowledge')items.unshift({label:'RAG knowledge base',command:'netclaw.openRag',icon:'search'});
      if(group==='knowledge')items.push({label:'Search recorded memory',command:'netclaw.searchMemory',icon:'history'});
      if(group==='integrations')items.unshift({label:'Configure provider, model and budget',command:'netclaw.configureSettings',icon:'settings-gear'});
      if(group==='integrations')items.push({label:'Control a bound service',command:'netclaw.configureService',icon:'server-process'});
      if(group==='integrations')items.push({label:'Copilot, Claude Code & Codex',command:'netclaw.manageAssistants',icon:'hubot'});
      if(group==='operations')items.unshift({label:'Chat',command:'netclaw.openChat',icon:'comment-discussion'});
      if(group==='operations')items.push({label:'Export reviewed GAIT evidence',command:'netclaw.exportGait',icon:'export'});
      if(group==='operations')items.push({label:'Installation logs',command:'netclaw.openLogs',icon:'output'});
      if(group==='operations')items.push({label:'Avatar',command:'netclaw.openAvatar',icon:'person'});
      if(group==='operations')items.push({label:'Canvas',command:'netclaw.openCanvas',icon:'preview'});
      if(group==='operations')items.push({label:'Native harness UI',command:'netclaw.openNativeRuntime',icon:'link-external'});
      if(group==='operations')items.push({label:'Prepare a managed change',command:'netclaw.prepareChange',icon:'git-pull-request'},{label:'Review a proposal',command:'netclaw.reviewProposal',icon:'checklist'});
      return items;
    });trees.push(tree);context.subscriptions.push(vscode.window.registerTreeDataProvider(`netclaw.${group}`,tree));
  }
  context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(refresh));refresh();
  return {connection,profiles};
}
export function deactivate():void {}

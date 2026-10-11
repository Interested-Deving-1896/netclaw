import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
import {Profiles,hostContext} from '../state/profiles';
import {LocalState} from '../state/local';
import {assistantLaunch,ClientGrant,Registration,registrationName} from './registration';

export class AssistantProvider implements vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition>,vscode.Disposable {
  private readonly changed=new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions=this.changed.event;
  private readonly bindings=new Map<string,Registration>();
  private readonly subscription:vscode.Disposable;
  constructor(private readonly state:LocalState,private readonly connection:Connection,private readonly profiles:Profiles){
    this.subscription=connection.changed.event(()=>this.changed.fire());
  }
  // One atomic local-state key per grant: unrelated windows do not overwrite
  // one another. This state contains references, never backend credentials.
  private key(profileId:string,grantId:string):string{return `assistant:${hostContext()}:${profileId}:${grantId}`;}
  async remember(registration:Registration):Promise<void>{
    assistantLaunch(registration.profile,registration.grant);
    await this.state.update(this.key(registration.profile.id,registration.grant.grantId),registration);this.changed.fire();
  }
  async forget(profileId:string,grantId:string):Promise<void>{
    await this.state.update(this.key(profileId,grantId),null);this.catalog=this.catalog.filter(row=>row.profile.id!==profileId||row.grant.grantId!==grantId);this.changed.fire();
  }
  private catalog:Registration[]=[];
  async refresh():Promise<void>{
    this.catalog=[];this.changed.fire();
    if(!this.connection.ready||!this.connection.profile)return;
    const call=boundCaller(this.connection),profile=this.profiles.list().find(p=>p.id===this.connection.profile!.id);
    if(!profile?.installationId)return;
    const response=await call<{data:{items:ClientGrant[]}}>('operator_resources',{kind:'client',limit:500});
    const entries=response.data.items.map(grant=>this.state.get<Registration|null>(this.key(profile.id,grant.grantId),null)).filter((row):row is Registration=>Boolean(row));
    this.catalog=entries.filter(row=>row.enabled&&row.grant.client==='copilot').filter(row=>{
      const current=response.data.items.find(grant=>grant.grantId===row.grant.grantId);
      return current?.status==='active'&&current.generation===row.grant.generation;
    });this.changed.fire();
  }
  provideMcpServerDefinitions():vscode.McpStdioServerDefinition[]{
    if(!vscode.workspace.isTrusted||!this.connection.ready)return [];
    return this.catalog.flatMap(registration=>{
      if(registration.profile.id!==this.connection.profile?.id||registration.profile.installationId!==this.connection.identity?.installationId||registration.profile.hostId!==this.connection.identity?.hostId)return [];
      try{
        const launch=assistantLaunch(registration.profile,registration.grant);
        const definition=new vscode.McpStdioServerDefinition(registrationName(registration.grant),launch.command,launch.args,{},String(registration.grant.generation));
        this.bindings.set(definition.label,registration);return [definition];
      }catch{return [];}
    });
  }
  async resolveMcpServerDefinition(definition:vscode.McpStdioServerDefinition,token:vscode.CancellationToken):Promise<vscode.McpStdioServerDefinition|undefined>{
    // VS Code may serialize a definition across the extension-host boundary.
    // Rebuild from the saved binding; never execute the caller's command/args.
    const binding=this.bindings.get(definition.label);
    if(!binding||!vscode.workspace.isTrusted||token.isCancellationRequested||!this.connection.ready||
      this.connection.profile?.id!==binding.profile.id||this.connection.identity?.installationId!==binding.grant.installationId||
      this.connection.identity.hostId!==binding.profile.hostId||this.connection.identity.principalId!==binding.profile.principalId)return undefined;
    const call=boundCaller(this.connection),response=await call<{data:{items:ClientGrant[]}}>('operator_resources',{kind:'client',limit:500});
    const current=response.data.items.find(grant=>grant.grantId===binding.grant.grantId);
    const enabled=this.state.get<Registration|null>(this.key(binding.profile.id,binding.grant.grantId),null);
    if(token.isCancellationRequested||!enabled?.enabled||!current||current.generation!==binding.grant.generation||current.client!=='copilot')return undefined;
    const launch=assistantLaunch(binding.profile,current);
    return new vscode.McpStdioServerDefinition(registrationName(current),launch.command,launch.args,{},String(current.generation));
  }
  dispose():void{this.catalog=[];this.bindings.clear();this.subscription.dispose();this.changed.dispose();}
}

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { randomUUID } from 'node:crypto';
import { bindInstallation } from './identity.js';
import { Journal } from './journal.js';
import { InstallationAudit,redactor,redactText,bounded } from './evidence.js';
import { Proposals } from './proposals.js';
import { configurationAdapters,configurationSnapshot,managedSettingsSnapshot,environment,configuredSecrets } from './configuration.js';
import { readOwned } from './files.js';
import { fail,invariant } from './errors.js';
import { authorize } from './policy.js';
import { federationReader,projectFederation } from './federation.js';
import { runtimeSettings,hermesRuntimeSettings } from '../hud-server/runtime-settings.js';
import { runtimeInventory,readUsage } from '../hud-server/tokenomics.js';
import { gatewayAgentId } from '../hud-server/gateway-agent.js';
import { securitySnapshot } from './security.js';
import { ENV_MAP } from '../hud-server/integration-environment.js';
import { documentContent } from '../hud-server/documentation.js';
import { ClientGrants } from './clients.js';
import { startOwnedWorker } from './worker.js';
import { Conversations } from './conversations.js';
import { createManagementRuntime,conversationOptions,nativeHarnessUi } from './chat-runtime.js';
import { Workspace } from './workspace.js';
import { RagClient } from './rag.js';
import {installationLogs,ownedUsage,configuredNetwork} from './observability.js';
import {retainedTopology} from './topology.js';
import { parseOperatorInput } from '../../../../mcp-servers/netclaw-operator-mcp/schemas.mjs';
import { validateOperatorOutput } from '../../../../mcp-servers/netclaw-operator-mcp/responses.mjs';
import {OwnedServiceController} from './service-ownership.js';
import {lifecycleAdapters} from './lifecycle.js';
import {ServiceNowAuthority} from './change-authority.js';
import {AssistantRequests,ProtectedAssistantRuntime} from './assistant-requests.js';
import {DefenseClawComponent} from './defenseclaw.js';
import {OpenShellComponent} from './openshell.js';
import {ScienceOfficer} from './science.js';
import {MobileWorkspace} from './mobile.js';
import {RiskConfiguration} from './runtime.js';
import {RuntimeSelection} from './runtime-selection.js';
import {TerminalIntent} from './intent.js';
import {FederationPermissions} from './peer-policy.js';

export class ManagementService {
  constructor({root,home,kind,expectedInstallationId,audit,adapters={},authority}) {
    this.root=root;this.binding=bindInstallation({home,kind,expectedInstallationId});
    this.journal=new Journal(path.join(this.binding.statePath,'management'),this.binding.installationId);
    this.audit=audit||new InstallationAudit(this.binding,root,this.journal);
    this.runtime=createManagementRuntime(this.binding,root);
    this.readFederation=federationReader(this.binding,()=>environment(this.binding));
    this.services=new OwnedServiceController(this.binding,{ready:async id=>id==='federation'?Boolean((await this.readFederation('overview')).value):Boolean((await this.runtime.readiness()).ready)});
    this.risk=new RiskConfiguration({binding:this.binding,journal:this.journal,readFederation:this.readFederation,services:this.services});
    this.runtimeSelection=new RuntimeSelection({binding:this.binding,journal:this.journal,root});
    this.peerPermissions=new FederationPermissions({binding:this.binding});
    this.defenseclaw=new DefenseClawComponent(this.binding);
    this.openshell=new OpenShellComponent(this.binding);
    this.science=new ScienceOfficer({binding:this.binding,journal:this.journal,root,audit:this.audit,clean:value=>this.clean(value),start:operationId=>startOwnedWorker({root,binding:this.binding,operationId})});
    this.mobile=new MobileWorkspace({binding:this.binding,journal:this.journal,audit:this.audit,clean:value=>this.clean(value),start:operationId=>startOwnedWorker({root,binding:this.binding,operationId})});
    const peerPolicyAdapter=this.peerPermissions.adapter();
    this.adapters={...configurationAdapters(this.binding),'security.patch':this.defenseclaw.adapter(),'risk.role':this.risk.adapter(),'runtime.select':this.runtimeSelection.adapter(),'peer.trust':peerPolicyAdapter,'peer.untrust':peerPolicyAdapter,...lifecycleAdapters({binding:this.binding,journal:this.journal,controller:this.services}),...adapters};
    this.clients=new ClientGrants({binding:this.binding,journal:this.journal,audit:this.audit});
    this.assistants=new AssistantRequests({binding:this.binding,journal:this.journal,audit:this.audit,clients:this.clients,runtime:new ProtectedAssistantRuntime(this.binding),
      start:operationId=>startOwnedWorker({root:this.root,binding:this.binding,operationId}),clean:value=>this.clean(value)});
    this.authority=authority||new ServiceNowAuthority(this.binding);
    this.proposals=new Proposals({binding:this.binding,journal:this.journal,audit:this.audit,adapters:this.adapters,authority:this.authority,validatePrincipal:principal=>this.clients.validate(principal)});
    this.intent=new TerminalIntent({binding:this.binding,journal:this.journal,audit:this.audit,runtime:this.runtime,authority:this.authority,start:operationId=>startOwnedWorker({root,binding:this.binding,operationId}),clean:value=>this.clean(value)});
    this.workspace=new Workspace({root,binding:this.binding,journal:this.journal,science:this.science,mobile:this.mobile,audit:this.audit,clean:value=>this.clean(value),rag:new RagClient(this.binding,root),start:operationId=>startOwnedWorker({root,binding:this.binding,operationId})});
    this.conversations=new Conversations({binding:this.binding,journal:this.journal,science:this.science,audit:this.audit,runtime:this.runtime,
      start:operationId=>startOwnedWorker({root,binding:this.binding,operationId}),clean:value=>this.clean(value)});
    this.journal.reconcileExpired();
  }
  config(){const data=readOwned(this.binding.configPath,{limit:4*1024*1024}).toString();return this.binding.kind==='hermes'?yaml.load(data):JSON.parse(data);}
  clean(value){return bounded(redactor(configuredSecrets(this.binding))(value));}
  async delegationCapability(){
    const status=await this.assistants.runtime.readiness();this.binding.assertCurrent();
    return {supported:this.binding.kind==='hermes',qualified:status.ready===true&&status.grantEnforced===true,profile:'local-subnet',
      reason:status.limits||status.reason||'Protected local Hermes IPv4 /24–/30 subnet calculation. Other tools, federation and OpenClaw delegation remain unavailable.'};
  }
  envelope(data,source,warnings=[]){return this.clean({contractVersion:1,installationId:this.binding.installationId,source,observedAt:new Date().toISOString(),data,freshness:'observed',warnings});}
  identity(){
    const config=this.config(),env=environment(this.binding),role=env.N2N_ROLE||env.N2N_RISK_ROLE||'unknown';
    return this.clean({contract:{major:1,minor:0},installationId:this.binding.installationId,principalId:this.binding.principal.principalId,
      hostId:this.binding.hostId,sourceVersion:fs.readFileSync(path.join(this.root,'VERSION'),'utf8').trim(),harness:{type:this.binding.kind,version:null,versionSource:'Not probed'},
      role,configurationRevision:this.proposals.revision(),observedAt:new Date().toISOString(),
      capabilities:{inspection:{supported:true,qualified:true},changes:Object.keys(this.adapters).map(action=>({action,supported:true,qualified:this.adapters[action].qualified===true&&!action.startsWith('service.')&&!action.startsWith('peer.')&&!['security.patch','runtime.select','risk.role'].includes(action),...(action.startsWith('service.')||action.startsWith('peer.')||['security.patch','runtime.select','risk.role'].includes(action)?{qualification:'Requires the existing domain prerequisites and current target preflight; platform release acceptance remains separate.'}:{})})),
        delegation:{supported:this.binding.kind==='hermes',qualified:false,reason:'Protected Hermes local subnet delegation requires its existing federation companion. OpenClaw scoped execution and broader delegation remain unqualified.'}},
      runtimeSettings:this.binding.kind==='hermes'?hermesRuntimeSettings(config,'Selected installation'):runtimeSettings(config,0,'Selected installation')});
  }
  paginate(rows,input){
    const offset=input.cursor?Number(input.cursor):0;invariant(Number.isSafeInteger(offset)&&offset>=0);
    const limit=input.limit??100;invariant(limit<=500&&limit>0);
    return {items:rows.slice(offset,offset+limit),total:rows.length,...(offset+limit<rows.length?{nextCursor:String(offset+limit)}:{})};
  }
  async resources(principal,input){
    authorize(principal,'inspect',[]);
    invariant(!input.resourceId||['member','peer','edge'].includes(input.kind),'INVALID_INPUT');
    invariant(!input.sourceKind||input.kind==='network','INVALID_INPUT');
    if(input.kind==='client')return this.envelope(this.paginate(this.clients.list(principal),input),'Private operator client grant registry');
    if(input.kind==='overview'){
      if(input.filters?.query&&/^\d{13}:[a-f\d-]{36}$/.test(input.filters.query))return this.envelope({operation:this.journal.byNonce(principal,input.filters.query)},'Durable admission lookup; no dispatch');
      return this.envelope({identity:this.identity(),operations:this.journal.list(principal)},'Selected installation and durable management journal');
    }
    if(['member','peer','edge'].includes(input.kind)){
      authorize(principal,'inspect',[this.binding.installationId]);
      const result=await this.readFederation(input.kind,input),projected=projectFederation(input.kind,result.value);
      return this.envelope({items:projected.items,total:result.value.total,...(result.value.nextCursor?{nextCursor:result.value.nextCursor}:{}),sourceIdentity:projected.sourceIdentity,qualification:projected.qualification},result.source,[result.qualification]);
    }
    if(input.kind==='integration'){
      const inventory=runtimeInventory(this.config()),servers=new Map(inventory.mcp_servers.map(s=>[s.name,s])),env=environment(this.binding);
      const rows=Object.entries(ENV_MAP).map(([id,mapping])=>({id,notes:mapping.notes,configuration:mapping.env.map(key=>({key,isSet:Boolean(env[key])})),
        registered:servers.has(id)||servers.has(`${id}-mcp`),discovered:null,reachable:null,executionVerified:null,source:'Static NetClaw catalog and selected runtime configuration'}));
      return this.envelope(this.paginate(rows,input),'Selected installation configuration');
    }
    if(input.kind==='skill'){
      const directory=path.join(this.binding.home,this.binding.kind==='hermes'?'skills':'workspace/skills');
      const entries=fs.existsSync(directory)?fs.readdirSync(directory,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()):[];
      const rows=entries.filter(e=>fs.existsSync(path.join(directory,e.name,'SKILL.md'))).map(e=>({id:e.name,installed:true,executionVerified:null,source:'Installed skill directory'}));
      return this.envelope(this.paginate(rows,input),'Selected installation skill files');
    }
    if(input.kind==='advisor')return this.envelope(this.science.list(principal),'Selected installation settings and owned assessments');
    if(input.kind==='network'){
      if(input.sourceKind==='historical'){
        invariant(!input.filters&&!input.cursor,'INVALID_INPUT');
        return this.envelope(retainedTopology(this.binding),'Retained authorized collector observations; liveness unknown');
      }
      const result=configuredNetwork(this.binding);
      return this.envelope({...result,...(result.devices?{...this.paginate(result.devices,input),devices:undefined}:{})},'Selected installation configured inventory');
    }
    fail('UNSUPPORTED');
  }
  async snapshot(principal,input){
    authorize(principal,'inspect',[]);
    if(input.domain==='settings')return this.envelope({revision:this.proposals.revision(),runtime:this.identity().runtimeSettings,environment:configurationSnapshot(this.binding),managed:managedSettingsSnapshot(this.binding),conversation:conversationOptions(this.binding),nativeUi:nativeHarnessUi(this.binding),services:await this.services.inventory(),risk:await this.risk.snapshot(),runtimeSelection:this.runtimeSelection.snapshot()},'Selected installation configuration and reviewed service bindings');
    if(input.domain==='usage'){
      const data=this.binding.kind==='hermes'?ownedUsage(this.journal,principal,input.window):readUsage(path.join(this.binding.home,'agents',gatewayAgentId(this.config()),'sessions'),{window:input.window});
      return this.envelope({...data,externalAssistantUsage:null,billingNote:'NetClaw usage excludes Copilot, Claude Code and Codex inference.'},'Selected runtime retained usage');
    }
    if(input.domain==='security'){
      const posture=await securitySnapshot(this.binding,this.readFederation),defenseclaw=this.defenseclaw.snapshot(),openshell=await this.openshell.snapshot();
      return this.envelope({...posture,revision:this.proposals.revision(),defenseclaw,openshell,controls:{...posture.controls,settings:defenseclaw.settings||{supported:false,reason:defenseclaw.reason},scans:defenseclaw.scans||posture.controls.scans,openshell:openshell.actions||{supported:false,reason:openshell.reason}}},'Selected installation configuration, explicitly bound components and federation observations');
    }
    if(input.domain==='documentation'){
      const entries=JSON.parse(fs.readFileSync(path.join(this.root,'docs/reference/documents.json'),'utf8'));
      if(input.resourceId)return this.envelope(documentContent(this.root,entries,input.resourceId),'Bundled NetClaw documentation');
      return this.envelope(this.paginate(entries,input),'Bundled NetClaw documentation index');
    }
    if(input.domain==='knowledge')return this.envelope(this.workspace.snapshot(principal,input.resourceId),'Owned workspace artifacts');
    fail('UNSUPPORTED');
  }
  async call(name,args,principal=this.binding.principal){
    this.binding.assertCurrent();
    // This dispatcher is the private operator surface. Assistant handlers use
    // scoped domain entry points; hiding operator tools in discovery is not an
    // authorization boundary for callers that invoke methods directly.
    invariant(principal?.surface==='operator' && principal.principalId===this.binding.principal.principalId && principal.installationId===this.binding.installationId,'DENIED');
    args=parseOperatorInput(name,args);
    const result=await this.dispatch(name,args,principal);
    this.binding.assertCurrent();
    return validateOperatorOutput(name,args,this.clean(result));
  }
  async dispatch(name,args,principal){
    invariant(principal?.surface==='operator' && principal.principalId===this.binding.principal.principalId && principal.installationId===this.binding.installationId,'DENIED');
    this.binding.assertCurrent();args=parseOperatorInput(name,args);
    if(name==='operator_identity'){
      const identity=this.identity();return {...identity,capabilities:{...identity.capabilities,delegation:await this.delegationCapability()}};
    }
    if(name==='operator_resources')return this.resources(principal,args);
    if(name==='operator_snapshot')return this.snapshot(principal,args);
    if(name==='operator_workspace'){
      if(args.action==='peer-policy')return this.envelope({...await this.peerPermissions.snapshot(args.args.id),revision:this.proposals.revision()},'Exact existing peer permissions and local grant candidates; no peer contact');
      if(args.action==='intent-state')return this.envelope(this.intent.state(principal),'Existing Terminal Intent configuration and durable requests');
      if(args.action==='intent-read')return this.envelope(this.intent.read(principal,args.args.id),'Owned durable Terminal Intent evidence');
      if(args.action==='intent-preview')return this.envelope(this.intent.preview(principal,args.args),'Explicit Terminal Intent scope and approval digest; no dispatch');
      if(args.action==='intent-submit')return this.intent.submit(principal,{...args.args,nonce:args.nonce});
      return this.workspace.call(principal,args);
    }
    if(name==='operator_operation_get'){
      const value=this.journal.get(principal,args.operationId);
      if(value.state==='unknown'&&value.kind==='conversation-request')return this.clean(await this.conversations.reconcile(principal,args.operationId));
      if(value.state==='unknown'&&value.kind==='assistant-request')return this.clean(await this.assistants.reconcile(principal,args.operationId));
      if(value.state==='unknown'&&value.kind==='assessment-reconsider')return this.clean(await this.science.reconcile(principal,args.operationId));
      if(value.state==='unknown'&&value.kind==='mobile-capture')return this.clean(await this.mobile.reconcile(principal,args.operationId));
      return this.clean(value);
    }
    if(name==='operator_request_submit')return this.clean(await this.conversations.submit(principal,args));
    if(name==='operator_cancel_request'){
      const value=this.journal.get(principal,args.operationId);
      if(value.kind==='mobile-capture')return this.clean(await this.mobile.cancel(principal,args));
      if(value.kind==='terminal-intent')return this.clean(await this.intent.cancel(principal,args));
      return this.clean(value.kind==='assistant-request'?await this.assistants.cancel(principal,{nonce:args.nonce,requestId:args.operationId}):await this.conversations.cancel(principal,args));
    }
    if(name==='operator_events')return this.envelope({events:this.journal.events(principal,args.operationId,args.after,args.limit)},'Durable management events');
    if(name==='operator_change_prepare')return this.clean(await this.proposals.prepare(principal,args));
    if(name==='operator_client_prepare')return this.clients.prepare(principal,args);
    if(name==='operator_client_apply')return this.clients.apply(principal,args);
    if(name==='operator_client_revoke')return this.clients.revoke(principal,args);
    if(name==='operator_change_apply'){
      invariant(principal.surface==='operator','DENIED');
      this.journal.record('proposal',args.proposalId,principal);
      const lock=this.journal.lock('configuration',principal.principalId);
      let operation;
      try{operation=this.proposals.admitApply(principal,args);}finally{this.journal.unlock('configuration',lock);}
      if(operation.state==='admitted')await startOwnedWorker({root:this.root,binding:this.binding,operationId:operation.operationId,transient:{replacements:args.replacements||{}}});
      return operation;
    }
    if(name==='operator_evidence'){
      authorize(principal,'evidence',[]);
      if(args.kind==='gait')return this.envelope(await this.audit.log(args.limit),'Installation-specific GAIT');
      if(args.kind==='log')return this.envelope(installationLogs(this.binding,args,{cleanText:redactText(configuredSecrets(this.binding))}),'Selected installation bounded log tail');
      if(args.kind==='approval'&&args.id)return this.envelope(this.journal.record('proposal',args.id,principal),'Managed proposal');
      fail('UNSUPPORTED');
    }
    if(name==='operator_conversation_open'){
      return this.conversations.open(principal,args);
    }
    fail('UNQUALIFIED');
  }
  async close(){try{await this.runtime.close();await this.audit.close?.();}finally{this.journal.close();}}
}

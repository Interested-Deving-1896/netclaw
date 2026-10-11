import {readOwned,atomicPrivate} from './files.js';
import {configurationChangeClass,environment,patchEnvironment} from './configuration.js';
import {digest} from './journal.js';
import {invariant} from './errors.js';

const roles=['standalone','border','member'];
const riskFields={risk_name:'N2N_RISK_NAME',description:'N2N_RISK_DESCRIPTION',enabled_stacks:'N2N_ENABLED_STACKS',border_endpoint:'N2N_BORDER_ENDPOINT',self_member_id:'N2N_MEMBER_ID'};

/** Retain every potentially executing request, including uncertain dispatch.
 * Applying a settings proposal itself is deliberately outside this inventory. */
export function activeManagementWork(journal){
  const rows=journal.db.prepare("SELECT id,kind,state FROM operations WHERE kind NOT IN ('proposal','apply','client-grant','client-revoke') AND state IN ('admitted','running','cancellation-requested','unknown') ORDER BY id LIMIT 1001").all();
  invariant(rows.length<=1000,'BUSY');return rows;
}

export function projectRisk(value){
  invariant(value&&roles.includes(value.role),'SOURCE_UNAVAILABLE');
  // Older daemons omitted this persisted field. Absence cannot be interpreted
  // as an empty endpoint when preserving startup metadata for a role change.
  invariant(Object.keys(riskFields).every(field=>Object.hasOwn(value,field)),'UNQUALIFIED');
  const projected={role:value.role};
  for(const field of Object.keys(riskFields)){
    const text=value[field]??'';
    invariant(typeof text==='string'&&text.length<=(field==='description'?2048:512)&&!/[\r\n\0]/.test(text),'SOURCE_UNAVAILABLE');
    projected[field]=text;
  }
  return projected;
}

/** This changes the saved startup role, using the daemon's existing
 * _sync_risk_from_env path. It does not mutate the running mesh or enroll hosts. */
export class RiskConfiguration {
  constructor({binding,journal,readFederation,services}){Object.assign(this,{binding,journal,readFederation,services});this.pending=new Map();}
  async observe(){
    this.binding.assertCurrent();
    const result=await this.readFederation('overview');
    this.binding.assertCurrent();return projectRisk(result.value);
  }
  async context(){
    const services=await this.services.inventory();this.binding.assertCurrent();
    // Manager metadata carries process identity; timestamps/readiness text are
    // observations, not configuration. Unbound services remain explicitly unknown.
    return {work:activeManagementWork(this.journal),services:services.map(value=>({id:value.id,available:value.available,
      active:value.active??null,pid:value.pid??null,invocation:value.invocation??null,
      definitionRevision:value.definitionRevision??null,transitional:value.transitional??false}))};
  }
  planned(role,observed){
    invariant(roles.includes(role));
    const env=environment(this.binding);
    for(const [field,key] of Object.entries(riskFields)){
      // A different saved identity/endpoint may already be awaiting restart.
      // Never replace it with a stale live value during a role-only request.
      invariant(env[key]===undefined||env[key]===observed[field],'STALE_REVISION');
    }
    if(role==='border')invariant(observed.risk_name&&['in2n','en2n','both'].includes(observed.enabled_stacks),'UNQUALIFIED');
    if(role==='member')invariant(observed.risk_name&&observed.self_member_id&&observed.border_endpoint,'UNQUALIFIED');
    return {N2N_ROLE:role,...Object.fromEntries(Object.entries(riskFields).map(([field,key])=>[key,observed[field]]))};
  }
  async snapshot(){
    const configuredRole=environment(this.binding).N2N_ROLE||null;
    try{
      const observed=await this.observe(),context=await this.context();
      const choices=roles.map(role=>{try{this.planned(role,observed);return {role,available:true};}catch(error){return {role,available:false,reason:error.code||'UNQUALIFIED'};}});
      return {available:true,configuredRole,observedRole:observed.role,riskName:observed.risk_name,
        pendingRestart:configuredRole!==null&&configuredRole!==observed.role,choices,activeWork:context.work,services:context.services,
        source:'Identity-verified federation control API and selected installation .env',
        effect:'Save a startup role for an existing Risk. A separate federation restart is required. Existing membership, identities and active processes are preserved.'};
    }catch(error){
      if(error.code==='IDENTITY_CHANGED')throw error;
      return {available:false,configuredRole,observedRole:null,choices:[],reason:error.code||'SOURCE_UNAVAILABLE',
        effect:'A current installation-verified Risk baseline is required before a role change.'};
    }
  }
  adapter(){
    const owner=this;
    const equal=(actual,saved)=>actual!==null&&actual.toString('base64')===saved;
    async function capture(){
      const observed=await owner.observe(),context=await owner.context();
      invariant(!context.services.some(service=>service.transitional),'BUSY');
      const bytes=readOwned(owner.binding.envPath,{limit:4*1024*1024});
      return {format:1,installationId:owner.binding.installationId,observed,context,bytes:bytes.toString('base64')};
    }
    async function validate(proposal,bytes){
      const previous=JSON.parse(bytes);invariant(previous.format===1&&previous.installationId===owner.binding.installationId,'IDENTITY_CHANGED');
      const current=await capture();invariant(digest(current)===digest(previous),'STALE_REVISION');
      owner.planned(proposal.patch.role,current.observed);return previous;
    }
    return {qualified:true,resource:'configuration',lockMs:180000,
      async prepare(input){
        invariant(input.targets.length===1&&input.targets[0]===owner.binding.installationId,'DENIED');
        invariant(input.patch.acknowledgeActiveWork===true,'DENIED');
        const saved=await capture();owner.planned(input.patch.role,saved.observed);
        const baseline=Buffer.from(JSON.stringify(saved));
        return {baseline,rollback:baseline,changeClass:configurationChangeClass(owner.binding),
          impact:`Save startup role ${input.patch.role} for Risk ${saved.observed.risk_name||'(unnamed)'}. Observed running role: ${saved.observed.role}. ${saved.context.work.length} active/unknown management requests stay running; jobs initiated elsewhere are unknown. Existing Risk metadata is retained. No membership, trust or process change occurs until a separately reviewed federation restart. The restart can interrupt federation work and change listeners. No lab approval or enrollment is created.`};
      },
      validate:async(proposal,{baseline})=>{await validate(proposal,baseline);},
      async apply(proposal,{baseline,replacements={},revalidate}){
        invariant(Object.keys(replacements).length===0);
        await revalidate();const saved=await validate(proposal,baseline);
        const next=Buffer.from(patchEnvironment(Buffer.from(saved.bytes,'base64').toString(),owner.planned(proposal.patch.role,saved.observed)));
        // No await between the final byte/identity check and the atomic save.
        owner.binding.assertCurrent();invariant(equal(readOwned(owner.binding.envPath),saved.bytes),'STALE_REVISION');
        owner.pending.set(proposal.proposalId,{before:saved,after:next.toString('base64')});atomicPrivate(owner.binding.envPath,next);
        return {expected:next.toString('base64'),observed:saved.observed};
      },
      async verify(_proposal,result){
        const current=await owner.observe();owner.binding.assertCurrent();
        return {verified:equal(readOwned(owner.binding.envPath),result.expected)&&digest(current)===digest(result.observed),pendingRestart:true,observedState:`${current.role}; saved role awaits federation restart`};
      },
      async rollback(proposal,bytes){
        const saved=JSON.parse(bytes),pending=owner.pending.get(proposal.proposalId);owner.binding.assertCurrent();
        invariant(saved.format===1&&saved.installationId===owner.binding.installationId,'IDENTITY_CHANGED');
        invariant(digest(await owner.observe())===digest(saved.observed),'STALE_REVISION');
        const actual=readOwned(owner.binding.envPath);
        invariant(equal(actual,saved.bytes)||pending&&equal(actual,pending.after),'STALE_REVISION');
        atomicPrivate(owner.binding.envPath,Buffer.from(saved.bytes,'base64'));
        return {verified:equal(readOwned(owner.binding.envPath),saved.bytes)};
      },
      release:proposal=>owner.pending.delete(proposal.proposalId),
    };
  }
}

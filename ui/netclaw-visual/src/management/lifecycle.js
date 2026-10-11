import {environment} from './configuration.js';
import {invariant} from './errors.js';
import {digest} from './journal.js';

/** Service control accepts only an installation-bound controller. It never
 * starts an installer, deletes a unit or kills a process by name/PID. */
export function lifecycleAdapters({binding,journal,controller,settleTimeoutMs=15000}){
  const pending=new Map();
  const activeWork=()=>{
    const rows=journal.db.prepare("SELECT id,state FROM operations WHERE kind IN ('conversation-request','rag-index','assistant-request','terminal-intent') AND state IN ('admitted','running','cancellation-requested','unknown') ORDER BY id LIMIT 1001").all();
    invariant(rows.length<=1000,'BUSY');return rows;
  };
  const sameInstance=(current,previous)=>current.definitionRevision===previous.definitionRevision&&current.active===previous.active&&current.pid===previous.pid&&current.invocation===previous.invocation;
  const snapshot=async id=>{binding.assertCurrent();const service=await controller.inspect(id);binding.assertCurrent();return service;};
  async function validate(proposal,baseline){
    const previous=JSON.parse(baseline);invariant(previous.format===1&&previous.installationId===binding.installationId,'IDENTITY_CHANGED');
    const current=await snapshot(proposal.patch.serviceId);
    invariant(!current.transitional&&sameInstance(current,previous.service),'STALE_REVISION');
    invariant(digest(activeWork())===previous.workRevision,'STALE_REVISION');
    return previous;
  }
  async function settled(id,active,requireHealth,revision){
    const deadline=Date.now()+settleTimeoutMs;
    do{
      const state=await snapshot(id);invariant(state.definitionRevision===revision,'STALE_REVISION');
      if(!state.transitional&&state.active===active&&(!active||!requireHealth||await controller.ready(id)))return {verified:true,observedState:active?'running':'stopped'};
      if(Date.now()>=deadline)break;await new Promise(resolve=>setTimeout(resolve,Math.min(100,settleTimeoutMs)));
    }while(Date.now()<=deadline);
    return {verified:false};
  }
  const adapter={qualified:true,resource:'configuration',lockMs:180000,
    async prepare(input){
      invariant(input.targets.length===1&&input.targets[0]===binding.installationId,'DENIED');
      invariant(['gateway','federation','hermes-companion'].includes(input.patch.serviceId),'UNQUALIFIED');
      const service=await snapshot(input.patch.serviceId),work=activeWork();
      invariant(!service.transitional,'BUSY');
      if(input.action!=='service.start')invariant(input.patch.acknowledgeActiveWork===true,'DENIED');
      const healthy=service.active?await controller.ready(input.patch.serviceId):false;
      binding.assertCurrent();
      const baseline=Buffer.from(JSON.stringify({format:1,installationId:binding.installationId,service,healthy,workRevision:digest(work)}));
      return {baseline,rollback:baseline,changeClass:environment(binding).N2N_RISK_MODE==='production'?'production':'operator-local',
        impact:`${input.action} on the attested ${input.patch.serviceId} service (${service.manager}: ${service.unit}) only. ${work.length} retained active/unknown management requests. Jobs initiated outside management are unknown and may be interrupted. The process manager may replace the service process. Configuration and service definitions are preserved. A new job or changed definition invalidates this review.`};
    },
    validate:async(proposal,{baseline})=>{await validate(proposal,baseline);},
    async apply(proposal,{baseline,replacements,revalidate}){
      invariant(Object.keys(replacements).length===0);
      const previous=await validate(proposal,baseline);await revalidate();binding.assertCurrent();
      const current=await snapshot(proposal.patch.serviceId);invariant(sameInstance(current,previous.service),'STALE_REVISION');
      invariant(digest(activeWork())===previous.workRevision,'STALE_REVISION');
      const action=proposal.action.slice('service.'.length);pending.set(proposal.proposalId,{previous,attempted:false});
      if(action==='start'&&current.active||action==='stop'&&!current.active)return {active:current.active,revision:current.definitionRevision};
      pending.get(proposal.proposalId).attempted=true;
      await controller.act(proposal.patch.serviceId,action);
      return {active:action!=='stop',revision:current.definitionRevision};
    },
    verify:async(proposal,result)=>settled(proposal.patch.serviceId,result.active,true,result.revision),
    async rollback(proposal,bytes){
      const previous=JSON.parse(bytes),state=pending.get(proposal.proposalId),current=await snapshot(proposal.patch.serviceId);
      invariant(current.definitionRevision===previous.service.definitionRevision,'STALE_REVISION');
      if(state?.attempted){
        // A failed restart can require replacing its unhealthy process. Only
        // the same attested manager target and unchanged definition are used.
        const restore=previous.service.active?(current.active?'restart':'start'):'stop';
        await controller.act(proposal.patch.serviceId,restore);
      }
      return settled(proposal.patch.serviceId,previous.service.active,previous.healthy,previous.service.definitionRevision);
    },
    release:proposal=>pending.delete(proposal.proposalId),
  };
  return Object.fromEntries(['service.start','service.stop','service.restart'].map(action=>[action,adapter]));
}

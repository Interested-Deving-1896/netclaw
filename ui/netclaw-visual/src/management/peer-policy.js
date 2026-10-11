import {federationEndpoint} from '../hud-server/runtime/federation.js';
import {environment,configurationChangeClass} from './configuration.js';
import {digest} from './journal.js';
import {invariant} from './errors.js';

export class PeerPolicyClient {
  constructor(binding,fetcher=fetch){Object.assign(this,{binding,fetcher});}
  async call(action,args){
    invariant(['snapshot','apply','verify','rollback'].includes(action),'UNSUPPORTED');
    this.binding.assertCurrent();const endpoint=federationEndpoint(environment(this.binding));
    const read=async(route,body)=>{
      const response=await this.fetcher(endpoint+route,{redirect:'error',signal:AbortSignal.timeout(10000),...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
      invariant(response.ok&&response.body,'SOURCE_UNAVAILABLE');const reader=response.body.getReader(),chunks=[];let length=0;
      try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;invariant(length<=1024*1024,'SOURCE_UNAVAILABLE');chunks.push(Buffer.from(value));}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      try{return JSON.parse(Buffer.concat(chunks).toString());}catch{invariant(false,'SOURCE_UNAVAILABLE');}
    };
    const verify=async()=>{this.binding.assertCurrent();const value=await read('/status');invariant(value.installation_id===this.binding.installationId&&value.harness_type===this.binding.kind,'IDENTITY_CHANGED');invariant(value.federation_ready===true,'SOURCE_UNAVAILABLE');};
    await verify();const value=await read('/n2n/management/peer-policy',{action,...args});await verify();return value;
  }
}

export class FederationPermissions {
  constructor({binding,client=new PeerPolicyClient(binding)}){Object.assign(this,{binding,client});this.pending=new Map();}
  async snapshot(peer){
    this.binding.assertCurrent();const value=await this.client.call('snapshot',{peer});this.binding.assertCurrent();
    invariant(value?.format===1&&value.installationId===this.binding.installationId&&value.harness===this.binding.kind&&value.policy?.identity===peer,'IDENTITY_CHANGED');
    invariant(typeof value.production==='boolean','UNQUALIFIED');
    invariant(Number.isSafeInteger(value.policy.revision)&&Array.isArray(value.policy.grants)&&value.policy.grants.length<=500&&Array.isArray(value.policy.work)&&value.policy.work.length<=500&&Array.isArray(value.grantCandidates)&&value.grantCandidates.length<=500,'SOURCE_UNAVAILABLE');
    return value;
  }
  adapter(){
    const owner=this;
    const baseline=async(peer)=>{const value=await owner.snapshot(peer);return {...value,changeClass:value.production?'production':configurationChangeClass(owner.binding)};};
    const validate=async(proposal,bytes)=>{const saved=JSON.parse(bytes);invariant(digest(await baseline(proposal.targets[1]))===digest(saved),'STALE_REVISION');return saved;};
    return {qualified:true,resource:'configuration',lockMs:180000,
      async prepare(input,principal){
        invariant(principal.surface==='operator','DENIED');
        invariant(input.targets.length===2&&input.targets[0]===owner.binding.installationId&&input.targets[1]!==owner.binding.installationId&&!input.targets[1].includes('/'),'DENIED');
        invariant(input.patch.acknowledgeActiveWork===true,'DENIED');
        const saved=await baseline(input.targets[1]),policy=saved.policy;
        if(input.action==='peer.trust'){
          invariant(policy.state==='federated'&&policy.consent?.local_grant===true&&policy.consent?.remote_grant===true,'UNQUALIFIED');
          if(input.patch.grant){const grant=input.patch.grant;
            invariant(saved.grantCandidates.some(row=>row.type===grant.type&&row.name===grant.name),'UNQUALIFIED');
            invariant(!policy.grants.some(row=>row.target_type===grant.type&&row.target_name===grant.name),'STALE_REVISION');
          }
        }else invariant((input.patch.revokeGrantIds||[]).every(id=>policy.grants.some(row=>row.id===id)),'STALE_REVISION');
        const bytes=Buffer.from(JSON.stringify(saved));invariant(bytes.length<=512*1024,'SOURCE_UNAVAILABLE');
        return {baseline:bytes,rollback:bytes,changeClass:saved.changeClass,
          impact:`Change local inbound permissions for exact existing external peer ${policy.identity}. ${policy.work.length} known active or uncertain tasks exist; already dispatched work may continue. ${input.action==='peer.trust'?'New tool/skill grants require the existing per-request NCFED approval; a grant does not prove runtime execution support.':'Only the selected invocation grants and/or chat permission are revoked.'} Unselected grants, peer consent, certificate pins, endpoints, channels and BGP remain unchanged. No peer is contacted. Rollback restores this permission delta only when no later policy change occurred; it cannot undo work that ran while permission was enabled.`};
      },
      validate:async(proposal,{baseline:bytes})=>{await validate(proposal,bytes);},
      async apply(proposal,{baseline:bytes,replacements={},revalidate,operationId,lease}){
        invariant(Object.keys(replacements).length===0&&operationId&&lease,'DENIED');await revalidate();await validate(proposal,bytes);
        owner.pending.set(proposal.proposalId,{operationId,lease});return owner.client.call('apply',{operationId,lease});
      },
      async verify(proposal){
        const request=owner.pending.get(proposal.proposalId);invariant(request,'UNKNOWN_OUTCOME');
        const result=await owner.client.call('verify',request);return {verified:result.verified===true&&result.state==='applied',observedState:'Selected peer permission delta saved and observed. Previously dispatched work may continue.'};
      },
      async rollback(proposal,bytes){
        const request=owner.pending.get(proposal.proposalId);
        if(!request){await validate(proposal,bytes);return {verified:true};}
        const result=await owner.client.call('rollback',request);return {verified:result.verified===true&&['unchanged','rolled-back'].includes(result.state)};
      },
      release:proposal=>owner.pending.delete(proposal.proposalId),
    };
  }
}

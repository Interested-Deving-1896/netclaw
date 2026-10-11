import { federationEndpoint } from '../hud-server/runtime/federation.js';
import { invariant } from './errors.js';

export function federationReader(binding,getEnvironment,fetcher=fetch) {
  async function read(endpoint,route,body){
    const response=await fetcher(endpoint+route,{signal:AbortSignal.timeout(10000),redirect:'error',...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
    invariant(response.ok&&response.body,'SOURCE_UNAVAILABLE');
    const reader=response.body.getReader(),parts=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;invariant(size<=1024*1024,'SOURCE_UNAVAILABLE');parts.push(Buffer.from(value));}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    let result;try{result=JSON.parse(Buffer.concat(parts).toString());}catch{invariant(false,'SOURCE_UNAVAILABLE');}return result;
  }
  async function verify(endpoint){
    binding.assertCurrent();const status=await read(endpoint,'/status');
    invariant(status.installation_id===binding.installationId&&status.harness_type===binding.kind,'IDENTITY_CHANGED');
    invariant(status.federation_ready===true,'SOURCE_UNAVAILABLE');
  }
  return async (kind,input={})=>{
    if(['member','peer','edge'].includes(kind)){
      binding.assertCurrent();const endpoint=federationEndpoint(getEnvironment());
      const selection={kind,limit:input.limit??100,...(input.cursor?{cursor:input.cursor}:{}),...(input.resourceId?{id:input.resourceId}:{}),
        ...(input.filters?.query?{query:input.filters.query}:{}),...(input.filters?.status?{status:input.filters.status}:{})};
      await verify(endpoint);const value=await read(endpoint,'/n2n/management/estate',selection);await verify(endpoint);
      invariant(value?.format===1&&Number.isSafeInteger(value.total)&&value.total>=0&&value.total<=10000,'UNQUALIFIED');
      invariant(value.nextCursor===undefined||typeof value.nextCursor==='string'&&/^[1-9][0-9]{0,8}$/.test(value.nextCursor),'SOURCE_UNAVAILABLE');
      const rows=kind==='peer'?value.peers:value.members;
      invariant(Array.isArray(rows)&&rows.length<=selection.limit&&rows.length<=value.total,'SOURCE_UNAVAILABLE');
      if(input.resourceId)invariant(rows.length<=1&&rows.every(row=>(kind==='peer'?row.identity:row.member_id)===input.resourceId),'SOURCE_UNAVAILABLE');
      return {value,source:'Selected installation federation control API; received estate metadata',qualification:'Cached advertisements only. No peer refresh, channel creation, trust change or execution.'};
    }
    const route={member:'/n2n/members',peer:'/n2n/status',edge:'/n2n/members',overview:'/n2n/risk',posture:'/n2n/posture'}[kind];invariant(route,'UNSUPPORTED');
    binding.assertCurrent();const endpoint=federationEndpoint(getEnvironment());
    await verify(endpoint);const value=await read(endpoint,route);await verify(endpoint);
    return {value,source:'Selected installation federation control API',qualification:'Observed inventory; advertisements do not grant execution authority.'};
  };
}

const label=value=>typeof value==='string'&&!/[\x00-\x1f\x7f]/.test(value)?value.slice(0,200):null;
const name=value=>typeof value==='string'&&/^[A-Za-z0-9_.:/@+\-]{1,200}$/.test(value)?value:null;
const harness=value=>({type:['hermes','openclaw'].includes(value?.type)?value.type:'unknown',version:label(value?.version),source:'Remote advertisement; not executable selection'});
/** Whitelisted, display-only estate cards. No command, credential or permission
 * is adopted from an advertised inventory, including legacy/unknown cards. */
export function projectFederation(kind,value){
  const rows=kind==='peer'?value.peers:value.members;invariant(Array.isArray(rows),'SOURCE_UNAVAILABLE');
  const seen=new Set(),items=[];
  for(const row of rows){
    const id=kind==='peer'?row.identity:row.member_id;
    invariant(typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./:-]{0,199}$/.test(id)&&!id.includes('..')&&!seen.has(id),'SOURCE_UNAVAILABLE');seen.add(id);
    if(kind==='edge'&&row.node_type!=='edge'||kind==='member'&&row.node_type==='edge')continue;
    const inventory=row.inventory,capabilities=[];
    for(const server of (Array.isArray(inventory?.mcp_servers)?inventory.mcp_servers:[]).slice(0,256)){
      if(!name(server?.name))continue;
      capabilities.push({id:name(server.name),advertised:true,tools:(Array.isArray(server.tools)?server.tools:[]).slice(0,500).map(name).filter(Boolean),executionVerified:null});
    }
    items.push({id,label:label(row.display_name)||id,kind,state:label(row.state)||'unknown',harness:harness(inventory?.harness),
      profile:label(row.profile),nodeType:label(row.node_type),transportBinding:label(row.transport_binding),
      heartbeatAgeSeconds:Number.isFinite(row.heartbeat_age_s)?row.heartbeat_age_s:null,
      live:typeof row.live==='boolean'?row.live:null,chatEnabled:typeof row.chat_enabled==='boolean'?row.chat_enabled:null,
      stale:typeof row.stale==='boolean'?row.stale:null,receivedAt:label(row.inventory_received_at||inventory?.received_at),
      model:{primary:name(inventory?.llm?.primary_model),guardAdvertised:typeof inventory?.llm?.guarded==='boolean'?inventory.llm.guarded:null,source:'Received model advertisement; provider credentials and effective execution are unknown'},
      inventory:{available:inventory?inventory.available!==false:false,detail:inventory?.detail===true,truncated:inventory?.truncated===true,error:label(row.inventory_error),
        counts:Object.fromEntries(['servers','tools','skills','knowledge'].map(key=>[key,Number.isSafeInteger(inventory?.counts?.[key])&&inventory.counts[key]>=0?inventory.counts[key]:null]))},
      skills:(Array.isArray(inventory?.skills)?inventory.skills:[]).slice(0,100).map(name).filter(Boolean),
      assignedSpecialties:(Array.isArray(row.skills)?row.skills:[]).slice(0,100).map(name).filter(Boolean),
      knowledge:(Array.isArray(inventory?.knowledge)?inventory.knowledge:[]).slice(0,100).map(name).filter(Boolean),
      capabilities,executionVerified:null,source:kind==='peer'?'External peer relationship and cached advertisement':'Internal membership and received inventory'});
  }
  return {items,sourceIdentity:label(value.identity),qualification:'Membership, advertisement, installation and verified execution are distinct. No management permission is inferred from these cards.'};
}

import { federationEndpoint } from '../hud-server/runtime/federation.js';
import { invariant } from './errors.js';

export function federationReader(binding,getEnvironment,fetcher=fetch) {
  async function read(endpoint,route){
    const response=await fetcher(endpoint+route,{signal:AbortSignal.timeout(10000),redirect:'error'});
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
  return async kind=>{
    const route={member:'/n2n/members',peer:'/n2n/status',edge:'/n2n/members',overview:'/n2n/risk',posture:'/n2n/posture'}[kind];invariant(route,'UNSUPPORTED');
    binding.assertCurrent();const endpoint=federationEndpoint(getEnvironment());
    await verify(endpoint);const value=await read(endpoint,route);await verify(endpoint);
    return {value,source:'Selected installation federation control API',qualification:'Observed inventory; advertisements do not grant execution authority.'};
  };
}

const label=value=>typeof value==='string'?value.slice(0,200):null;
const harness=value=>({type:['hermes','openclaw'].includes(value?.type)?value.type:'unknown',version:label(value?.version),source:'Remote advertisement; not executable selection'});
/** Whitelisted, display-only estate cards. No command, credential or permission
 * is adopted from an advertised inventory, including legacy/unknown cards. */
export function projectFederation(kind,value){
  const rows=kind==='peer'?value.peers:value.members;invariant(Array.isArray(rows),'SOURCE_UNAVAILABLE');
  const seen=new Set(),items=[];
  for(const row of rows){
    const id=kind==='peer'?row.identity:row.member_id;
    invariant(typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./:-]{0,199}$/.test(id)&&!seen.has(id),'SOURCE_UNAVAILABLE');seen.add(id);
    if(kind==='edge'&&row.node_type!=='edge'||kind==='member'&&row.node_type==='edge')continue;
    const inventory=row.inventory,capabilities=[];
    for(const server of (Array.isArray(inventory?.mcp_servers)?inventory.mcp_servers:[]).slice(0,256)){
      if(!label(server?.name))continue;
      capabilities.push({id:label(server.name),advertised:true,tools:(Array.isArray(server.tools)?server.tools:[]).slice(0,512).map(label).filter(Boolean),executionVerified:null});
    }
    items.push({id,label:label(row.display_name)||id,kind,state:label(row.state)||'unknown',harness:harness(inventory?.harness),
      profile:label(row.profile),nodeType:label(row.node_type),transportBinding:label(row.transport_binding),
      heartbeatAgeSeconds:Number.isFinite(row.heartbeat_age_s)?row.heartbeat_age_s:null,
      live:typeof row.live==='boolean'?row.live:null,chatEnabled:typeof row.chat_enabled==='boolean'?row.chat_enabled:null,
      stale:typeof row.stale==='boolean'?row.stale:null,receivedAt:label(inventory?.received_at||row.inventory_received_at),
      capabilities,executionVerified:null,source:kind==='peer'?'External peer relationship and cached advertisement':'Internal membership and received inventory'});
  }
  return {items,sourceIdentity:label(value.identity),qualification:'Membership, advertisement, installation and verified execution are distinct. No management permission is inferred from these cards.'};
}

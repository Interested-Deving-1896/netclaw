import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {bindInstallation} from './identity.js';
import {readOwned,atomicPrivate} from './files.js';
import {invariant} from './errors.js';

const filename='topology-observations.json';
const short=value=>typeof value==='string'?value.slice(0,200):null;
const stamp=value=>Number.isSafeInteger(value)&&value>0?value:null;
const opaque=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,32);
const fields={interfaceBrief:['interface','address','state','protocol'],ospf:['protocol','routerId','state','address','interface','vrf'],bgp:['protocol','address','remoteAs','uptime','state','vrf']};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
const optionalText=value=>value===null||typeof value==='string'&&value.length<=200;
const timeValue=value=>value===null||Boolean(stamp(value));

/** Retain only normalized evidence from the already-authorized collector.
 * This adapter cannot authorize, log in, poll, or contact a device. */
export function topologyEvidenceWriter(installation){
  const binding=bindInstallation({home:installation.home,kind:installation.kind,expectedInstallationId:installation.installationId});
  const collectorInstance=randomUUID();
  return ({status,snapshots,stopped=false})=>{
    binding.assertCurrent();
    const nodes=[],edges=[],observations=[];let omitted=0;
    const reference=(deviceId,sourceId,observedAt)=>({collectorInstance,revision:status.revision,deviceId:short(deviceId),sourceId,observedAt:stamp(observedAt)});
    for(const device of status.devices.slice(0,32)){
      const id=`device:${opaque(device.id)}`,snapshot=snapshots.find(row=>row.deviceId===device.id);
      nodes.push({id,label:short(device.alias)||short(device.id),deviceId:short(device.id),kind:'collector-device',phase:short(device.phase),
        observedAt:stamp(device.lastSuccess),failed:Boolean(device.failures||device.blocked),sourceReference:reference(device.id,'collector',device.lastSuccess)});
      if(!snapshot)continue;
      for(const sourceId of ['cdp','lldp']){
        const fact=snapshot.facts?.[sourceId];
        for(const row of fact?.records||[]){
          if(edges.length>=400){omitted++;continue;}
          const neighbor=short(row.neighbor)||short(row.chassisId);if(!neighbor)continue;
          // An advertised name is not proof of another managed device's identity.
          const target=`advertisement:${opaque([device.id,sourceId,neighbor,row.interface,row.remotePort,edges.length])}`;
          const sourceReference=reference(device.id,sourceId,fact.observedAt),failed=Boolean(fact.failed||snapshot.collectionFailed);
          nodes.push({id:target,label:neighbor,kind:'neighbor-advertisement',observedAt:stamp(fact.observedAt),failed,sourceReference});
          edges.push({id:`edge:${edges.length}`,from:id,to:target,protocol:sourceId.toUpperCase(),interface:short(row.interface),remotePort:short(row.remotePort),
            observedAt:stamp(fact.observedAt),failed,sourceReference});
        }
      }
      for(const [sourceId,keys] of Object.entries(fields)){
        const fact=snapshot.facts?.[sourceId];
        for(const row of fact?.records||[]){
          if(observations.length>=500){omitted++;continue;}
          observations.push({deviceId:short(device.id),sourceId,values:Object.fromEntries(keys.map(key=>[key,short(row[key])])),observedAt:stamp(fact.observedAt),
            failed:Boolean(fact.failed||snapshot.collectionFailed),sourceReference:reference(device.id,sourceId,fact.observedAt)});
        }
      }
    }
    const value={schemaVersion:1,installationId:binding.installationId,harness:binding.kind,sourceKind:'historical',collectorInstance,
      savedAt:Date.now(),revision:status.revision,intervalSeconds:status.intervalSeconds,enabled:status.enabled,stopped,
      nodes,edges,observations,omitted,truncated:omitted>0};
    const bytes=JSON.stringify(value);invariant(Buffer.byteLength(bytes)<=1024*1024,'SOURCE_UNAVAILABLE');
    binding.assertCurrent();atomicPrivate(path.join(binding.statePath,filename),bytes);
  };
}

export function retainedTopology(binding,{now=Date.now()}={}){
  binding.assertCurrent();
  try{
    const value=JSON.parse(readOwned(path.join(binding.statePath,filename),{limit:1024*1024}));
    invariant(value.schemaVersion===1&&value.installationId===binding.installationId&&value.harness===binding.kind&&value.sourceKind==='historical','IDENTITY_CHANGED');
    invariant(stamp(value.savedAt)&&value.savedAt<=now+5000&&Number.isInteger(value.intervalSeconds)&&value.intervalSeconds>=15&&value.intervalSeconds<=300,'SOURCE_UNAVAILABLE');
    invariant(Array.isArray(value.nodes)&&value.nodes.length<=432&&Array.isArray(value.edges)&&value.edges.length<=400&&Array.isArray(value.observations)&&value.observations.length<=500,'SOURCE_UNAVAILABLE');
    invariant(exact(value,['schemaVersion','installationId','harness','sourceKind','collectorInstance','savedAt','revision','intervalSeconds','enabled','stopped','nodes','edges','observations','omitted','truncated'])&&
      typeof value.collectorInstance==='string'&&/^[a-f\d-]{36}$/.test(value.collectorInstance)&&Number.isSafeInteger(value.revision)&&value.revision>=0&&typeof value.enabled==='boolean'&&typeof value.stopped==='boolean'&&Number.isSafeInteger(value.omitted)&&value.omitted>=0&&value.truncated===(value.omitted>0),'SOURCE_UNAVAILABLE');
    const reference=row=>exact(row,['collectorInstance','revision','deviceId','sourceId','observedAt'])&&row.collectorInstance===value.collectorInstance&&row.revision===value.revision&&optionalText(row.deviceId)&&['collector','cdp','lldp',...Object.keys(fields)].includes(row.sourceId)&&timeValue(row.observedAt);
    const common=row=>timeValue(row.observedAt)&&typeof row.failed==='boolean'&&reference(row.sourceReference)&&row.observedAt===row.sourceReference.observedAt;
    invariant(value.nodes.every(row=>exact(row,['id','label','deviceId','kind','phase','observedAt','failed','sourceReference'])&&typeof row.id==='string'&&/^(?:device|advertisement):[a-f\d]{32}$/.test(row.id)&&optionalText(row.label)&&['collector-device','neighbor-advertisement'].includes(row.kind)&&common(row))&&
      value.edges.every(row=>exact(row,['id','from','to','protocol','interface','remotePort','observedAt','failed','sourceReference'])&&/^edge:\d+$/.test(row.id)&&['CDP','LLDP'].includes(row.protocol)&&optionalText(row.interface)&&optionalText(row.remotePort)&&common(row))&&
      value.observations.every(row=>exact(row,['deviceId','sourceId','values','observedAt','failed','sourceReference'])&&Object.hasOwn(fields,row.sourceId)&&optionalText(row.deviceId)&&exact(row.values,fields[row.sourceId])&&Object.values(row.values).every(optionalText)&&common(row)),'SOURCE_UNAVAILABLE');
    const staleAfterMs=value.intervalSeconds*2500;
    const project=row=>({...row,sourceKind:'historical',stale:Boolean(row.failed||!stamp(row.observedAt)||row.observedAt>now||now-row.observedAt>staleAfterMs)});
    const nodes=value.nodes.map(project),ids=new Set(nodes.map(row=>row.id));
    invariant(ids.size===nodes.length&&value.edges.every(row=>ids.has(row.from)&&ids.has(row.to)),'SOURCE_UNAVAILABLE');
    binding.assertCurrent();
    return {...value,available:true,nodes,edges:value.edges.map(project),observations:value.observations.map(project),readAt:now,
      collectorLiveness:'unknown',scope:'Retained observations from the existing explicitly authorized IOS/IOS-XE collector. Reading never starts collection. Timestamps and stale flags describe evidence age, not current reachability. CDP/LLDP advertisements are not verified physical cabling; advertised names are not merged with configured identities. Interface and routing states are historical. Current collector/process/device liveness is unknown.'};
  }catch(error){if(error.code==='IDENTITY_CHANGED')throw error;return {available:false,sourceKind:'historical',collectorLiveness:'unknown',reason:'No valid owned topology observation is retained for this installation. Configure and authorize the existing HUD collector to produce observations; this read grants nothing.'};}
}

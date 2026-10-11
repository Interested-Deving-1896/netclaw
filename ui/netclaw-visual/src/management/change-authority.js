import path from 'node:path';
import {readOwned} from './files.js';
import {environment} from './configuration.js';
import {invariant} from './errors.js';
import {canonical} from './journal.js';

export const authorityBindingPath=binding=>path.join(binding.statePath,'change-authority.json');
const sysId=value=>typeof value==='string'&&/^[a-f\d]{32}$/.test(value);
const customField=value=>typeof value==='string'&&/^u_[a-z][a-z0-9_]{0,63}$/.test(value);
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));

/** Read-only ServiceNow verifier. Customer field/state/CI mappings must be
 * explicitly provisioned and qualified; no approval or ticket mutation exists. */
export class ServiceNowAuthority {
  constructor(binding,{fetcher=fetch}={}){Object.assign(this,{binding,fetcher});}
  configuration(){
    this.binding.assertCurrent();
    const bytes=readOwned(authorityBindingPath(this.binding),{missing:true,limit:65536});invariant(bytes,'UNQUALIFIED');
    let value;try{value=JSON.parse(bytes);}catch{invariant(false,'INCOMPATIBLE');}
    invariant(keys(value,['schemaVersion','installationId','origin','executorPrincipalId','executorUserSysId','credential','implementState','changeDigestField','approvalDigestField','targetCis']),'INCOMPATIBLE');
    invariant(value.schemaVersion===1&&value.installationId===this.binding.installationId,'IDENTITY_CHANGED');
    invariant(value.executorPrincipalId===this.binding.principal.principalId&&sysId(value.executorUserSysId),'DENIED');
    let origin;try{origin=new URL(value.origin);}catch{invariant(false,'INCOMPATIBLE');}
    invariant(origin.protocol==='https:'&&!origin.username&&!origin.password&&origin.origin===value.origin,'INCOMPATIBLE');
    invariant(typeof value.implementState==='string'&&/^-?\d{1,3}$/.test(value.implementState),'INCOMPATIBLE');
    invariant(customField(value.changeDigestField)&&customField(value.approvalDigestField),'INCOMPATIBLE');
    invariant(keys(value.credential,['tokenRef'])&&/^NETCLAW_CHANGE_[A-Z0-9_]*TOKEN$/.test(value.credential.tokenRef||''),'INCOMPATIBLE');
    invariant(value.targetCis&&typeof value.targetCis==='object'&&!Array.isArray(value.targetCis)&&Object.keys(value.targetCis).length<=1000,'INCOMPATIBLE');
    for(const [target,cis] of Object.entries(value.targetCis))invariant(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(target)&&Array.isArray(cis)&&cis.length>0&&cis.length<=32&&cis.every(sysId)&&new Set(cis).size===cis.length,'INCOMPATIBLE');
    const token=environment(this.binding)[value.credential.tokenRef];invariant(typeof token==='string'&&token.length>=16&&!/[\r\n]/.test(token),'UNAUTHENTICATED');
    return {value,bytes,token};
  }
  async verify(reference,intent){
    invariant(typeof reference==='string'&&/^CHG\d{4,20}$/.test(reference),'DENIED');
    invariant(intent.changeClass==='production'&&/^[a-f\d]{64}$/.test(intent.actionDigest||'')&&Array.isArray(intent.targets)&&intent.targets.length>0&&intent.targets.length<=32,'DENIED');
    const {value:config,bytes,token}=this.configuration(),signal=AbortSignal.timeout(15000);
    const cis=[...new Set(intent.targets.flatMap(target=>{invariant(Object.hasOwn(config.targetCis,target),'DENIED');return config.targetCis[target];}))].sort();invariant(cis.length<=128,'DENIED');
    const unchanged=()=>{
      this.binding.assertCurrent();
      invariant(readOwned(authorityBindingPath(this.binding),{limit:65536}).equals(bytes),'STALE_REVISION');
      invariant(environment(this.binding)[config.credential.tokenRef]===token,'UNAUTHENTICATED');
    };
    const read=async(table,query,fields,limit=100)=>{
      unchanged();invariant(['change_request','task_ci','sysapproval_approver','incident'].includes(table),'DENIED');
      const url=new URL(`/api/now/table/${table}`,config.origin);
      for(const [key,value] of Object.entries({sysparm_query:query,sysparm_fields:fields.join(','),sysparm_limit:String(limit+1),sysparm_display_value:'false',sysparm_exclude_reference_link:'true'}))url.searchParams.set(key,value);
      const response=await this.fetcher(url.href,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal,redirect:'error',cache:'no-store'});
      invariant(response.ok&&!response.redirected&&response.body,'SOURCE_UNAVAILABLE');
      const reader=response.body.getReader(),parts=[];let size=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;invariant(size<=1024*1024,'SOURCE_UNAVAILABLE');parts.push(Buffer.from(value));}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      let result;try{result=JSON.parse(Buffer.concat(parts).toString()).result;}catch{invariant(false,'SOURCE_UNAVAILABLE');}
      invariant(Array.isArray(result)&&result.length<=limit&&result.every(row=>row&&typeof row==='object'&&!Array.isArray(row)),'SOURCE_UNAVAILABLE');
      const total=response.headers.get('x-total-count');
      if(total!==null)invariant(/^\d+$/.test(total)&&Number(total)===result.length,'SOURCE_UNAVAILABLE');
      unchanged();return result;
    };
    const readChange=async()=>{
      const rows=await read('change_request',`number=${reference}`,['sys_id','number','state','approval','active','cmdb_ci',config.changeDigestField],1);
      invariant(rows.length===1,'DENIED');const row=rows[0];
      invariant(sysId(row.sys_id)&&row.number===reference&&row.state===config.implementState&&row.approval==='approved'&&row.active==='true'&&row[config.changeDigestField]===intent.actionDigest,'DENIED');return row;
    };
    const change=await readChange();
    const related=await read('task_ci',`task=${change.sys_id}`,['task','ci_item']);
    invariant(related.every(row=>row.task===change.sys_id&&sysId(row.ci_item)),'DENIED');
    const affected=new Set([change.cmdb_ci,...related.map(row=>row.ci_item)].filter(sysId));invariant(cis.every(ci=>affected.has(ci)),'DENIED');
    const readApprovals=()=>read('sysapproval_approver',`sysapproval=${change.sys_id}`,['sys_id','sysapproval','approver','state',config.approvalDigestField]);
    const approvals=await readApprovals();
    invariant(approvals.length>0&&new Set(approvals.map(row=>row.sys_id)).size===approvals.length,'DENIED');
    invariant(approvals.every(row=>sysId(row.sys_id)&&row.sysapproval===change.sys_id&&sysId(row.approver)&&row.approver!==config.executorUserSysId&&row.state==='approved'&&row[config.approvalDigestField]===intent.actionDigest),'DENIED');
    // The dedicated verifier account must have complete read visibility for
    // these CIs. Partial ACL visibility is an unqualified deployment, not proof.
    const incidents=await read('incident',`active=true^priorityIN1,2^cmdb_ciIN${cis.join(',')}`,['sys_id','active','priority','cmdb_ci'],1);
    invariant(incidents.length===0,'DENIED');
    const currentApprovals=await readApprovals();
    const ordered=rows=>[...rows].sort((a,b)=>String(a.sys_id).localeCompare(String(b.sys_id)));
    invariant(canonical(ordered(currentApprovals))===canonical(ordered(approvals)),'DENIED');
    const current=await readChange();invariant(canonical(current)===canonical(change),'DENIED');
    unchanged();
    return {verified:true,state:'Implement',incidentsClear:true,actionDigest:intent.actionDigest,approverId:`servicenow:${approvals[0].approver}`,
      source:'Live ServiceNow read-only Table API; explicit deployment mappings',reference,observedAt:new Date().toISOString()};
  }
}

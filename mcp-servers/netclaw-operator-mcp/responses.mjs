import {z} from 'zod';
import {fail} from '../../ui/netclaw-visual/src/management/errors.js';

const identifier=z.string().min(1).max(200), stamp=z.iso.datetime();
const json=z.json();
const truncation=z.strictObject({strings:z.number().int().nonnegative(),arrays:z.number().int().nonnegative(),objects:z.number().int().nonnegative(),depth:z.number().int().nonnegative()}).optional();
const object=shape=>z.strictObject({...shape,truncation});
export const envelopeSchema=object({contractVersion:z.literal(1),installationId:z.string().uuid(),source:z.string().min(1).max(4096),observedAt:stamp,
  data:json,freshness:z.enum(['observed','stale','partial','unknown']),warnings:z.array(z.string()).max(500),nextCursor:z.string().max(512).optional()});
export const operationSchema=object({operationId:z.string().uuid(),kind:identifier,
  state:z.enum(['admitted','preparing','waiting-approval','running','succeeded','failed','rolled-back','rollback-failed','cancellation-requested','cancelled','denied','expired','unknown']),
  sequence:z.number().int().nonnegative(),admittedAt:stamp,result:json.optional(),externalReference:identifier.optional(),
  proposalId:z.string().uuid().optional(),approvalRequired:z.boolean().optional(),proposal:json.optional(),retryAfterMs:z.number().int().nonnegative().optional()});
const capability=z.record(z.string(),json);
const harness=z.strictObject({type:z.enum(['openclaw','hermes']),version:z.string().nullable(),versionSource:z.string()});
const identitySchema=object({contract:z.strictObject({major:z.literal(1),minor:z.number().int().nonnegative()}),installationId:z.string().uuid(),principalId:identifier,
  hostId:z.string().regex(/^[a-f\d]{64}$/),sourceVersion:z.string(),harness,role:z.string(),configurationRevision:z.string().uuid(),observedAt:stamp,capabilities:capability,runtimeSettings:json});
const clientProposal=object({client:z.enum(['copilot','claude-code','codex']),targets:z.array(identifier),actions:z.array(z.enum(['inspect','delegate','propose','evidence','cancel'])),
  disclosure:z.array(z.enum(['summary','usage','evidence','conversation'])),expiresAt:z.number().int(),proposalId:z.string().uuid(),state:z.literal('pending-review'),expectedRevision:z.string().uuid(),disclosureNotice:z.string()});
const staged=object({contextId:z.string().uuid(),name:z.string(),size:z.number().int().nonnegative(),indexed:z.literal(false),reason:z.string().optional()});
const workspaceSchemas={
  'intent-state':envelopeSchema,'intent-read':envelopeSchema,'intent-preview':envelopeSchema,'intent-submit':operationSchema,
  'rag-list':object({documents:z.array(json).max(500),total:z.number().int().nonnegative(),nextCursor:z.string().optional(),stats:json,uploads:z.array(json).max(500),operations:z.array(json).max(500),source:z.string()}),
  'rag-search':object({results:z.array(json).max(20),searchId:z.string().uuid(),corpus_empty:z.boolean(),collection:z.string().optional(),latency_ms:z.number().nonnegative().optional(),message:z.string().optional()}),
  'rag-stage':staged,'rag-context':staged,
  'rag-upload':object({uploadId:z.string().uuid(),name:z.string(),size:z.number().int().positive(),sha256:z.string().regex(/^[a-f\d]{64}$/),indexed:z.literal(false)}),
  'rag-index':operationSchema,
  'canvas-import':object({id:z.string().uuid(),name:z.string(),version:z.literal(1)}),
  'canvas-export':object({id:z.string().uuid(),name:z.string(),content:json,source:z.string()}),
  'memory-search':envelopeSchema,'gcf-read':envelopeSchema,'meeting-read':envelopeSchema,'assessment-read':envelopeSchema,
  'assessment-reconsider':operationSchema,'mobile-capture-request':operationSchema,
  'assessment-preview':envelopeSchema,
  'mobile-inventory':envelopeSchema,'mobile-capture-preview':envelopeSchema,'mobile-capture-content':envelopeSchema,
};
export const operatorOutputs=Object.freeze({operator_identity:identitySchema,
  operator_resources:envelopeSchema,operator_snapshot:envelopeSchema,operator_events:envelopeSchema,operator_evidence:envelopeSchema,
  operator_operation_get:operationSchema,operator_request_submit:operationSchema,operator_cancel_request:operationSchema,
  operator_change_prepare:operationSchema,operator_change_apply:operationSchema,
  operator_conversation_open:object({conversationId:z.string().uuid()}),operator_client_prepare:clientProposal,
  operator_client_apply:operationSchema,operator_client_revoke:operationSchema,
  operator_workspace:z.union(Object.values(workspaceSchemas)),
});
const assistantOutputs=Object.freeze({
  netclaw_status:object({installationId:z.string().uuid(),harness,role:z.string(),configurationRevision:z.string().uuid(),capabilities:capability,
    grant:z.strictObject({id:z.string().uuid(),generation:z.number().int().positive(),actions:z.array(z.string()),targets:z.array(identifier),disclosure:z.array(z.string()),expiresAt:z.number().int()}),billing:z.string()}),
  netclaw_inventory:z.union([envelopeSchema,object({installationId:z.string().uuid(),harness:z.enum(['openclaw','hermes']),operations:z.array(operationSchema).max(500)})]),
  netclaw_evidence:envelopeSchema,netclaw_request:operationSchema,netclaw_request_status:operationSchema,netclaw_cancel:operationSchema,
  netclaw_propose_change:object({operationId:z.string().uuid(),proposalId:z.string().uuid(),state:z.string(),approvalRequired:z.literal(true),review:z.string()}),
});
export {assistantOutputs};

function validate(schema,value){
  // Reject non-JSON values and dangerous object keys before Zod recursion. This
  // also bounds depth/work for malformed adapter data and detects cycles.
  let visited=0;const ancestors=new Set();
  function visit(item,depth=0){
    if(++visited>100000||depth>32)fail('SOURCE_UNAVAILABLE');
    if(item===null||typeof item==='string'||typeof item==='boolean')return;
    if(typeof item==='number'&&Number.isFinite(item))return;
    if(typeof item!=='object'||ancestors.has(item))fail('SOURCE_UNAVAILABLE');
    ancestors.add(item);
    if(!Array.isArray(item)&&![Object.prototype,null].includes(Object.getPrototypeOf(item)))fail('SOURCE_UNAVAILABLE');
    for(const [key,entry] of Object.entries(item)){if(['__proto__','constructor','prototype'].includes(key))fail('SOURCE_UNAVAILABLE');visit(entry,depth+1);}
    ancestors.delete(item);
  }
  visit(value);
  if(Buffer.byteLength(JSON.stringify(value))>1024*1024)fail('SOURCE_UNAVAILABLE');
  const parsed=schema.safeParse(value);if(!parsed.success)fail('SOURCE_UNAVAILABLE');return parsed.data;
}
export function validateOperatorOutput(name,args,value){
  if(!Object.hasOwn(operatorOutputs,name))fail('DENIED');
  const schema=name==='operator_workspace'?workspaceSchemas[args.action]:operatorOutputs[name];
  if(!schema)fail('DENIED');return validate(schema,value);
}
export function validateAssistantOutput(name,args,value){
  if(!Object.hasOwn(assistantOutputs,name))fail('DENIED');return validate(assistantOutputs[name],value);
}

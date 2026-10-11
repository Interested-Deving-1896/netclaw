import { z } from 'zod';
import { fail } from '../../ui/netclaw-visual/src/management/errors.js';
export const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/).refine(v => !v.includes('..'));
export const nonce = z.string().regex(/^\d{13}:[a-f\d-]{36}$/);
export const action = z.enum(['settings.patch','runtime.select','service.start','service.stop','service.restart','risk.role','member.enroll','member.disable','member.enable','peer.trust','peer.untrust','security.patch','budget.patch','integration.configure','terminal-intent.prepare','terminal-intent.apply']);
export const kinds = z.enum(['overview','member','peer','edge','advisor','integration','skill','network','client']);
export const page = { cursor: z.string().max(512).optional(), limit: z.number().int().min(1).max(500).default(100) };
export const envKey = z.string().regex(/^[A-Z][A-Z0-9_]{0,100}$/);
export const patch = z.strictObject({
  provider: z.string().min(1).max(100).optional(), model: z.string().min(1).max(200).optional(), effort: z.enum(['low','medium','high','max']).optional(),
  role: z.enum(['standalone','border','member']).optional(), runtimeId: id.optional(), serviceId: z.enum(['hud','gateway','federation','hermes-companion','openshell']).optional(),
  monthlyLimit: z.number().min(0).max(1000000).optional(), dailyLimit: z.number().min(0).max(1000000).optional(),
  sessionBudgetUsd:z.number().min(0).max(1000000).optional(),maxToolCallsPerTurn:z.number().int().min(0).max(10000).optional(),
  contextWarningTokens:z.number().int().min(0).max(10000000).optional(),allowOverride:z.boolean().optional(),overrideIncrementUsd:z.number().min(0).max(1000000).optional(),
  normalizeCredentials:z.literal(true).optional(),
  fields: z.array(z.strictObject({ key: envKey, intent: z.enum(['keep','replace','clear']), value: z.string().max(4096).optional() })).max(100).optional(),
  mode: z.enum(['observe','enforce','disabled']).optional(), enabled: z.boolean().optional(), intent: z.string().max(65536).optional(),
  acknowledgeActiveWork: z.boolean().optional(),
  chatEnabled:z.boolean().optional(),disableChat:z.literal(true).optional(),
  grant:z.strictObject({type:z.enum(['tool','skill']),name:id,requiresApproval:z.literal(true),timeoutSeconds:z.number().int().min(1).max(600)}).optional(),
  revokeGrantIds:z.array(z.number().int().positive()).min(1).max(100).refine(ids=>new Set(ids).size===ids.length).optional(),
});
export const changeInput = { nonce, action, targets: z.array(id).min(1).max(100), expectedRevision: z.string().uuid(), patch };
// Action-specific shapes prevent an accepted field from becoming an accidental
// cross-domain capability as adapters are implemented. Unsupported adapters still
// deny dispatch; a schema alone never advertises qualification.
const fields = patch.shape;
const nonempty = schema => schema.refine(value => Object.keys(value).length > 0);
const servicePatch = z.strictObject({serviceId: fields.serviceId.unwrap(), acknowledgeActiveWork: fields.acknowledgeActiveWork});
const patches = {
  'settings.patch': nonempty(z.strictObject({provider:fields.provider,model:fields.model,effort:fields.effort,normalizeCredentials:fields.normalizeCredentials})),
  'runtime.select': z.strictObject({runtimeId:fields.runtimeId.unwrap(),acknowledgeActiveWork:fields.acknowledgeActiveWork}),
  'service.start': servicePatch, 'service.stop': servicePatch, 'service.restart': servicePatch,
  'risk.role': z.strictObject({role:fields.role.unwrap(),acknowledgeActiveWork:fields.acknowledgeActiveWork}),
  'member.enroll': z.strictObject({}), 'member.disable': z.strictObject({}), 'member.enable': z.strictObject({}),
  'peer.trust': z.strictObject({chatEnabled:fields.chatEnabled,grant:fields.grant,acknowledgeActiveWork:z.literal(true)}).refine(value=>value.chatEnabled!==undefined||value.grant!==undefined),
  'peer.untrust': z.strictObject({disableChat:fields.disableChat,revokeGrantIds:fields.revokeGrantIds,acknowledgeActiveWork:z.literal(true)}).refine(value=>value.disableChat===true||value.revokeGrantIds!==undefined),
  'security.patch': z.strictObject({mode:fields.mode.unwrap()}),
  'budget.patch': nonempty(z.strictObject({monthlyLimit:fields.monthlyLimit,dailyLimit:fields.dailyLimit,sessionBudgetUsd:fields.sessionBudgetUsd,maxToolCallsPerTurn:fields.maxToolCallsPerTurn,contextWarningTokens:fields.contextWarningTokens,allowOverride:fields.allowOverride,overrideIncrementUsd:fields.overrideIncrementUsd})),
  'integration.configure': z.strictObject({fields:fields.fields.unwrap().min(1).refine(rows=>new Set(rows.map(row=>row.key)).size===rows.length)}),
  'terminal-intent.prepare': z.strictObject({intent:fields.intent.unwrap().min(1)}),
  'terminal-intent.apply': z.strictObject({intent:fields.intent.unwrap().min(1)}),
};
export const changeSchema = z.discriminatedUnion('action',Object.entries(patches).map(([name,shape])=>
  z.strictObject({...changeInput,action:z.literal(name),patch:shape})));
const query = z.string().min(1).max(4000).refine(value=>value.trim().length>0);
const content = z.string().max(14*1024*1024);
const name = z.string().min(1).max(200);
const intentInput={request:z.string().min(1).max(4000).refine(value=>value.trim().length>0),requestKind:z.enum(['read-only','change']),changeMode:z.enum(['production','local-lab']),targetDeviceIds:z.array(id).min(1).max(100).refine(ids=>new Set(ids).size===ids.length),expectedRevision:z.string().uuid(),policyRevision:z.string().uuid().optional()};
const workspaceActions = {
  'peer-chat-list':[false,{}],
  'peer-chat-read':[false,{id:z.string().uuid()}],
  'peer-chat-preview':[false,{peer:id,text:query,conversationId:z.string().uuid().optional()}],
  'peer-chat-submit':[true,{peer:id,text:query,reviewId:z.string().uuid()}],
  'peer-policy':[false,{id}],
  'intent-state':[false,{}], 'intent-read':[false,{id}],
  'intent-preview':[false,intentInput],
  'intent-submit':[true,{...intentInput,approvalReference:id.optional()}],
  'rag-list': [false,{}],
  'rag-search': [false,{query,collection:z.string().regex(/^[\w.-]{1,128}$/).refine(v=>!v.includes('..')).optional(),k:z.number().int().min(1).max(20).optional()}],
  'rag-stage': [true,{name:name.optional(),content}],
  'rag-upload': [true,{name,content,docType:z.enum(['vendor','standard','customer','install-guide','other']).optional()}],
  'rag-index': [true,{id,expectedDocumentId:id.optional()}],
  'rag-context': [true,{id,indices:z.array(z.number().int().min(0).max(19)).min(1).max(20).refine(v=>new Set(v).size===v.length)}],
  'memory-search': [false,{query}], 'gcf-read': [false,{id:id.optional()}],
  'meeting-read': [false,{id:id.optional()}], 'assessment-read': [false,{id}],
  'assessment-preview': [false,{id,query}],
  'assessment-reconsider': [true,{id,query,reviewId:id}],
  'canvas-import': [true,{name:name.optional(),content}], 'canvas-export': [false,{id}],
  'mobile-capture-request': [true,{id,consentReference:id,capability:z.enum(['camera.capture','audio.record'])}],
  'mobile-inventory': [false,{}],
  'mobile-capture-preview': [false,{id,capability:z.enum(['camera.capture','audio.record'])}],
  'mobile-capture-content': [false,{id,offset:z.number().int().min(0).max(6*1024*1024).default(0)}],
};
const workspaceSchema = z.discriminatedUnion('action',Object.entries(workspaceActions).map(([action,[mutates,args]])=>
  z.strictObject({action:z.literal(action),...(mutates?{nonce}:{}),args:z.strictObject(args),...page})));
export const schemas = Object.freeze({
  operator_identity: z.strictObject({}),
  operator_resources: z.strictObject({ kind: kinds, resourceId:id.optional(), sourceKind:z.enum(['configured','historical']).optional(), filters: z.strictObject({ query: z.string().max(256).optional(), status: z.enum(['active','inactive','unknown']).optional() }).optional(), ...page }),
  operator_snapshot: z.strictObject({ domain: z.enum(['settings','security','usage','knowledge','documentation']), resourceId: id.optional(), window: z.enum(['day','week','month']).optional(), ...page }),
  operator_conversation_open: z.strictObject({ nonce, conversationId: id.optional(), view: z.enum(['chat','canvas','avatar']).default('chat'), model: z.string().max(200).optional(), effort: z.enum(['low','medium','high','max']).optional() }),
  operator_request_submit: z.strictObject({ nonce, conversationId: id, prompt: z.string().max(65536).refine(v => Buffer.byteLength(v) <= 65536), contextIds: z.array(id).max(20).default([]) }),
  operator_operation_get: z.strictObject({ operationId: id }),
  operator_events: z.strictObject({ operationId: id, after: z.number().int().min(0).default(0), ...page }),
  operator_cancel_request: z.strictObject({ operationId: id, nonce }),
  operator_change_prepare: changeSchema,
  operator_change_apply: z.strictObject({ proposalId: id, nonce, expectedRevision: z.string().uuid(), approvalReference: id.optional(), replacements: z.record(envKey, z.string().max(65536)).optional() }),
  operator_evidence: z.strictObject({ kind: z.enum(['gait','log','artifact','approval']), id: id.optional(), filters: z.strictObject({ query: z.string().max(200).optional(), severity: z.enum(['info','warning','error','debug','unknown']).optional(),since:z.string().datetime({offset:true}).optional(),until:z.string().datetime({offset:true}).optional() }).optional(), ...page }).refine(value=>
    !(value.filters?.since||value.filters?.until)||value.kind==='log'&&(!value.filters.since||!value.filters.until||Date.parse(value.filters.since)<=Date.parse(value.filters.until))),
  operator_workspace: workspaceSchema,
  operator_client_prepare: z.strictObject({ nonce, client: z.enum(['copilot','claude-code','codex']), targets: z.array(id).min(1).max(100), actions: z.array(z.enum(['inspect','delegate','propose','evidence','cancel'])).min(1).max(5), disclosure: z.array(z.enum(['summary','usage','evidence','conversation'])).min(1).max(4), expiresAt: z.number().int().positive() }),
  operator_client_apply: z.strictObject({ proposalId: id, nonce, expectedRevision: z.string().uuid() }),
  operator_client_revoke: z.strictObject({ grantId: id, nonce }),
});
export function parseOperatorInput(name, args) {
  if (!Object.hasOwn(schemas, name)) fail('DENIED');
  const parsed = schemas[name].safeParse(args); if (!parsed.success) fail('INVALID_INPUT'); return parsed.data;
}

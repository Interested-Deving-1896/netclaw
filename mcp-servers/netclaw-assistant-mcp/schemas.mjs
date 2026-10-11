import { z } from 'zod';
import { id, nonce, page, changeSchema,changeInput } from '../netclaw-operator-mcp/schemas.mjs';
import { fail } from '../../ui/netclaw-visual/src/management/errors.js';
export const schemas = Object.freeze({
  netclaw_status: z.strictObject({}),
  netclaw_inventory: z.strictObject({ kind: z.enum(['overview','integration','skill']), ...page }),
  netclaw_evidence: z.strictObject({ kind: z.enum(['gait','usage','network','diagnostic']), id: id.optional(), ...page }),
  netclaw_request: z.strictObject({ nonce, prompt: z.string().max(65536).refine(v => Buffer.byteLength(v) <= 65536), conversationId: id.optional(), contextIds: z.array(id).max(20).default([]) }),
  netclaw_request_status: z.strictObject({ requestId: id.optional(), nonce: nonce.optional(), after: z.number().int().min(0).default(0) }).refine(v => Boolean(v.requestId) !== Boolean(v.nonce)),
  netclaw_cancel: z.strictObject({ requestId: id, nonce }),
  // Claude Code omits tools whose input schema has root oneOf without root
  // properties. Advertise a strict object and retain the narrower action union
  // at dispatch. No previously invalid cross-action field becomes executable.
  netclaw_propose_change: z.strictObject(changeInput),
});
export function parseAssistantInput(name, args) {
  if (!Object.hasOwn(schemas, name)) fail('DENIED');
  const parsed = (name==='netclaw_propose_change'?changeSchema:schemas[name]).safeParse(args); if (!parsed.success) fail('INVALID_INPUT'); return parsed.data;
}

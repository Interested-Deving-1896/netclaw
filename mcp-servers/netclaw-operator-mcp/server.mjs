import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { schemas,parseOperatorInput } from './schemas.mjs';
import { safeError } from '../../ui/netclaw-visual/src/management/errors.js';
import { operatorOutputs,validateOperatorOutput } from './responses.mjs';

const reads=new Set(['operator_identity','operator_resources','operator_snapshot','operator_operation_get','operator_events','operator_evidence']);
export function operatorServer(service) {
  const server=new McpServer({name:'netclaw-operator',version:'0.1.0'});
  for(const [name,inputSchema] of Object.entries(schemas)) server.registerTool(name,{
    description:`Private human management: ${name.replace('operator_','').replaceAll('_',' ')}. Bound to one verified existing installation.`,inputSchema,outputSchema:operatorOutputs[name],
    annotations:{readOnlyHint:reads.has(name),destructiveHint:!reads.has(name),openWorldHint:false,idempotentHint:reads.has(name)},
  },async args=>{
    try{const value=validateOperatorOutput(name,args,service.clean(await service.call(name,parseOperatorInput(name,args))));return{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};}
    catch(error){const value={error:safeError(error)};return{isError:true,content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};}
  });
  return server;
}
export async function serveOperator(service){const server=operatorServer(service);await server.connect(new StdioServerTransport());return server;}

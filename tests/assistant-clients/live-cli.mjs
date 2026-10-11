/** Opt-in, small provider-backed client check. Never selects an owner NetClaw.
 * Uses existing client authentication, isolated per-run MCP configuration and
 * synthetic installation homes. This does not qualify runtime delegation. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {installationFixture,nonce} from '../operator/fixtures.mjs';
import {ManagementService} from '../../ui/netclaw-visual/src/management/service.js';
if(process.env.NETCLAW_TEST_LIVE_CLIENTS!=='1')throw Error('Set NETCLAW_TEST_LIVE_CLIENTS=1 for explicitly authorized provider-backed synthetic client checks.');
const root=fileURLToPath(new URL('../../',import.meta.url));
const client=process.env.NETCLAW_TEST_CLIENT,kind=process.env.NETCLAW_TEST_HARNESS||'openclaw';
if(!['codex','claude-code'].includes(client)||!['openclaw','hermes'].includes(kind))throw Error('Select codex or claude-code and an existing supported harness type.');
const working=fs.mkdtempSync(path.join(os.tmpdir(),'netclaw150-client-')),selected=installationFixture(null,kind);
const configFiles=client==='codex'?[path.join(os.homedir(),'.codex/config.toml')]:[path.join(os.homedir(),'.claude/settings.json'),path.join(os.homedir(),'.claude.json')];
const configDigests=()=>configFiles.map(file=>fs.existsSync(file)?createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null);
const beforeConfig=configDigests();
const registrationDigests=()=>configFiles.map(file=>{
  if(!fs.existsSync(file))return null;
  if(file.endsWith('/.claude.json')){
    const value=JSON.parse(fs.readFileSync(file));
    return createHash('sha256').update(JSON.stringify({mcpServers:value.mcpServers,projects:Object.fromEntries(Object.entries(value.projects||{}).map(([name,project])=>[name,{mcpServers:project.mcpServers,enabledMcpjsonServers:project.enabledMcpjsonServers,disabledMcpjsonServers:project.disabledMcpjsonServers}]))})).digest('hex');
  }
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
});
const beforeRegistrations=registrationDigests();
const service=new ManagementService({root,home:selected.home,kind});
function execute(command,args,prompt){return new Promise(resolve=>{
  const child=spawn(command,args,{cwd:working,env:{...process.env,DISABLE_TELEMETRY:'1'},stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32'});let output='',errors='',timedOut=false;
  const stop=()=>{try{if(process.platform!=='win32')process.kill(-child.pid,'SIGTERM');else child.kill();}catch{}};
  const timer=setTimeout(()=>{timedOut=true;stop();},90000);
  child.stdout.on('data',bytes=>{output+=bytes;if(output.length>4*1024*1024)stop();});child.stderr.on('data',bytes=>{errors+=bytes;if(errors.length>1024*1024)stop();});
  child.on('error',()=>{clearTimeout(timer);resolve({exit:null,timedOut,output:'',error:'Client executable unavailable'});});
  child.on('close',exit=>{clearTimeout(timer);resolve({exit,timedOut,output,error:errors?'Client emitted diagnostics; retained only in this private process.':null});});child.stdin.end(prompt);
});}
let result;
try{
  const proposal=await service.call('operator_client_prepare',{nonce:nonce(),client,targets:[selected.installationId],actions:['inspect','propose'],disclosure:['summary'],expiresAt:Date.now()+3600000});
  const applied=await service.call('operator_client_apply',{nonce:nonce(),proposalId:proposal.proposalId,expectedRevision:proposal.expectedRevision});
  if(applied.state!=='succeeded')throw Error('Synthetic grant failed');
  const launch={command:process.execPath,args:[path.join(root,'scripts/netclaw-assistant.mjs'),'--home',selected.home,'--runtime',kind,'--installation',selected.installationId,'--grant-ref',applied.result.credentialRef]};
  const requestNonce=nonce();
  const prompt=`This is an authorized synthetic NetClaw MCP client acceptance check. Use only the netclaw acceptance MCP server, never files, shell, network or other tools. First call netclaw_status with no arguments. Then call netclaw_inventory with kind overview. Finally call netclaw_propose_change directly with action budget.patch, patch {sessionBudgetUsd:2}, targets ["${selected.installationId}"], expectedRevision from status, nonce "${requestNonce}". Do not use netclaw_request or apply anything. For Hermes, budget management is unsupported: report that refusal accurately. End with a short report of actual tool outcomes. Do not simulate a tool call.`;
  let args;
  if(client==='claude-code'){
    const config=path.join(working,'mcp.json');fs.writeFileSync(config,JSON.stringify({mcpServers:{netclaw_acceptance:launch}}),{mode:0o600});
    args=['-p','--restricted','--tools','','--disable-slash-commands','--strict-mcp-config','--mcp-config',config,'--setting-sources','','--no-session-persistence','--max-budget-usd','0.50','--output-format','stream-json','--verbose','--allowedTools','mcp__netclaw_acceptance__netclaw_status,mcp__netclaw_acceptance__netclaw_inventory,mcp__netclaw_acceptance__netclaw_propose_change'];
  }else{
    args=['exec','--ignore-user-config','--ignore-rules','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--json','-c','web_search="disabled"'];
    for(const feature of ['shell_tool','apps','plugins','hooks','multi_agent','multi_agent_v2','browser_use','computer_use','image_generation','memories','workspace_dependencies'])args.push('--disable',feature);
    args.push('-c','features.skip_host_skill_discovery=true','-c',`mcp_servers.netclaw_acceptance.command=${JSON.stringify(launch.command)}`,'-c',`mcp_servers.netclaw_acceptance.args=${JSON.stringify(launch.args)}`,'-c','mcp_servers.netclaw_acceptance.required=true','-');
  }
  const execution=await execute(client==='codex'?'codex':'claude',args,prompt);
  const events=execution.output.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
  const calls=events.flatMap(event=>client==='codex'&&event.item?.type==='mcp_tool_call'?[{tool:event.item.tool,status:event.item.status,error:event.item.error||null}]:
    event.type==='assistant'?(event.message?.content||[]).filter(block=>block.type==='tool_use').map(block=>({tool:block.name,status:'called'})):[]);
  const unique=[...new Set(calls.map(call=>call.tool.replace(/^mcp__netclaw_acceptance__/,'').replace(/^mcp__netclaw_acceptance\./,'')))];
  const proposals=service.journal.records('proposal',service.binding.principal);
  result={client,harness:kind,exit:execution.exit,timedOut:execution.timedOut,toolCalls:unique,
    expectedToolsObserved:['netclaw_status','netclaw_inventory','netclaw_propose_change'].every(name=>unique.includes(name)),
    proposals:proposals.length,proposalState:proposals[0]?.state||null,sourceKind:'Synthetic installation using actual authenticated external client and provider',
    runtimeDelegationQualified:false,clientStateFileUnchanged:JSON.stringify(beforeConfig)===JSON.stringify(configDigests()),
    registrationsAndSettingsPreserved:JSON.stringify(beforeRegistrations)===JSON.stringify(registrationDigests()),
    toolOutcomes:events.flatMap(event=>event.item?.type==='mcp_tool_call'&&event.item.status!=='in_progress'?[{tool:event.item.tool,result:event.item.result,error:event.item.error}]:
      event.type==='user'?(event.message?.content||[]).filter(block=>block.type==='tool_result').map(block=>({isError:block.is_error,result:block.content})):[]),
    ...(client==='codex'?{usage:events.findLast(event=>event.type==='turn.completed')?.usage||null}:{usage:events.findLast(event=>event.type==='result')?.usage||null,costUsd:events.findLast(event=>event.type==='result')?.total_cost_usd??null}),
    errors:events.filter(event=>event.type==='error').map(()=>({error:'Client reported an error; raw account and provider diagnostics are not exported.'})),
    finalReport:client==='claude-code'?events.findLast(event=>event.type==='result')?.result:undefined,
  };
  console.log(JSON.stringify(result,null,2));
  if(execution.exit!==0||!result.expectedToolsObserved||(kind==='openclaw'&&proposals.length!==1)||(kind==='hermes'&&proposals.length!==0))process.exitCode=1;
}finally{await service.close();selected.cleanup();fs.rmSync(working,{recursive:true,force:true});}

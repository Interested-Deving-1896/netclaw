import {ConnectionProfile,hostContext,validateProfile} from '../state/profiles';
import {quotePosix,launchProfile} from '../connection/connect';
import {execFile} from 'node:child_process';

export interface ClientGrant {
  grantId:string;installationId:string;client:'copilot'|'claude-code'|'codex';generation:number;
  credentialRef:string;actions:string[];targets:string[];disclosure:string[];expiresAt:number;
  revokedAt:number|null;status:'active'|'expired'|'revoked';
}
export interface Registration {profile:ConnectionProfile;grant:ClientGrant;enabled:boolean}
export interface ClientVersion {client:'claude-code'|'codex';version:string;host:string;verified:boolean}
const qualifiedVersions={'claude-code':'2.1.286',codex:'0.162.1'} as const;
export function parseClientVersion(client:ClientVersion['client'],output:string):ClientVersion {
  const match=(client==='codex'?/^codex-cli (\d+\.\d+\.\d+)\s*$/:/^(\d+\.\d+\.\d+) \(Claude Code\)\s*$/).exec(output);
  if(!match)throw Error('Unrecognized assistant CLI version. Review the installed client before exporting registration.');
  return {client,version:match[1]!,host:hostContext(),verified:match[1]===qualifiedVersions[client]};
}
export async function probeClientVersion(client:ClientVersion['client']):Promise<ClientVersion> {
  if(process.platform==='win32')throw Error('Open a WSL or Remote SSH extension host to export POSIX terminal registration.');
  const output=await new Promise<string>((resolve,reject)=>execFile(client==='codex'?'codex':'claude',['--version'],
    {timeout:5000,maxBuffer:4096,encoding:'utf8',windowsHide:true,shell:false},
    (error,stdout)=>error?reject(Error('Assistant CLI version unavailable on this extension host. Install/sign in through that client’s normal workflow.')):resolve(stdout)));
  const result=parseClientVersion(client,output);
  if(!result.verified)throw Error(`Installed ${client} ${result.version} differs from the verified command version ${qualifiedVersions[client]}. Registration export is paused pending compatibility review; no client configuration was changed.`);
  return result;
}
export const registrationName=(grant:ClientGrant):string=>`netclaw-${grant.installationId}-${grant.grantId}`;
export function assistantLaunch(profile:ConnectionProfile,grant:ClientGrant):{command:string;args:string[]} {
  validateProfile(profile);
  if(profile.context!==hostContext()||!profile.installationId||!profile.hostId||!profile.principalId||grant.installationId!==profile.installationId||
    !/^[a-f\d-]{36}$/.test(grant.grantId)||!/^NETCLAW_CLIENT_[A-F\d]{32}_TOKEN$/.test(grant.credentialRef)||
    grant.credentialRef!==`NETCLAW_CLIENT_${grant.grantId.replaceAll('-','').toUpperCase()}_TOKEN`||
    grant.status!=='active'||grant.revokedAt!==null||grant.expiresAt<=Date.now())throw Error('Review an active grant bound to this installation and extension host.');
  // Derive a fixed sibling entry point. Neither client labels nor model content
  // can choose a launcher, executable or private operator method.
  const args=[profile.launcherPath.replace(/netclaw-operator\.mjs$/,'netclaw-assistant.mjs'),'--home',profile.home,'--runtime',profile.harness,
    '--installation',profile.installationId,'--grant-ref',grant.credentialRef];
  const base=launchProfile(profile);
  if(profile.transport==='ssh')return {command:base.command,args:[...base.args.slice(0,-1),[profile.nodePath,...args].map(quotePosix).join(' ')]};
  return {command:profile.nodePath,args};
}
export function terminalPreview(registration:Registration,version:ClientVersion):string {
  const {profile,grant}=registration,launch=assistantLaunch(profile,grant),name=registrationName(grant);
  if(grant.client==='copilot')throw Error('Use the VS Code MCP provider for Copilot.');
  if(!version?.verified||version.host!==hostContext()||version.client!==grant.client||version.version!==qualifiedVersions[grant.client])throw Error('Verify this client version on the current extension host before exporting registration.');
  const command=(parts:string[])=>parts.map(quotePosix).join(' ');
  const add=grant.client==='codex'?['codex','mcp','add',name,'--',launch.command,...launch.args]:['claude','mcp','add','--transport','stdio','--scope','user',name,'--',launch.command,...launch.args];
  const remove=grant.client==='codex'?['codex','mcp','remove',name]:['claude','mcp','remove','--scope','user',name];
  return [
    '# NetClaw assistant registration — review before running',
    `# Client: ${grant.client}; installation: ${grant.installationId}; host: ${profile.context}`,
    '# Run in a POSIX terminal on THIS extension host. WSL: use this exact distribution.',
    '# Native Windows PowerShell/cmd syntax is not supplied by this preview.',
    '# Adds one unique registration. Other servers are unchanged. No credential values are exported.',
    '# Existing registrations are not overwritten: use a new grant for a changed binding.',
    `# Permissions: ${grant.actions.join(', ')}. Disclosure: ${grant.disclosure.join(', ')}.`,
    `# Expires: ${new Date(grant.expiresAt).toISOString()}. Results may enter the client model provider.`,
    `# Observed client version: ${version.version}. Registration grammar qualified for this exact version.`,
    command([grant.client==='codex'?'codex':'claude','--version']),
    command(add),'',
    '# To remove this client registration (also revoke its backend grant in NetClaw):',
    `# ${command(remove)}`,
    '# Terminal registration works without VS Code running. Runtime authorization remains on the backend.',
  ].join('\n')+'\n';
}

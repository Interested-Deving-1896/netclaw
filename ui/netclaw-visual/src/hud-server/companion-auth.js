import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {withManagementConfigurationLock} from '../management/shared-lock.js';
import {readOwned,atomicPrivate} from '../management/files.js';
import {invariant} from '../management/errors.js';
import {parseEnvData} from '../security/private-files.js';

/** Configure only the selected launcher's existing private auth source. No spawn. */
export function prepareCompanionAuth(selected,{key,port,expectedEnvironment}){
  return withManagementConfigurationLock(selected.home,()=>{
    const identity=JSON.parse(readOwned(path.join(selected.statePath,'installation.json'),{limit:8192}));
    invariant(identity.schemaVersion===1&&identity.installationId===selected.installationId,'IDENTITY_CHANGED');
    const current=readOwned(selected.envPath,{missing:true});
    invariant((current===null&&expectedEnvironment===null)||(current!==null&&expectedEnvironment!==null&&current.equals(expectedEnvironment)),'STALE_REVISION');
    const file=path.join(selected.statePath,'companion-auth.json'),saved=readOwned(file,{missing:true,limit:8192});
    const auth=saved?JSON.parse(saved):{};invariant(auth&&typeof auth==='object'&&!Array.isArray(auth),'INCOMPATIBLE');
    if(key&&auth.key)invariant(key===auth.key,'DENIED');
    let credential=key||auth.key;
    if(!credential){invariant(saved===null,'UNAUTHENTICATED');credential=randomBytes(32).toString('hex');auth.key=credential;}
    invariant(/^[a-f0-9]{64}$/.test(credential),'UNAUTHENTICATED');
    invariant(Number.isInteger(port)&&port>=1024&&port<=65535);
    if(!saved||auth.port!==port)atomicPrivate(file,JSON.stringify({...auth,port},null,2)+'\n');
    return {key:credential,port};
  });
}

/** Observe normalized or legacy authentication without generating credentials. */
export function readCompanionAuth(selected,explicit={}){
  const identity=JSON.parse(readOwned(path.join(selected.statePath,'installation.json'),{limit:8192}));
  invariant(identity.schemaVersion===1&&identity.installationId===selected.installationId,'IDENTITY_CHANGED');
  const configured=parseEnvData((readOwned(selected.envPath,{missing:true})||Buffer.from('')).toString());
  const saved=readOwned(path.join(selected.statePath,'companion-auth.json'),{missing:true,limit:8192});
  const auth=saved?JSON.parse(saved):{};invariant(auth&&typeof auth==='object'&&!Array.isArray(auth),'INCOMPATIBLE');
  const envKey=explicit.NETCLAW_HERMES_HUD_API_KEY||configured.NETCLAW_HERMES_HUD_API_KEY;
  if(envKey&&auth.key)invariant(envKey===auth.key,'DENIED');
  const key=envKey||auth.key,port=Number(explicit.NETCLAW_HERMES_HUD_PORT||configured.NETCLAW_HERMES_HUD_PORT||auth.port||8643);
  invariant(typeof key==='string'&&/^[a-f0-9]{64}$/.test(key),'UNAUTHENTICATED');
  invariant(Number.isInteger(port)&&port>=1024&&port<=65535);
  return {key,port};
}

import fs from 'node:fs';
import path from 'node:path';
import { Journal } from './journal.js';
import { readOwned,ownedDirectory } from './files.js';
import {invariant} from './errors.js';

/** Existing HUD/CLI writers participate once this installation is managed. */
export function withManagementConfigurationLock(home, callback) {
  const state=path.join(home,'netclaw-hud'),directory=path.join(state,'management');
  try{fs.lstatSync(directory);}catch(error){if(error.code==='ENOENT')return callback();throw error;}
  ownedDirectory(home,{privateMode:false});ownedDirectory(state);ownedDirectory(directory);
  const identity=JSON.parse(readOwned(path.join(state,'installation.json')));
  invariant(identity.schemaVersion===1&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(identity.installationId),'INCOMPATIBLE');
  const journal=new Journal(directory,identity.installationId,{existingOnly:true});
  let token,closed=false;
  const release=()=>{if(closed)return;closed=true;try{if(token)journal.unlock('configuration',token);}finally{journal.close();}};
  try{
    token=journal.lock('configuration',`existing-client:${process.pid}`);
    const result=callback();
    if(result&&typeof result.then==='function')return Promise.resolve(result).finally(release);
    release();return result;
  }catch(error){release();throw error;}
}

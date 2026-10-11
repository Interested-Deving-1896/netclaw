import fs from 'node:fs';
import path from 'node:path';
import { Journal } from './journal.js';
import { readOwned } from './files.js';

/** Existing HUD/CLI writers participate once this installation is managed. */
export function withManagementConfigurationLock(home, callback) {
  const state=path.join(home,'netclaw-hud'),directory=path.join(state,'management');
  if(!fs.existsSync(path.join(directory,'operations.sqlite')))return callback();
  const identity=JSON.parse(readOwned(path.join(state,'installation.json')));
  const journal=new Journal(directory,identity.installationId);
  let token,closed=false;
  const release=()=>{if(closed)return;closed=true;try{if(token)journal.unlock('configuration',token);}finally{journal.close();}};
  try{
    token=journal.lock('configuration',`existing-client:${process.pid}`);
    const result=callback();
    if(result&&typeof result.then==='function')return Promise.resolve(result).finally(release);
    release();return result;
  }catch(error){release();throw error;}
}

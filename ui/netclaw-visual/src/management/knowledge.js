import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {environment} from './configuration.js';
import {invariant} from './errors.js';

/** Bounded lexical projection of the existing memory database; no embedding,
 * schema initialization, provider request, or ambient default home. */
export function searchMemory(binding,query){
  binding.assertCurrent();invariant(typeof query==='string'&&query.trim()&&query.length<=4000);
  const configured=environment(binding).MEMORY_DATA_DIR,directory=configured||path.join(binding.home,'memory');
  invariant(path.isAbsolute(directory)&&!/[\0\r\n]/.test(directory),'INVALID_INPUT');
  const file=path.join(directory,'memory.db');let db;
  try{
    const stat=fs.lstatSync(file);invariant(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&stat.size<=256*1024*1024&&fs.realpathSync(file)===file,'DENIED');
    db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=1000');
    const pattern='%'+query.trim().replace(/[\\%_]/g,'\\$&')+'%';
    const facts=db.prepare("SELECT id,entity,key,value,metadata,valid_from,valid_to,created_at FROM facts WHERE entity LIKE ? ESCAPE '\\' OR key LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 101").all(pattern,pattern,pattern);
    const decisions=db.prepare("SELECT id,context,decision,rationale,entities,cr_number,gait_ref,created_at FROM decisions WHERE context LIKE ? ESCAPE '\\' OR decision LIKE ? ESCAPE '\\' OR entities LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 101").all(pattern,pattern,pattern);
    const links=db.prepare("SELECT id,subject,predicate,object,metadata,created_at FROM graph_links WHERE subject LIKE ? ESCAPE '\\' OR object LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 101").all(pattern,pattern);
    return {available:true,facts:facts.slice(0,100),decisions:decisions.slice(0,100),links:links.slice(0,100),truncated:[facts,decisions,links].some(rows=>rows.length>100),
      searchMode:'Literal text search in recorded memory',sourceKind:'historical',observedAt:new Date().toISOString(),
      scope:'Up to 100 matches per record type. Validity windows and original references are retained; historical facts are not current device observations.'};
  }catch(error){if(error.code==='DENIED')throw error;return {available:false,sourceKind:'historical',reason:'The selected installation’s memory database is missing, unreadable or incompatible. No database was created.'};}
  finally{db?.close();}
}

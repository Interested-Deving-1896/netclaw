import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {ownedDirectory,readOwned} from './files.js';
import {invariant} from './errors.js';

/** Read a stable private copy, so SQLite cannot create or alter live sidecars.
 * Concurrent source changes fail closed; a later explicit refresh may retry. */
export function withSqliteSnapshot(binding,file,read){
  binding.assertCurrent();ownedDirectory(path.dirname(file));
  let directory,db;
  try{
    const bytes=readOwned(file,{limit:64*1024*1024}),wal=readOwned(file+'-wal',{missing:true,limit:16*1024*1024});
    directory=fs.mkdtempSync(path.join(binding.statePath,'.sqlite-read-'));fs.chmodSync(directory,0o700);
    const snapshot=path.join(directory,'snapshot.db');fs.writeFileSync(snapshot,bytes,{mode:0o600});if(wal)fs.writeFileSync(snapshot+'-wal',wal,{mode:0o600});
    const freshWal=readOwned(file+'-wal',{missing:true,limit:16*1024*1024});
    invariant(readOwned(file,{limit:64*1024*1024}).equals(bytes)&&(wal===null?freshWal===null:freshWal!==null&&wal.equals(freshWal)),'BUSY');
    db=new DatabaseSync(snapshot,{readOnly:true,allowExtension:false});db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
    const result=read(db);binding.assertCurrent();return result;
  }finally{db?.close();if(directory)fs.rmSync(directory,{recursive:true,force:true});}
}

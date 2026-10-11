import path from 'node:path';
import {spawn} from 'node:child_process';
import {environment} from './configuration.js';
import {invariant,fail} from './errors.js';

export async function analyzeGcf(binding,root,content){
  binding.assertCurrent();invariant(typeof content==='string'&&Buffer.byteLength(content)<=1024*1024,'INVALID_INPUT');
  const selected=environment(binding),python=selected.NETCLAW_PY||'python3';invariant(python==='python3'||path.isAbsolute(python),'UNQUALIFIED');
  const env={PATH:process.env.PATH,HOME:binding.home,PYTHONNOUSERSITE:'1',PYTHONUNBUFFERED:'1',
    NETCLAW_GCF_MODE:selected.NETCLAW_GCF_MODE||'full',NETCLAW_TABULAR_FORMAT:selected.NETCLAW_TABULAR_FORMAT||'gcf'};
  const child=spawn(python,['-u',path.join(root,'scripts/netclaw-gcf-review.py')],{cwd:binding.home,env,stdio:['pipe','pipe','ignore'],shell:false});
  const chunks=[];let size=0;
  const value=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('GCF analysis timed out'));},10000);timer.unref();
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.stdout.on('data',bytes=>{size+=bytes.length;if(size>65536){child.kill('SIGTERM');reject(Error('GCF response exceeded its bound'));}else chunks.push(bytes);});
    child.once('close',code=>{clearTimeout(timer);if(code!==0){reject(Error('GCF analysis unavailable'));return;}try{resolve(JSON.parse(Buffer.concat(chunks)));}catch(error){reject(error);}});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({content}));
  }).catch(()=>fail('SOURCE_UNAVAILABLE'));
  binding.assertCurrent();invariant(value&&typeof value==='object'&&Object.hasOwn(value,'measurement'),'SOURCE_UNAVAILABLE');return value;
}

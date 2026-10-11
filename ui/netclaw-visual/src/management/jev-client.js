import path from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {environment} from './configuration.js';
import {readOwned,ownedDirectory} from './files.js';
import {invariant,fail} from './errors.js';

const keys=['JEV_ENABLED','JEV_BASE_URL','JEV_ENDPOINT','JEV_MODEL','JEV_API_KEY','TYPESAFE_API_KEY','JEV_COMPATIBLE_API_KEY','JEV_COMPATIBLE_KEY_ENDPOINT','JEV_DAILY_LIMIT_USD','JEV_CASE_LIMIT_USD','JEV_INPUT_PRICE_PER_MILLION','JEV_TIMEOUT_SECONDS','JEV_DATA_DIR','JEV_TASK_ID','JEV_GAIT_ROOT','GAIT_VENV'].sort();
export class JevClient{
  constructor(binding,root){Object.assign(this,{binding,root});}
  configuration(task){
    this.binding.assertCurrent();invariant(/^[A-Za-z0-9_.:/-]{1,128}$/.test(task),'DENIED');const source=environment(this.binding);
    const selected=Object.fromEntries(keys.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]));
    // Bind both task and audit to this selected installation, never ambient HOME.
    selected.JEV_TASK_ID=task;selected.JEV_DATA_DIR=source.JEV_DATA_DIR||path.join(this.binding.home,'jev');
    selected.JEV_GAIT_ROOT=this.binding.home;selected.GAIT_VENV=path.join(this.binding.home,'gait-venv');
    ownedDirectory(selected.JEV_DATA_DIR);const settings=readOwned(path.join(selected.JEV_DATA_DIR,'settings.json'),{missing:true,limit:1024*1024})||Buffer.alloc(0);
    const entries=keys.filter(key=>selected[key]!==undefined).map(key=>[key,selected[key]]);
    const revision=createHash('sha256').update(JSON.stringify(entries)+'\n').update(settings).digest('hex');
    const inherited=Object.fromEntries(['PATH','USER','LOGNAME','LANG','TMPDIR'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
    return {revision,env:{...inherited,HOME:this.binding.home,...selected,PYTHONUNBUFFERED:'1'}};
  }
  async evaluate(task,args,revision){
    const config=this.configuration(task);invariant(config.revision===revision,'STALE_REVISION');
    const client=new Client({name:'netclaw-operator-jev',version:'1.0.0'});
    const transport=new StdioClientTransport({command:path.join(this.binding.home,'jev-venv','bin','python'),args:['-u',path.join(this.root,'mcp-servers/jev-mcp/server.py'),'--managed-config-sha256',revision],env:config.env,cwd:this.binding.home,stderr:'ignore'});
    try{
      await client.connect(transport,{timeout:15000});const result=await client.callTool({name:'jev_evaluate',arguments:args},{timeout:150000});
      invariant(!result.isError,'SOURCE_UNAVAILABLE');const data=result.structuredContent||JSON.parse(result.content?.find(row=>row.type==='text')?.text||'{}'),value=data.result||data;
      invariant(Buffer.byteLength(JSON.stringify(value))<=262144&&typeof value.status==='string','SOURCE_UNAVAILABLE');
      this.binding.assertCurrent();return value;
    }catch(error){if(error.code==='IDENTITY_CHANGED'||error.code==='STALE_REVISION')throw error;fail('SOURCE_UNAVAILABLE');}
    finally{await client.close().catch(()=>{});}
  }
}

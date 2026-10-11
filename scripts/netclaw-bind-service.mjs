#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {ManagementService} from '../ui/netclaw-visual/src/management/service.js';
import {safeError,invariant} from '../ui/netclaw-visual/src/management/errors.js';

// Deliberately a backend operator command, never an assistant or webview tool.
const {values}=parseArgs({options:{home:{type:'string'},runtime:{type:'string'},installation:{type:'string'},service:{type:'string'},manager:{type:'string'},unit:{type:'string'},definition:{type:'string'},record:{type:'boolean',default:false}},strict:true,allowPositionals:false});
let service,lock;
try{
  invariant(values.home&&values.runtime&&values.installation&&values.service&&values.manager&&values.unit&&values.definition);
  service=new ManagementService({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),home:values.home,kind:values.runtime,expectedInstallationId:values.installation});
  if(values.record)lock=service.journal.lock('configuration',service.binding.principal.principalId,120000);
  const result=await service.services.register({id:values.service,manager:values.manager,unit:values.unit,definitionPath:values.definition},{reviewed:values.record,audit:service.audit});
  console.log(JSON.stringify({recorded:values.record,installationId:service.binding.installationId,...result},null,2));
}catch(error){console.error(JSON.stringify({error:safeError(error)}));process.exitCode=1;}
finally{if(service){if(lock)service.journal.unlock('configuration',lock);await service.close();}}

#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {ManagementService} from '../ui/netclaw-visual/src/management/service.js';
import {safeError,invariant} from '../ui/netclaw-visual/src/management/errors.js';

const {values}=parseArgs({options:{home:{type:'string'},runtime:{type:'string'},installation:{type:'string'},directory:{type:'string'},record:{type:'boolean',default:false}},strict:true,allowPositionals:false});
let service,lock;
try{
  invariant(values.home&&values.runtime&&values.installation&&values.directory);
  service=new ManagementService({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),home:values.home,kind:values.runtime,expectedInstallationId:values.installation});
  if(values.record)lock=service.journal.lock('configuration',service.binding.principal.principalId,120000);
  const result=await service.defenseclaw.register({directory:values.directory},{reviewed:values.record,audit:service.audit});
  console.log(JSON.stringify({recorded:values.record,installationId:service.binding.installationId,...result},null,2));
}catch(error){console.error(JSON.stringify({error:safeError(error)}));process.exitCode=1;}
finally{if(service){if(lock)service.journal.unlock('configuration',lock);await service.close();}}

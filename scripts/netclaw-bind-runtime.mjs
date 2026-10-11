#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {ManagementService} from '../ui/netclaw-visual/src/management/service.js';
import {safeError,invariant} from '../ui/netclaw-visual/src/management/errors.js';

// Explicit backend registration; paths are never accepted from assistant or
// webview calls. Both installation identities and management journals must exist.
const {values}=parseArgs({options:{home:{type:'string'},runtime:{type:'string'},installation:{type:'string'},selector:{type:'string'},'candidate-home':{type:'string'},'candidate-runtime':{type:'string'},'candidate-installation':{type:'string'},record:{type:'boolean',default:false}},strict:true,allowPositionals:false});
let service,lock;
try{
  invariant(values.home&&values.runtime&&values.installation&&values.selector&&values['candidate-home']&&values['candidate-runtime']&&values['candidate-installation']);
  service=new ManagementService({root:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),home:values.home,kind:values.runtime,expectedInstallationId:values.installation});
  lock=service.journal.lock('configuration',service.binding.principal.principalId,180000);
  const result=await service.runtimeSelection.register({selectorPath:values.selector,home:values['candidate-home'],kind:values['candidate-runtime'],installationId:values['candidate-installation']},{reviewed:values.record,audit:service.audit});
  console.log(JSON.stringify({recorded:values.record,installationId:service.binding.installationId,...result},null,2));
}catch(error){console.error(JSON.stringify({error:safeError(error)}));process.exitCode=1;}
finally{if(service){if(lock)service.journal.unlock('configuration',lock);await service.close();}}

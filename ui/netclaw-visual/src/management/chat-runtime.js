import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { readOwned } from './files.js';
import { environment } from './configuration.js';
import { invariant, fail } from './errors.js';
import { createHermesRuntime } from '../hud-server/runtime/hermes.js';
import { gatewayAgentId } from '../hud-server/gateway-agent.js';
import {assessmentProofs,attachInfluences} from '../hud-server/bindings.js';
import {readScienceTranscript} from './science.js';

/** Browser navigation metadata only. Authentication remains with the native UI. */
export function nativeHarnessUi(binding){
  binding.assertCurrent();
  if(binding.kind!=='openclaw')return {available:false,reason:'The protected Hermes companion exposes an authenticated API, not a browser UI. Use the existing Hermes interface separately; no private companion endpoint is opened.'};
  const config=JSON.parse(readOwned(binding.configPath,{limit:4*1024*1024})),gateway=config.gateway||{};
  if(gateway.controlUi?.enabled===false)return {available:false,reason:'OpenClaw Control UI is disabled in this installation.'};
  const port=gateway.port??18789,pathname=gateway.controlUi?.basePath||'/';
  if(!(Number.isInteger(port)&&port>0&&port<=65535&&typeof pathname==='string'&&/^\/[A-Za-z0-9/_-]*$/.test(pathname)))return {available:false,reason:'This native gateway path or port is outside the supported browser navigation format.'};
  return {available:true,scheme:gateway.tls?.enabled===true?'https':'http',port,pathname,source:'Configured selected OpenClaw gateway. Browser availability and authentication are checked by its native UI.'};
}

/** Only public answer text and tool milestones from this exact run cross into
 * management evidence. Thinking, prompts, tool arguments and other runs do not. */
export function projectGatewayEvent(frame,requestId){
  const value=frame?.payload;
  if(frame?.type!=='event'||frame.event!=='agent'||value?.runId!==requestId||!Number.isSafeInteger(value.seq)||value.seq<0)return null;
  const base={runtime:'openclaw',source:'Authenticated OpenClaw agent event',sourceSequence:value.seq};
  if(value.stream==='assistant'&&typeof value.data?.text==='string')return {...base,kind:'answer',output:value.data.text.slice(0,30000),partial:true,truncated:value.data.text.length>30000};
  if(value.stream==='tool'&&typeof value.data?.name==='string'&&['start','update','result','end'].includes(value.data?.phase))return {...base,kind:'tool',tool:value.data.name.slice(0,200),state:value.data.phase};
  if(value.stream==='lifecycle'&&['start','end','error'].includes(value.data?.phase))return {...base,kind:'lifecycle',state:value.data.phase};
  return null;
}
export function conversationOptions(binding){
  if(binding.kind!=='openclaw')return {models:[],reason:'Hermes companion uses its configured model; per-conversation overrides are not qualified.'};
  const config=JSON.parse(readOwned(binding.configPath,{limit:4*1024*1024}));
  return {models:Object.entries(config.models?.providers||{}).flatMap(([provider,value])=>(value.models||[])
    .filter(model=>typeof model.id==='string').map(model=>({id:`${provider}/${model.id}`,efforts:model.reasoning===true?['low','medium','high']:[]}))).slice(0,1000),
    source:'Configured OpenClaw models; live gateway must verify the exact selection before inference.'};
}
export function validateConversationSelection(binding,input){
  if(input.model===undefined&&input.effort===undefined)return {};
  const options=conversationOptions(binding),model=options.models.find(model=>model.id===input.model);
  invariant(model,'UNQUALIFIED');
  if(input.effort!==undefined)invariant(model.efforts.includes(input.effort),'UNQUALIFIED');
  return {model:input.model,...(input.effort?{effort:input.effort}:{})};
}

/** Fixed loopback gateway transport. Payloads and credentials never enter argv. */
export class ManagementGateway {
  constructor(binding,{sessionSettings=false}={}){this.binding=binding;this.sessionSettings=sessionSettings;this.pending=new Map();this.listeners=new Set();}
  async connect(){
    if(this.socket?.readyState===WebSocket.OPEN&&this.connected)return;
    this.binding.assertCurrent();
    const config=JSON.parse(readOwned(this.binding.configPath)),env=environment(this.binding);
    const port=config.gateway?.port||18789;invariant(Number.isInteger(port)&&port>0&&port<=65535);
    const resolve=value=>typeof value==='string'&&/^\$\{[A-Z_][A-Z0-9_]*\}$/.test(value)?env[value.slice(2,-1)]:undefined;
    const mode=config.gateway?.auth?.mode||'token';
    const credential=mode==='password'?(resolve(config.gateway?.auth?.password)||env.OPENCLAW_GATEWAY_PASSWORD):(resolve(config.gateway?.auth?.token)||env.OPENCLAW_GATEWAY_TOKEN);
    invariant(credential,'UNAUTHENTICATED');
    const ws=new WebSocket(`ws://127.0.0.1:${port}`,{maxPayload:1024*1024,followRedirects:false,handshakeTimeout:10000});this.socket=ws;
    this.connected=false;
    const challenge=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ws.terminate();reject(Error('Handshake unavailable'));},10000);
      const first=bytes=>{try{const frame=JSON.parse(bytes.toString());invariant(frame.type==='event'&&frame.event==='connect.challenge','UNAUTHENTICATED');clearTimeout(timer);resolve();}catch{clearTimeout(timer);reject(Error('Handshake unavailable'));}};
      ws.once('message',first);ws.once('error',()=>{clearTimeout(timer);reject(Error('Gateway unavailable'));});
      ws.once('close',()=>{clearTimeout(timer);reject(Error('Gateway closed'));});
    });
    ws.on('message',bytes=>{
      let frame;try{frame=JSON.parse(bytes.toString());}catch{ws.terminate();return;}
      if(frame.type==='event'){for(const listener of this.listeners)listener(frame);return;}
      if(frame.type!=='res')return;
      const pending=this.pending.get(frame.id);if(!pending)return;
      if(pending.final&&frame.ok&&frame.payload?.status==='accepted')return;
      this.pending.delete(frame.id);clearTimeout(pending.timer);
      if(frame.ok)pending.resolve(frame.payload);else pending.reject(Error('Gateway method refused'));
    });
    ws.on('close',()=>{this.connected=false;for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(Error('Gateway connection closed'));}this.pending.clear();});
    ws.on('error',()=>{});
    try {
      await challenge;
      await this.send('connect',{minProtocol:3,maxProtocol:4,client:{id:'gateway-client',version:'150',platform:process.platform,mode:'backend'},role:'operator',scopes:this.sessionSettings?['operator.admin']:['operator.read','operator.write'],auth:{[mode==='password'?'password':'token']:credential}},10000);
      this.connected=true;
    }catch{ws.terminate();fail('SOURCE_UNAVAILABLE');}
  }
  send(method,params,timeout=15000,final=false){
    invariant(this.socket?.readyState===WebSocket.OPEN,'SOURCE_UNAVAILABLE');
    const id=randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Gateway deadline exceeded'));},timeout);
      this.pending.set(id,{resolve,reject,timer,final});
      this.socket.send(JSON.stringify({type:'req',id,method,params}),error=>{if(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
    });
  }
  async call(method,params,timeout,final){
    invariant((this.sessionSettings?['sessions.patch']:['health','agent','agent.wait','chat.abort','chat.history','models.list','sessions.messages.subscribe','sessions.messages.unsubscribe']).includes(method),'DENIED');
    await this.connect();return this.send(method,params,timeout,final);
  }
  subscribe(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  async close(){this.socket?.close();}
}

export function createManagementRuntime(binding,root){
  if(binding.kind==='hermes'){
    let runtime;const cursors=new Map();
    const call=(operation,args)=>{
      // New management use requires the reviewed .env normalization path. The
      // shared HUD retains its legacy migration behavior; we never borrow an
      // ambient credential or silently read a literal key from auth JSON.
      const selected=environment(binding);invariant(selected.NETCLAW_HERMES_HUD_API_KEY,'UNAUTHENTICATED');
      const processContext=Object.fromEntries(['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','NETCLAW_HUD_BRIDGE_PYTHON'].flatMap(key=>process.env[key]===undefined?[]:[[key,process.env[key]]]));
      runtime||=createHermesRuntime(binding,root,{env:{...processContext,...selected}});
      return runtime.call(operation,args);
    };
    const conversationId=id=>`management-${id}`;
    return {kind:'hermes',
      validateSelection:input=>validateConversationSelection(binding,input),
      async readiness(){const value=await call('status');invariant(value.installationId===binding.installationId&&value.protected===true,'IDENTITY_CHANGED');return {ready:value.ready===true,grantEnforced:false,source:'Protected Hermes companion',version:value.release};},
      open:input=>call('conversation_open',{conversationId:conversationId(input.conversationId)}),
      async submit(input){const value=await call('submit',{conversationId:conversationId(input.conversationId),requestId:input.requestId,clientNonce:input.nonce,text:input.text,deadlineMs:900000});invariant(value.state!=='unknown','UNKNOWN_OUTCOME');return {reference:input.requestId};},
      async observe(input){const value=await call('request_status',{conversationId:conversationId(input.conversationId),requestId:input.requestId});return {...value,state:({completed:'succeeded',interrupted:'unknown',waiting_approval:'running',queued:'running',stopping:'cancellation-requested'})[value.state]||value.state,source:'Protected Hermes request ledger'};},
      async progress(input){
        const cursor=cursors.get(input.requestId)||0,value=await call('events',{conversationId:conversationId(input.conversationId),requestId:input.requestId,cursor});
        invariant(Array.isArray(value.events)&&value.events.length<=20,'SOURCE_UNAVAILABLE');
        let after=cursor;
        const events=value.events.map(event=>{
          invariant(Number.isSafeInteger(event.sequence)&&event.sequence>after&&typeof event.tool==='string'&&typeof event.state==='string','SOURCE_UNAVAILABLE');after=event.sequence;
          return {runtime:'hermes',source:'Protected Hermes tool evidence ledger',sourceSequence:event.sequence,kind:'tool',tool:event.tool.slice(0,200),state:event.state.slice(0,100),recordedAt:event.created};
        });
        cursors.set(input.requestId,after);return events;
      },
      cancel:input=>call('stop',{conversationId:conversationId(input.conversationId),requestId:input.requestId}),
      close:async()=>{await runtime?.close();runtime=undefined;},
    };
  }
  const gateway=new ManagementGateway(binding),completed=new Map();
  const config=JSON.parse(readOwned(binding.configPath)),agentId=gatewayAgentId(config);
  const sessionKey=id=>`agent:${agentId}:netclaw-management:${id}`;
  return {kind:'openclaw',
    validateSelection:input=>validateConversationSelection(binding,input),
    async readiness(){await gateway.call('health',{});return {ready:true,grantEnforced:false,source:'Authenticated local OpenClaw gateway'};},
    async open(input){
      const selected=validateConversationSelection(binding,input.selection||{});
      if(!selected.model)return {selectionVerified:false,source:'Uses configured runtime defaults'};
      // Upstream requires operator.admin for model/effort session settings. Use
      // a short-lived, fixed-method connection only for this explicit owned
      // selection. Ordinary requests retain read/write scope; assistants cannot
      // enter the operator runtime adapter.
      const settings=new ManagementGateway(binding,{sessionSettings:true});let result;
      try{result=await settings.call('sessions.patch',{key:sessionKey(input.conversationId),agentId,model:selected.model,...(selected.effort?{thinkingLevel:selected.effort}:{})});}finally{await settings.close();}
      invariant(result.ok===true&&result.key===sessionKey(input.conversationId)&&`${result.resolved?.modelProvider}/${result.resolved?.model}`===selected.model,'UNQUALIFIED');
      if(selected.effort)invariant(result.resolved?.thinkingLevel===selected.effort,'UNQUALIFIED');
      return {selectionVerified:true,...selected,source:'OpenClaw sessions.patch resolved model and effort'};
    },
    async submit(input){
      const before=readScienceTranscript(binding,input.conversationId);
      let last=-1;
      const subscribed=await gateway.call('sessions.messages.subscribe',{key:sessionKey(input.conversationId),agentId});
      invariant(subscribed.subscribed===true&&subscribed.key===sessionKey(input.conversationId),'UNQUALIFIED');
      const unsubscribe=gateway.subscribe(frame=>{
        const event=projectGatewayEvent(frame,input.requestId);
        if(event&&event.sourceSequence>last){last=event.sourceSequence;input.onProgress?.(event);}
      });
      let result;
      try{result=await gateway.call('agent',{message:input.text,agentId,sessionKey:sessionKey(input.conversationId),deliver:false,timeout:900,idempotencyKey:input.requestId},930000,true);}finally{unsubscribe();await gateway.call('sessions.messages.unsubscribe',{key:sessionKey(input.conversationId),agentId}).catch(()=>{});}
      invariant(result.status==='ok','UNKNOWN_OUTCOME');
      const payload=result.result||result;
      const output=(payload.payloads||[]).filter(p=>typeof p.text==='string').map(p=>p.text).join('\n');
      const after=readScienceTranscript(binding,input.conversationId);
      completed.set(input.requestId,{state:'succeeded',output,usage:payload.meta?.usage||payload.meta?.agentMeta?.usage||null,source:'OpenClaw final agent response',assessmentProofs:attachInfluences(assessmentProofs(before,after),before,after)});
      return {reference:input.requestId};
    },
    async observe(input){
      if(completed.has(input.requestId))return completed.get(input.requestId);
      const value=await gateway.call('agent.wait',{runId:input.requestId,timeoutMs:1000});
      if(value.status==='ok')return {state:'succeeded',output:null,outputUnavailable:true,source:'OpenClaw authoritative run status',reason:'Completion confirmed after transport loss; no final response was retained by the management worker.'};
      if(value.status==='error')return {state:'failed',source:'OpenClaw authoritative run status'};
      return {state:'unknown',source:'OpenClaw run status',reason:'No terminal result is available; never resubmit uncertain work.'};
    },
    cancel:input=>gateway.call('chat.abort',{sessionKey:sessionKey(input.conversationId),agentId,runId:input.requestId,preserveSideRuns:true}),
    close:()=>gateway.close(),
  };
}

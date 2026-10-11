/* All data is rendered as text. Simulation stays inside this webview. */
const vscode=acquireVsCodeApi(),viewId=document.body.dataset.viewId;
const byId=id=>document.getElementById(id);let request=0,current,invalid=false;
const loading=busy=>{for(const id of ['refresh','layer','more'])byId(id).disabled=busy;};
const send=(type,extra={})=>{if(!invalid){if(type!=='intent'){loading(true);byId('status').textContent='Loading selected source…';}vscode.postMessage({type,viewId,requestId:String(++request),...extra});}};
const text=(tag,value,className)=>{const item=document.createElement(tag);item.textContent=value;if(className)item.className=className;return item;};
const time=value=>typeof value==='number'&&Number.isFinite(new Date(value).getTime())?new Date(value).toISOString():'Unknown observation time';
const title={configured:'CONFIGURED INVENTORY',historical:'HISTORICAL COLLECTOR EVIDENCE',member:'INTERNAL FEDERATION RELATIONSHIPS',peer:'EXTERNAL FEDERATION RELATIONSHIPS',simulated:'SIMULATED — LOCAL GRAPH SUBTRACTION'};
function graphData(message){
  const {data,layer}=message;
  if(layer==='configured')return {nodes:(data.items||[]).map(row=>({id:row.id,label:row.id,kind:[row.os,row.platform,row.type].filter(Boolean).join(' · ')||'Configured device',sourceKind:'configured',observedState:null})),edges:[],observations:[]};
  if(layer==='member'||layer==='peer'){
    const root={id:'selected-installation',label:message.installationId,kind:'Selected installation',sourceKind:'federation'};
    const nodes=(data.items||[]).map(row=>({id:`remote:${row.id}`,label:row.label||row.id,kind:`${row.harness?.type||'unknown harness'} · reported ${row.state||'unknown'}`,sourceKind:'federation',stale:row.stale,sourceReference:{resourceId:row.id,source:row.source,receivedAt:row.receivedAt}}));
    return {nodes:[root,...nodes],edges:nodes.map(row=>({from:root.id,to:row.id,protocol:layer==='member'?'Membership record':'Peering record',sourceKind:'federation',sourceReference:row.sourceReference})),observations:[]};
  }
  return {nodes:data.nodes||[],edges:data.edges||[],observations:data.observations||[]};
}
function draw(nodes,edges){
  const svg=byId('network-graph');svg.replaceChildren();svg.hidden=!nodes.length;
  const ns='http://www.w3.org/2000/svg',visible=nodes.slice(0,80),positions=new Map(visible.map((node,i)=>[node.id,{x:500+400*Math.cos(i*2*Math.PI/visible.length),y:150+90*Math.sin(i*2*Math.PI/visible.length)}]));
  for(const edge of edges){const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue;const line=document.createElementNS(ns,'line');for(const [key,value]of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,String(value));line.setAttribute('class','network-edge');svg.appendChild(line);}
  for(const node of visible){const {x,y}=positions.get(node.id),group=document.createElementNS(ns,'g'),circle=document.createElementNS(ns,'circle'),label=document.createElementNS(ns,'text'),detail=document.createElementNS(ns,'title');circle.setAttribute('cx',String(x));circle.setAttribute('cy',String(y));circle.setAttribute('r','10');circle.setAttribute('class',node.stale?'network-node stale':'network-node');label.setAttribute('x',String(x));label.setAttribute('y',String(y+30));label.setAttribute('text-anchor','middle');label.textContent=visible.length<=20?String(node.label).slice(0,24):'';detail.textContent=String(node.label);group.append(detail,circle,label);svg.appendChild(group);}
}
function render(){
  if(!current)return;const {data,layer}=current,base=graphData(current),query=byId('filter').value.toLowerCase(),removed=layer==='simulated'?byId('removed').value:'';
  const nodes=base.nodes.filter(row=>row.id!==removed&&String(row.label).toLowerCase().includes(query)),ids=new Set(nodes.map(row=>row.id));
  const edges=base.edges.filter(row=>ids.has(row.from)&&ids.has(row.to)),observations=layer==='simulated'?[]:base.observations.filter(row=>!query||JSON.stringify(row).toLowerCase().includes(query));
  byId('status').textContent=data.available===false?`Source unavailable: ${data.reason||'No valid evidence'}`:title[layer];
  byId('provenance').textContent=[data.scope||current.source,layer==='member'||layer==='peer'?'Federation records describe software relationships only. They establish no physical cable or device health.':null,layer==='simulated'?'Derived from retained historical observations; all displayed changes are hypothetical.':null,`Read: ${current.observedAt||'unknown'}`,data.savedAt?`Collector evidence saved: ${time(data.savedAt)}`:null].filter(Boolean).join('\n');
  byId('counts').textContent=`${nodes.length} loaded nodes · ${edges.length} loaded relationships · ${observations.length} interface/routing observations. Graph shows at most 80 nodes; lists show at most 200 entries each.${data.total!==undefined?` Source total: ${data.total}.`:''}${data.truncated?` Source truncated; ${data.omitted||'additional'} records omitted.`:''}${removed?` Simulated removal hides ${base.edges.filter(row=>row.from===removed||row.to===removed).length} incident relationships; no reachability prediction.`:''}`;
  byId('simulation').hidden=layer!=='simulated';byId('more').hidden=!data.nextCursor;
  const lists=['nodes','edges','observations'];for(const id of lists)byId(id).replaceChildren();
  for(const row of nodes.slice(0,200)){
    const card=text('article','');card.append(text('h3',row.label),text('p',`${layer==='simulated'?'Simulated':row.sourceKind||layer} · ${row.kind||'Evidence node'}`),text('p',layer==='configured'?'Live state unknown':`${time(row.observedAt)}${row.stale?' · STALE':''}`));
    if(row.sourceReference)card.append(text('pre',JSON.stringify(row.sourceReference,null,2)));byId('nodes').appendChild(card);
  }
  const labels=new Map(base.nodes.map(row=>[row.id,row.label]));
  for(const row of edges.slice(0,200)){
    const card=text('article','');card.append(text('h3',`${labels.get(row.from)||row.from} → ${labels.get(row.to)||row.to}`),text('p',[row.protocol,row.interface,row.remotePort,row.stale?'STALE':null].filter(Boolean).join(' · ')),text('pre',JSON.stringify(row.sourceReference||{},null,2)));byId('edges').appendChild(card);
  }
  for(const row of observations.slice(0,200)){const card=text('article','');card.append(text('h3',`${row.deviceId} · ${row.sourceId} · ${row.stale?'STALE':'historical'}`),text('pre',JSON.stringify(row,null,2)));byId('observations').appendChild(card);}
  for(const id of lists)if(!byId(id).children.length)byId(id).appendChild(text('p','No entries in this source/page/filter. Absence is not proof of health.'));
  draw(nodes,edges);
}
byId('refresh').addEventListener('click',()=>send('refresh'));
byId('intent').addEventListener('click',()=>send('intent'));
byId('more').addEventListener('click',()=>send('more'));
byId('layer').addEventListener('change',()=>send('layer',{layer:byId('layer').value}));
byId('filter').addEventListener('input',render);byId('removed').addEventListener('change',render);
window.addEventListener('message',event=>{
  const message=event.data;if(message.viewId!==viewId)return;
  if(message.type==='invalidated'){invalid=true;current=undefined;for(const id of ['nodes','edges','observations','network-graph'])byId(id).replaceChildren();byId('status').textContent=message.message;for(const control of document.querySelectorAll('button,input,select'))control.disabled=true;return;}
  if(message.type==='error'){current=undefined;loading(false);byId('status').textContent=message.message;for(const id of ['nodes','edges','observations','network-graph','provenance','counts'])byId(id).replaceChildren();byId('more').hidden=true;return;}
  if(message.type!=='source'||invalid)return;loading(false);current=message;byId('layer').value=message.layer;
  byId('removed').replaceChildren();const none=text('option','Keep all nodes');none.value='';byId('removed').appendChild(none);
  if(message.layer==='simulated')for(const node of graphData(message).nodes){const option=text('option',node.label);option.value=node.id;byId('removed').appendChild(option);}
  render();
});
send('ready');

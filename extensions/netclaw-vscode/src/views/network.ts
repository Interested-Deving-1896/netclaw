import * as vscode from 'vscode';
import {randomUUID,randomBytes} from 'node:crypto';
import {Connection,boundCaller} from '../connection/connect';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
type Layer='configured'|'historical'|'member'|'peer'|'simulated';
type Envelope={data:{nextCursor?:string;[key:string]:unknown};source:string;observedAt:string};

export function openNetwork(context:vscode.ExtensionContext,connection:Connection):vscode.WebviewPanel{
  if(!connection.ready||!connection.identity)throw Error('Connect to an existing installation first.');
  const call=boundCaller(connection),generation=connection.generation,viewId=randomUUID();
  const panel=vscode.window.createWebviewPanel('netclaw.network','NetClaw Network',vscode.ViewColumn.One,{enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'resources')]});
  const nonce=randomBytes(24).toString('base64'),css=panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'resources/workbench.css')),script=panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'resources/network.js'));
  panel.webview.html=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${css}"></head><body class="network-view" data-view-id="${viewId}"><header><p class="eyebrow">NETCLAW NETWORK</p><h1>Network evidence</h1><p>${escape(connection.profile?.label||'NetClaw')} · ${escape(connection.identity.harness.type)}</p><p>Explore devices and relationships by evidence source.</p><div class="toolbar"><button id="refresh">Refresh this source</button><button id="intent">Open Terminal Intent</button></div><label for="layer">Evidence source</label><select id="layer"><option value="configured">Configured devices</option><option value="historical">Retained collector observations</option><option value="member">Internal federation membership</option><option value="peer">External federation peering</option><option value="simulated">Local removal simulation</option></select></header><main><p id="status" role="status" aria-live="polite">Loading…</p><p class="hint">Live device health is unknown. Viewing evidence does not poll devices.</p><label for="filter">Filter this loaded page</label><input id="filter" type="search" maxlength="200"><section id="simulation" hidden><label for="removed">Hypothetically remove a node</label><select id="removed"></select><p class="hint">Local graph subtraction only, based on retained observations. It predicts no traffic, routing convergence or operational impact and sends no change.</p></section><p id="counts"></p><svg id="network-graph" viewBox="0 0 1000 300" role="img" aria-label="Evidence relationship graph; the accessible node and edge lists below contain the same source"></svg><details><summary>Source, timestamps and evidence limits</summary><p id="provenance"></p></details><section aria-label="Nodes"><h2>Nodes and provenance</h2><div id="nodes"></div></section><section aria-label="Relationships"><h2>Relationships</h2><div id="edges"></div></section><section aria-label="Interface and routing evidence"><h2>Interface and routing observations</h2><div id="observations"></div></section><button id="more" hidden>Next page</button></main><script nonce="${nonce}" src="${script}"></script></body></html>`;
  let disposed=false,busy=false,layer:Layer='configured',nextCursor:string|undefined;
  const valid=()=>!disposed&&vscode.workspace.isTrusted&&connection.ready&&connection.generation===generation;
  const post=async(data:object)=>{if(valid())await panel.webview.postMessage({viewId,...data});};
  const load=async(more=false)=>{
    const args=layer==='member'||layer==='peer'?{kind:layer,limit:200,...(more&&nextCursor?{cursor:nextCursor}:{})}:
      {kind:'network',sourceKind:layer==='configured'?'configured':'historical',limit:200,...(more&&layer==='configured'&&nextCursor?{cursor:nextCursor}:{})};
    const result=await call<Envelope>('operator_resources',args);if(!valid())return;
    nextCursor=result.data.nextCursor;await post({type:'source',layer,...result,installationId:connection.identity!.installationId});
  };
  panel.webview.onDidReceiveMessage(async(raw:unknown)=>{
    if(!raw||typeof raw!=='object')return;const m=raw as Record<string,unknown>;
    if(Object.keys(m).some(k=>!['viewId','requestId','type','layer'].includes(k))||m.viewId!==viewId||typeof m.requestId!=='string'||m.requestId.length>100||!['ready','refresh','layer','more','intent'].includes(String(m.type))||!valid()||busy)return;
    if(m.type==='layer'&&!['configured','historical','member','peer','simulated'].includes(String(m.layer)))return;
    if(m.type!=='layer'&&m.layer!==undefined)return;
    busy=true;
    try{
      if(m.type==='intent'){await vscode.commands.executeCommand('netclaw.openIntent');return;}
      if(m.type==='layer'){layer=m.layer as Layer;nextCursor=undefined;}
      if(m.type==='more'&&!nextCursor)return;
      await load(m.type==='more');
    }catch(error){await post({type:'error',layer,message:error instanceof Error?error.message:'Source unavailable'});}
    finally{busy=false;}
  });
  const changed=connection.changed.event(()=>{if(!disposed&&generation!==connection.generation)void panel.webview.postMessage({viewId,type:'invalidated',message:'Connection changed. Reopen Network for the intended installation.'});});
  panel.onDidDispose(()=>{disposed=true;changed.dispose();});return panel;
}

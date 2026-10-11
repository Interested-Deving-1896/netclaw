import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';

export function loopbackUiUri(value:string):vscode.Uri {
  if(value.length>4096||/[\s\\]/.test(value))throw Error('Use a loopback HTTP(S) URL without credentials, query parameters or fragments.');
  const uri=vscode.Uri.parse(value,true);
  if(!['http','https'].includes(uri.scheme)||!/^127\.0\.0\.1(?::\d{1,5})?$/.test(uri.authority)||uri.query||uri.fragment||!/^\/[A-Za-z0-9/_-]*$/.test(uri.path))throw Error('Use a loopback HTTP(S) URL without credentials, query parameters or fragments.');
  const port=Number(uri.authority.split(':')[1]|| (uri.scheme==='https'?443:80));
  if(port<1||port>65535)throw Error('Invalid local port.');return uri;
}

export async function openNativeRuntime(connection:Connection):Promise<void>{
  const call=boundCaller(connection),generation=connection.generation,profile=connection.profile;
  if(!profile)throw Error('Connect to the intended installation first.');
  const {data}=await call<{data:{nativeUi:{available:boolean;reason?:string;scheme?:string;port?:number;pathname?:string;source?:string}}}>('operator_snapshot',{domain:'settings'});
  const native=data.nativeUi;if(!native?.available){void vscode.window.showInformationMessage(native?.reason||'No supported native browser UI is available.');return;}
  let target=loopbackUiUri(`${native.scheme}://127.0.0.1:${native.port}${native.pathname}`);
  if(profile.transport==='ssh'){
    const forward=await vscode.window.showInputBox({title:'Existing native UI forwarding',prompt:`Enter an existing loopback forward on ${profile.context} to ${profile.sshAlias}, port ${native.port}. It must reach the selected ${profile.label} installation. No tunnel or service is started by this SSH profile.`,validateInput:value=>{try{loopbackUiUri(value);return undefined;}catch{return 'Use http(s)://127.0.0.1:port/path without authentication values.';}}});
    if(forward===undefined)return;target=loopbackUiUri(forward);
  }
  if(await vscode.window.showInformationMessage(`Open ${profile.label} in its native browser UI?`,{modal:true,detail:`Installation: ${profile.installationId}\nDestination: ${target.toString()}\n${native.source}\nAuthenticate in the native UI. No NetClaw credential is included in this URL. For WSL or Remote SSH extension hosts, VS Code manages forwarding to this host.`},'Open native UI')!=='Open native UI')return;
  await call('operator_identity');
  if(connection.generation!==generation)throw Error('Connection changed. Review the native destination again.');
  // openExternal performs VS Code's own remote resolution. Never call
  // asExternalUri first, cache a tunnel URL or embed native authentication.
  if(!await vscode.env.openExternal(target))throw Error('The browser could not open the native UI.');
}

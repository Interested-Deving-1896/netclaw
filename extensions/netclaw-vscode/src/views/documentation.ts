import * as vscode from 'vscode';
import {Connection,boundCaller} from '../connection/connect';
type DocumentEntry={id:string;title:string;category:string;path:string};
const externalGuides={
  'NetClaw source and guides':'https://github.com/automateyournetwork/netclaw',
  'VS Code WSL guide':'https://code.visualstudio.com/docs/remote/wsl',
  'VS Code Remote SSH guide':'https://code.visualstudio.com/docs/remote/ssh',
  'VS Code MCP guide':'https://code.visualstudio.com/docs/copilot/customization/mcp-servers',
};
export function approvedGuide(value:string):string|undefined{return Object.values(externalGuides).includes(value)?value:undefined;}

export async function openDocumentation(context:vscode.ExtensionContext,connection:Connection):Promise<void>{
  if(!connection.ready){const doc=await vscode.workspace.openTextDocument(vscode.Uri.joinPath(context.extensionUri,'README.md'));await vscode.window.showTextDocument(doc);return;}
  const call=boundCaller(connection),identity=connection.identity!,items:DocumentEntry[]=[];let cursor:string|undefined;
  do{
    const response=await call<{data:{items:DocumentEntry[];nextCursor?:string}}>('operator_snapshot',{domain:'documentation',limit:500,...(cursor?{cursor}:{})});
    if(!Array.isArray(response.data.items))throw Error('Documentation index is unavailable.');
    items.push(...response.data.items);if(items.length>2000)throw Error('Documentation index exceeds the editor limit.');cursor=response.data.nextCursor;
  }while(cursor);
  const selected=await vscode.window.showQuickPick([
    ...items.map(document=>({label:document.title,description:document.category,detail:document.path,document,url:undefined as string|undefined})),
    ...Object.entries(externalGuides).map(([label,url])=>({label,description:'Open official web guide',detail:url,document:undefined as DocumentEntry|undefined,url})),
  ],{title:`NetClaw help · backend ${identity.sourceVersion} · contract ${identity.contract.major}`,placeHolder:'Search guides by title, category or path',matchOnDescription:true,matchOnDetail:true});
  if(!selected)return;
  if(selected.url){const url=approvedGuide(selected.url);if(!url)throw Error('Unrecognized documentation destination.');await vscode.env.openExternal(vscode.Uri.parse(url));return;}
  const result=await call<{data:DocumentEntry&{content:string};truncation?:object}>('operator_snapshot',{domain:'documentation',resourceId:selected.document!.id});
  if(typeof result.data.content!=='string')throw Error('Document content is unavailable.');
  const content=`Source: ${result.data.path}\nBackend: ${identity.sourceVersion} · ${identity.installationId}\n${result.truncation?'This preview is truncated; use the source guide for the complete text.\n':''}\n${result.data.content}`;
  // A plain-text document keeps embedded commands, HTML and links inert.
  const document=await vscode.workspace.openTextDocument({content,language:'plaintext'});await vscode.window.showTextDocument(document,{preview:true});
}

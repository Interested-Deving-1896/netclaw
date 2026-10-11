import * as vscode from 'vscode';
import {Connection} from '../connection/connect';
import {Profiles} from '../state/profiles';

export async function renameConnection(profiles:Profiles,connection:Connection):Promise<void>{
  const selected=await vscode.window.showQuickPick(profiles.list().map(profile=>({label:profile.label,description:`${profile.harness} · ${profile.transport}`,profile})),{title:'Rename an existing connection'});
  if(!selected)return;
  const label=await vscode.window.showInputBox({title:'Connection label',value:selected.profile.label,prompt:'This changes only the saved editor label.',validateInput:value=>value.trim()&&value.length<=100&&!/[\r\n\0]/.test(value)?undefined:'Enter a single-line label of 1–100 characters.'});
  if(label===undefined)return;
  const renamed=await profiles.rename(selected.profile,label);
  if(connection.profile?.id===renamed.id)connection.profile={...connection.profile,label:renamed.label};
  connection.changed.fire();
}

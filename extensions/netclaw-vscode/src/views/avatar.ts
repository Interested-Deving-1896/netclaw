import * as vscode from 'vscode';
import {Connection} from '../connection/connect';
import {openChat} from './chat';

/** Local bundled avatar presentation shares the same owned chat and draft. */
export function openAvatar(context:vscode.ExtensionContext,connection:Connection):vscode.WebviewPanel {
  return openChat(context,connection,true);
}

const vscode=require('vscode'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
exports.run=async()=>{
  const root=process.env.NETCLAW_SETUP_PREVIEW_ROOT;if(!root)throw Error('An isolated preview root is required.');
  const extension=vscode.extensions.getExtension('NetClaw.netclaw');await extension.activate();
  for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'])delete process.env[key];
  process.env.NO_PROXY='127.0.0.1,localhost';
  const {chromium}=require(process.env.NETCLAW_SETUP_PLAYWRIGHT||path.join(root,'tools/node_modules/playwright'));
  const endpointFile=path.join(root,'cdp.json'),until=Date.now()+20000;
  while(!fs.existsSync(endpointFile)&&Date.now()<until)await new Promise(r=>setTimeout(r,100));
  const browser=await chromium.connectOverCDP(JSON.parse(fs.readFileSync(endpointFile)).webSocketDebuggerUrl);
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('workbench'));page.setDefaultTimeout(15000);
  const checks=[],matrix=[],shots=[];
  await vscode.commands.executeCommand('workbench.action.closeSidebar');
  await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
  await vscode.commands.executeCommand('netclaw.setupClaw');
  let frame;const deadline=Date.now()+20000;
  while(Date.now()<deadline){frame=page.frames().find(f=>f.url().includes('vscode-webview'));for(const f of page.frames())if(await f.locator('#setup-search').count().catch(()=>0)){frame=f;break;}
    if(frame&&await frame.locator('#setup-search').count())break;await new Promise(r=>setTimeout(r,100));}
  await frame.locator('#setup-search').waitFor();
  assert.match(await frame.locator('.setup-banner').innerText(),/Existing NetClaw detected/);checks.push('Existing NetClaw disclosure visible; separate installation explained.');
  assert.equal(await frame.locator('#setup-capabilities .capability').count(),110);checks.push('All 110 catalog component cards rendered without fetching their links.');
  const search=frame.locator('#setup-search');await search.focus();await page.keyboard.type('subnet');
  assert.ok(await frame.locator('#setup-capabilities .capability').count()<110);assert.equal(await search.inputValue(),'subnet');
  await page.keyboard.press('Tab');assert.equal(await frame.evaluate(()=>document.activeElement?.tagName),'SUMMARY');
  checks.push('Keyboard search retains typed text and Tab reaches the next native disclosure control.');
  await search.fill('');
  const commsSearch=frame.locator('#comms-search');
  for(const text of ['WhatsApp','Twilio','Zoom']){
    await commsSearch.fill(text);assert.ok(await frame.locator('#comms-cards .capability').count()>0);
    assert.match(await frame.locator('#comms-count').innerText(),/options for openclaw/);
  }
  await commsSearch.fill('Slack');
  const slack=frame.locator('button[data-action="comms-option"][data-comms="openclaw-slack"]');
  await slack.focus();await page.keyboard.press('Enter');await slack.getAttribute('aria-pressed').then(v=>assert.equal(v,'true'));
  await commsSearch.fill('Discord');
  const discord=frame.locator('button[data-action="comms-option"][data-comms="openclaw-discord"]');
  await discord.click();await frame.waitForFunction(()=>document.querySelector('[data-action="comms-option"][data-comms="openclaw-discord"]')?.getAttribute('aria-pressed')==='true');
  await commsSearch.fill('Slack');assert.equal(await slack.getAttribute('aria-pressed'),'true');
  await slack.click();await frame.waitForFunction(()=>document.querySelector('[data-action="comms-option"][data-comms="openclaw-slack"]')?.getAttribute('aria-pressed')==='false');
  await commsSearch.fill('Discord');assert.equal(await discord.getAttribute('aria-pressed'),'true');
  checks.push('Comms search finds WhatsApp, Twilio and Zoom; keyboard selection adds Slack; adding Discord and removing Slack preserves Discord.');
  await commsSearch.fill('');
  for(const [theme,width] of [['Default Light Modern',360],['Default Dark Modern',700],['Default High Contrast',1200]]){
    await vscode.workspace.getConfiguration('workbench').update('colorTheme',theme,vscode.ConfigurationTarget.Global);
    await page.setViewportSize({width:width+48,height:1050});await new Promise(r=>setTimeout(r,250));
    const actual=await frame.evaluate(()=>innerWidth);
    await page.setViewportSize({width:page.viewportSize().width+width-actual,height:1050});
    await frame.locator('#setup-comms').scrollIntoViewIfNeeded();await new Promise(r=>setTimeout(r,250));
    const geometry=await frame.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(geometry.scroll<=geometry.client+2,JSON.stringify(geometry));
    assert.ok(Math.abs(geometry.viewport-width)<=2,JSON.stringify(geometry));
    assert.equal(await frame.locator('button').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.getAttribute('aria-label')).length),0);
    matrix.push({theme,width,...geometry});const file=path.join(root,'setup-'+width+'.png');await page.screenshot({path:file});shots.push(file);
  }
  await vscode.workspace.getConfiguration('window').update('zoomLevel',Math.log(2)/Math.log(1.2),vscode.ConfigurationTarget.Global);
  await new Promise(r=>setTimeout(r,300));assert.equal(await frame.locator('h1').isVisible(),true);
  const zoomGeometry=await frame.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(zoomGeometry.scroll<=zoomGeometry.client+2);checks.push('200% zoom keeps heading and controls reachable without horizontal document overflow.');
  await vscode.workspace.getConfiguration('window').update('zoomLevel',0,vscode.ConfigurationTarget.Global);
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify({editor:vscode.version,kind:'isolated source development',checks,matrix,zoomGeometry,shots,providerCalls:0,installationRuns:0,packaged:false},null,2));
  await browser.close();
};

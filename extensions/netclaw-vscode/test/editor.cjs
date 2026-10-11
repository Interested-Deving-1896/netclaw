const vscode=require('vscode');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
exports.run=async()=>{
  const extension=vscode.extensions.getExtension('NetClaw.netclaw');assert.ok(extension,'NetClaw extension discovered');
  const api=await extension.activate();assert.ok(extension.isActive,'extension activated');
  const commands=await vscode.commands.getCommands(true);for(const name of ['addConnection','selectConnection','disconnect','openOverview','prepareChange','reviewProposal'])assert.ok(commands.includes('netclaw.'+name));
  const fixtures=JSON.parse(process.env.NETCLAW_TEST_FIXTURES),root=process.env.NETCLAW_TEST_ROOT;
  const initialProfileCount=api.profiles.list().length;
  const profiles=[];let count=0;
  for(const fixture of fixtures){
    const profile=await api.profiles.save({label:'Same label',transport:'local',nodePath:process.env.NETCLAW_TEST_NODE,launcherPath:path.join(root,'scripts/netclaw-operator.mjs'),home:fixture.home,harness:fixture.kind,installationId:fixture.installationId});profiles.push(profile);
    const identity=await api.connection.connect(profile);assert.equal(identity.installationId,fixture.installationId);assert.equal(identity.harness.type,fixture.kind);count++;
    const response=await api.connection.call('operator_resources',{kind:'integration',limit:3});assert.equal(response.data.items.length,3);count++;
    assert.equal(api.connection.ready,true);
  }
  assert.equal(api.profiles.list().length,initialProfileCount+2,JSON.stringify({saved:profiles.map(p=>({id:p.id,context:p.context})),listed:api.profiles.list().map(p=>({id:p.id,context:p.context}))}));assert.notEqual(profiles[0].id,profiles[1].id);
  await assert.rejects(api.connection.connect({...profiles[0],installationId:fixtures[1].installationId}));count++;
  await api.connection.connect(profiles[0]);
  const initialOperations=(await api.connection.call('operator_resources',{kind:'overview'})).data.operations.length;
  await vscode.commands.executeCommand('netclaw.openOverview');count++;
  const rendered=[];
  const performance=[];
  if(process.env.NETCLAW_TEST_CDP_PORT){
    const {chromium}=require(process.env.NETCLAW_TEST_PLAYWRIGHT);
    const browser=await chromium.connectOverCDP('http://127.0.0.1:'+process.env.NETCLAW_TEST_CDP_PORT);
    try{
      const page=browser.contexts()[0].pages()[0];fs.mkdirSync(process.env.NETCLAW_TEST_SCREENSHOTS,{recursive:true});
      async function frameFor(selector){
        for(let attempt=0;attempt<80;attempt++){for(const frame of page.frames()){try{if(!frame.isDetached()&&await frame.locator(selector).count())return frame;}catch(error){if(!frame.isDetached())throw error;}}await new Promise(resolve=>setTimeout(resolve,100));}
        throw Error('Webview did not render '+selector);
      }
      // Actual Chromium webview measurements with explicit synthetic source
      // rows. This qualifies rendering/filtering, not backend or native tree
      // latency, remote execution, or all-domain workflow acceptance.
      const originalCall=api.connection.call.bind(api.connection);let revision=0,backendMs=0;
      const observation={source:'Synthetic cached estate; no peer contacted',observedAt:'2026-10-11T00:00:00Z',freshness:'stale',executionVerified:false,
        members:Array.from({length:100},(_,i)=>({id:'member-'+i,harness:i%2?'hermes':'openclaw',state:'unknown'})),
        peers:Array.from({length:100},(_,i)=>({id:'peer-'+i,trust:'advertised',state:'unknown'})),
        tools:Array.from({length:1000},(_,i)=>({id:'tool-'+i,description:i===999?'<script>hostile()</script> command:unsafe':'Advertised tool; execution not verified',executionVerified:null}))};
      api.connection.call=async(name,args)=>{
        if(name==='operator_resources'&&args.kind==='overview'){
          const started=Date.now();const value={...observation,sourceRevision:++revision};backendMs=Date.now()-started;return value;
        }return originalCall(name,args);
      };
      try{
        await vscode.commands.executeCommand('netclaw.openOverview');const overview=await frameFor('.data-view #filter');
        await overview.locator('#content').getByText('Synthetic cached estate; no peer contacted',{exact:true}).waitFor();
        for(const [theme,bodyClass] of [['Default Dark Modern','vscode-dark'],['Default Light Modern','vscode-light'],['Default High Contrast','vscode-high-contrast']]){
          await vscode.workspace.getConfiguration('workbench').update('colorTheme',theme,vscode.ConfigurationTarget.Global);
          await overview.locator('body.'+bodyClass).waitFor();
          const filter=overview.locator('#filter'),samples=[];
          for(let i=0;i<20;i++){
            const prior=await overview.locator('#content').getAttribute('data-rendered'),started=Date.now();await filter.fill('tool-'+(980+i));
            await overview.waitForFunction(value=>document.getElementById('content').dataset.rendered!==value,prior);
            samples.push(Date.now()-started);assert.equal(await overview.locator('section[aria-label="observation.tools"] article').count(),1);
          }
          const p95=[...samples].sort((a,b)=>a-b)[Math.ceil(samples.length*.95)-1];assert.ok(p95<1000,theme+' local filter p95 '+p95+'ms');
          await filter.fill('');await overview.locator('section[aria-label="observation.tools"] article').nth(49).waitFor();
          // Paging stays on the keyboard and returns focus to a usable control.
          const next=overview.getByRole('button',{name:'Next entries for observation.tools',exact:true});await next.focus();await page.keyboard.press('Enter');
          await overview.locator('section[aria-label="observation.tools"] article').first().getByText('tool-50',{exact:true}).waitFor();
          assert.match(await overview.evaluate(()=>document.activeElement.getAttribute('aria-label')),/entries for observation.tools/);
          const prior=await overview.locator('#content').getAttribute('data-rendered'),started=Date.now();await overview.getByRole('button',{name:'Refresh',exact:true}).focus();await page.keyboard.press('Enter');
          await overview.waitForFunction(value=>document.getElementById('content').dataset.rendered!==value,prior);const refreshedMs=Date.now()-started;assert.ok(refreshedMs-backendMs<2000,theme+' refresh render '+refreshedMs+'ms');
          await filter.fill('tool-999');await overview.locator('section[aria-label="observation.tools"] article').getByText('tool-999',{exact:true}).waitFor();
          assert.equal(await overview.locator('#content script,#content img,#content a').count(),0);assert.match(await overview.locator('#content').textContent(),/<script>hostile\(\)<\/script>/);
          if(bodyClass==='vscode-high-contrast')assert.notEqual(await overview.getByRole('button',{name:'Refresh',exact:true}).evaluate(button=>getComputedStyle(button).borderTopColor),'rgba(0, 0, 0, 0)');
          await vscode.commands.executeCommand('notifications.clearAll');
          await page.screenshot({path:path.join(process.env.NETCLAW_TEST_SCREENSHOTS,'inventory-'+bodyClass+'.png')});
          performance.push({theme,fixture:{members:100,peers:100,tools:1000},samples:20,localFilterP95Ms:p95,refreshTotalMs:refreshedMs,backendFixtureMs:backendMs,keyboardPaging:true,hostileContentInert:true});
        }
        rendered.push('Actual three-theme paged inspection, keyboard paging and refresh, 100/100/1000 synthetic local-filter measurements');count++;
      }finally{api.connection.call=originalCall;await vscode.workspace.getConfiguration('workbench').update('colorTheme','Default Dark Modern',vscode.ConfigurationTarget.Global);}
      await vscode.commands.executeCommand('netclaw.openChat');
      const chat=await frameFor('#composer');await chat.locator('#prompt').fill('An unsent draft');
      assert.equal(await chat.locator('#send').textContent(),'Send to NetClaw');rendered.push('Chat composer');
      await page.screenshot({path:path.join(process.env.NETCLAW_TEST_SCREENSHOTS,'chat.png')});
      await vscode.commands.executeCommand('netclaw.openCanvas');
      const canvas=await frameFor('.canvas-lane');await canvas.getByRole('button',{name:'Branch this conversation'}).first().click();
      assert.equal(await canvas.locator('.canvas-lane').count(),2);rendered.push('Canvas branch without dispatch');
      await page.screenshot({path:path.join(process.env.NETCLAW_TEST_SCREENSHOTS,'canvas.png')});
      await vscode.commands.executeCommand('netclaw.openAvatar');
      const avatar=await frameFor('#avatar-character');await avatar.locator('#avatar-character').selectOption('lobster');
      assert.equal(await avatar.locator('#prompt').count(),1);rendered.push('Existing local Avatar and independent text composer');
      await page.screenshot({path:path.join(process.env.NETCLAW_TEST_SCREENSHOTS,'avatar.png')});
      await vscode.commands.executeCommand('netclaw.openRag');
      const rag=await frameFor('#rag-search');assert.match(await rag.locator('h1').textContent(),/RAG/);
      if(process.env.NETCLAW_TEST_REAL_RAG==='1'){
        await rag.locator('#documents').getByRole('heading',{name:'editor-qualification.md'}).waitFor({timeout:30000});
        await rag.locator('#query').fill('When is the lab change window?');await rag.getByRole('button',{name:'Search knowledge'}).click();
        await rag.locator('#results article').first().waitFor({timeout:60000});
        assert.match(await rag.locator('#results').textContent(),/violet Thursday/);assert.match(await rag.locator('#results').textContent(),/ingested/);
        rendered.push('RAG collection and cited retrieval through real cached local embeddings');
      }else rendered.push('RAG panel entry point; backend retrieval not exercised');
      await page.screenshot({path:path.join(process.env.NETCLAW_TEST_SCREENSHOTS,'rag.png')});
      await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
      await vscode.commands.executeCommand('notifications.clearAll');
      await vscode.commands.executeCommand('netclaw.openNetwork');
      const network=await frameFor('#network-graph');await network.locator('#nodes').getByRole('heading',{name:'LAB-R1',exact:true}).waitFor();
      assert.match(await network.locator('#nodes').textContent(),/Live state unknown/);
      await network.locator('#layer').selectOption('historical');await network.locator('#edges').getByRole('heading',{name:'LAB-R1 → LAB-R2',exact:true}).waitFor();
      assert.match(await network.locator('#status').textContent(),/HISTORICAL/);assert.match(await network.locator('#nodes').textContent(),/STALE/);
      await network.locator('#network-graph').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.NETCLAW_TEST_SCREENSHOTS,'network.png')});
      await network.locator('#layer').selectOption('simulated');await network.locator('#removed').waitFor({state:'visible'});
      await network.locator('#removed').selectOption({label:'LAB-R1'});assert.match(await network.locator('#counts').textContent(),/1 incident relationships/);assert.equal(await network.locator('#network-graph line').count(),0);
      rendered.push('Network configured/historical provenance and local graph simulation with synthetic observations');count++;
      const operations=await api.connection.call('operator_resources',{kind:'overview'});assert.equal(operations.data.operations.length,initialOperations);rendered.push('No backend dispatch from opening views, draft text, branching or retrieval');count+=5;
    }finally{await browser.close();}
  }
  await api.connection.disconnect();assert.equal(api.connection.ready,false);count++;
  await assert.rejects(api.connection.call('operator_identity'));count++;
  for(const profile of profiles)await api.profiles.remove(profile.id);
  fs.writeFileSync(process.env.NETCLAW_TEST_REPORT,JSON.stringify({editor:vscode.version,remoteName:vscode.env.remoteName||null,platform:process.platform,architecture:process.arch,osRelease:os.release(),extensionVersion:extension.packageJSON.version,backendNode:process.env.NETCLAW_TEST_NODE,assertionGroups:count,rendered,performance,screenshots:process.env.NETCLAW_TEST_SCREENSHOTS,passed:true}));
};

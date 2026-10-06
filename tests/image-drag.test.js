const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{once}=require('node:events');
const renderer=require('../lib/render'),store=require('../lib/document-store'),core=require('../resume-core');
test('preview image drag persists across reload and pages, rejects stale writes and resets to automatic placement',{timeout:60000},async()=>{
 const file=path.resolve('tmp/tests',randomUUID(),'resume.paper.json');const doc=store.commit(file,{markdown:'![证件照](templates/portrait.png)\n\n::: center\n# Example Name\nEmail: person@example.com\n:::\n\n## Summary\nSummary text.\n\n::: page\n\n# Second Page\n## Experience\nWork content.'},null).document;
 const server=require('../lib/server').start({file,port:0,quiet:true});await once(server,'listening');const browser=await renderer.launchBrowser(),url='http://127.0.0.1:'+server.address().port;
 try{const page=await browser.newPage({viewport:{width:1440,height:1800}});await page.goto(url+'/?resume=primary');const image=page.locator('.preview-image');await image.waitFor();const original=await (await fetch(url+'/api/preview')).json();assert.equal(original.images.length,1);
 const start=await image.boundingBox();await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(start.x+start.width/2-80,start.y+start.height/2+35,{steps:5});await page.mouse.up();await page.waitForFunction(()=>document.querySelector('.preview-image')&&window.PaperApp.getState().settings.imagePositions&&Object.keys(window.PaperApp.getState().settings.imagePositions).length===1);
 const saved=store.load(file),id=original.images[0].id;assert.ok(saved.settings.imagePositions[id].x<original.images[0].x);assert.equal(saved.markdown,doc.markdown);
 const stale=await fetch(url+'/api/image-position',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:doc.revision,imageId:id,position:{page:1,x:5,y:5}})});assert.equal(stale.status,409);
 await page.reload();await image.waitFor();const refreshed=await (await fetch(url+'/api/preview')).json();assert.equal(refreshed.images[0].x,saved.settings.imagePositions[id].x);
 // Drag directly to page two at a different browser width; coordinates must remain page-relative.
 await page.setViewportSize({width:1000,height:1900});await page.waitForFunction(()=>{const c=document.querySelector('#pdf-pages canvas');return c&&Math.abs(c.width/c.getBoundingClientRect().width-devicePixelRatio)<.02;});
 await image.scrollIntoViewIfNeeded();const from=await image.boundingBox(),second=await page.locator('.pdf-page-surface').nth(1).boundingBox();await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(second.x+120,second.y+70,{steps:10});await page.mouse.up();await page.waitForFunction(()=>Object.values(window.PaperApp.getState().settings.imagePositions||{}).some(p=>p.page===2));
 const moved=await (await fetch(url+'/api/preview')).json();assert.equal(moved.images[0].page,2);assert.equal(moved.pages,2);assert.equal((await fetch(url+moved.pdfUrl)).status,200);assert.equal((await fetch(url+moved.basePdfUrl)).status,200);
 // The exported PDF paints exactly one portrait on the saved page; the editable background has none.
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');for(const [href,expected] of [[moved.pdfUrl,[0,1]],[moved.basePdfUrl,[0,0]]]){const pdf=await pdfjs.getDocument({data:new Uint8Array(await (await fetch(url+href)).arrayBuffer())}).promise;try{for(let n=1;n<=2;n++){const ops=await (await pdf.getPage(n)).getOperatorList();assert.equal(ops.fnArray.filter(fn=>fn===pdfjs.OPS.paintImageXObject).length,expected[n-1]);}}finally{await pdf.loadingTask.destroy();}}
 await image.click();await page.locator('#image-reset-position').click();await page.waitForFunction(()=>Object.keys(window.PaperApp.getState().settings.imagePositions||{}).length===0);const reset=await (await fetch(url+'/api/preview')).json();assert.equal(reset.images[0].page,1);assert.ok(Math.abs(reset.images[0].x-original.images[0].x)<.1);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('manual image coordinates are bounded and normalized without mutating other settings',()=>{assert.throws(()=>core.normalizeSettings({imagePositions:{test:{page:1,x:205,y:0,width:20,height:20}}}));assert.throws(()=>core.normalizeSettings({imagePositions:{test:{page:1.5,x:5,y:5,width:20,height:20}}}));const result=core.normalizeSettings({imagePositions:{test:{page:2,x:5,y:5,width:20,height:20}}});assert.equal(result.imagePositions.test.page,2);});

test('corner resize and photo height edit change actual PDF size while preserving ratio, text positions and reload state',{timeout:60000},async()=>{
 const file=path.resolve('tmp/tests',randomUUID(),'resume.paper.json');
 const doc=store.commit(file,{markdown:'![证件照](templates/portrait.png)\n\n::: center\n# Example\nEmail: person@example.com\n:::\n\n## Summary\nBody content must stay still.',settings:{photoHeight:'32'}},null).document;
 const server=require('../lib/server').start({file,port:0,quiet:true});await once(server,'listening');const browser=await renderer.launchBrowser(),url='http://127.0.0.1:'+server.address().port;
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 async function readPdf(href){return pdfjs.getDocument({data:new Uint8Array(await(await fetch(url+href)).arrayBuffer())}).promise;}
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1200}});await page.goto(url+'/?resume=primary');const image=page.locator('.preview-image');await image.waitFor();const original=await(await fetch(url+'/api/preview')).json(),id=original.images[0].id;
  const beforePdf=await readPdf(original.basePdfUrl),beforeText=(await(await beforePdf.getPage(1)).getTextContent()).items.find(i=>i.str.includes('Body content'));await beforePdf.loadingTask.destroy();
  await image.click();const corner=await image.locator('.handle-se').boundingBox();await page.mouse.move(corner.x+5,corner.y+5);await page.mouse.down();await page.mouse.move(corner.x+30,corner.y+45,{steps:6});await page.mouse.up();await page.waitForFunction(()=>Object.values(window.PaperApp.getState().settings.imagePositions||{}).some(p=>p.height>35));
  const enlarged=store.load(file);assert.equal(enlarged.markdown,doc.markdown);assert.ok(enlarged.settings.imagePositions[id].height>35);assert.ok(Math.abs(enlarged.settings.imagePositions[id].width/enlarged.settings.imagePositions[id].height-original.images[0].width/original.images[0].height)<.0001);
  await page.reload();await image.waitFor();const after=await(await fetch(url+'/api/preview')).json();assert.equal(after.images[0].height,enlarged.settings.imagePositions[id].height);
  // Escape cancels a size change without creating a revision.
  await image.click();const nw=await image.locator('.handle-nw').boundingBox();await page.mouse.move(nw.x+5,nw.y+5);await page.mouse.down();await page.mouse.move(nw.x-10,nw.y-10);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(store.load(file).revision,enlarged.revision);
  await page.getByRole('button',{name:'样式设置',exact:true}).click();const height=page.locator('[data-setting="photoHeight"]');assert.ok(Math.abs(Number(await height.inputValue())-after.images[0].height)<.01);await height.fill('40');const persisted=page.waitForResponse(r=>r.url().includes('/api/document')&&r.request().method()==='PUT'&&r.ok());await height.press('Tab');await persisted;await page.waitForFunction(()=>Object.values(window.PaperApp.getState().settings.imagePositions||{}).some(p=>p.height===40));
  const numeric=await(await fetch(url+'/api/preview')).json();assert.equal(numeric.images[0].height,40);assert.ok(Math.abs(numeric.images[0].width/40-original.images[0].width/original.images[0].height)<.0001);
  const exported=await readPdf(numeric.pdfUrl),pdfPage=await exported.getPage(1),text=(await pdfPage.getTextContent()).items.find(i=>i.str.includes('Body content')),ops=await pdfPage.getOperatorList();assert.ok(Math.abs(text.transform[5]-beforeText.transform[5])<.5,'manual resize must not push the body down');assert.ok(ops.fnArray.some((fn,i)=>fn===pdfjs.OPS.transform&&Math.abs(ops.argsArray[i][3]-40*72/25.4)<.1),'export paints the requested height');await exported.loadingTask.destroy();
  const saved=store.load(file);const invalid=await fetch(url+'/api/image-position',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:saved.revision,imageId:id,position:{page:1,x:10,y:10,width:80,height:40}})});assert.equal(invalid.status,400);assert.equal(store.load(file).revision,saved.revision);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});

test('photo height is the painted height before manual positioning, including the upper size limit',{timeout:30000},async()=>{
 const session=await renderer.createSession();try{
  for(const height of [20,65]){
   const report=await session.measure({markdown:'![证件照](templates/portrait.png)\n\n::: center\n# Example\nContact\n:::\n\n## Summary\nShort content.',settings:{photoHeight:String(height)}});
   assert.equal(report.images.length,1);assert.ok(Math.abs(report.images[0].height-height)<.15);
  }
 }finally{await session.close();}
 const base=core.normalizeSettings({photoHeight:'32',imagePositions:{'照片:test:0':{page:1,x:175,y:10,width:24,height:32}}});
 const changed=core.normalizeSettings({photoHeight:'40'},base);assert.equal(changed.imagePositions['照片:test:0'].height,40);assert.equal(changed.imagePositions['照片:test:0'].width,30);assert.equal(changed.imagePositions['照片:test:0'].layoutHeight,32);assert.equal(base.imagePositions['照片:test:0'].height,32);
});

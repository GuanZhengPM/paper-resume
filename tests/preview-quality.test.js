const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{once}=require('node:events');
const renderer=require('../lib/render'),store=require('../lib/document-store');
test('PDF preview matches Retina pixels and rerenders when the available width changes',{timeout:45000},async()=>{
 const file=path.resolve('tmp/tests',randomUUID(),'resume.paper.json');const original=store.commit(file,{markdown:'# Example Name\n## Experience\nReadable preview at every window size.'},null).document;
 const server=require('../lib/server').start({file,port:0,quiet:true});await once(server,'listening');const browser=await renderer.launchBrowser();
 try{const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2}),page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/?resume=primary');
 const verify=async()=>{await page.waitForFunction(()=>{const c=document.querySelector('#pdf-pages canvas');return c&&Math.abs(c.width/c.getBoundingClientRect().width-devicePixelRatio)<.02;});return page.locator('#pdf-pages canvas').evaluate(c=>c.width);};
 const first=await verify();assert.ok(first>1000);await page.setViewportSize({width:900,height:1000});const smaller=await verify();assert.ok(smaller<first);await page.setViewportSize({width:1920,height:1000});assert.ok(await verify()>smaller);assert.equal(store.load(file).revision,original.revision);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('exported PDF retains both edges of a header portrait without changing text layout',{timeout:45000},async()=>{
 const {createCanvas}=renderer.dependency('@napi-rs/canvas'),photo=createCanvas(100,140),ctx=photo.getContext('2d');ctx.fillStyle='#444';ctx.fillRect(0,0,100,140);ctx.fillStyle='#ff0000';ctx.fillRect(0,0,100,20);ctx.fillStyle='#0000ff';ctx.fillRect(0,120,100,20);
 const file=path.resolve('tmp/tests',randomUUID(),'resume.paper.json'),base=require('../lib/templates').apply({markdown:'# Example Name\nEmail: example@example.com\n\n## Summary\nA short summary.\n\n## Education\nExample University'},'internship');
 const document=require('../lib/images').insert(base,photo.toBuffer('image/png'),'photo',undefined,file);const session=await renderer.createSession({file});
 try{const before=await session.measure(base,{details:true});const result=await session.measure(document,{prefix:path.join(path.dirname(file),'portrait'),details:true});assert.deepEqual(result.blocks.filter(b=>b.kind!=='img'&&b.text),before.blocks.filter(b=>b.text));
 const {pathToFileURL}=require('node:url');const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(result.artifacts.pdf)),useSystemFonts:true}).promise;
 try{const page=await pdf.getPage(1),viewport=page.getViewport({scale:2}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext('2d');await page.render({canvasContext:context,viewport}).promise;const data=context.getImageData(0,0,canvas.width,canvas.height).data;let red=0,blue=0;for(let i=0;i<data.length;i+=4){if(data[i]>230&&data[i+1]<25&&data[i+2]<25)red++;if(data[i]<25&&data[i+1]<25&&data[i+2]>230)blue++;}assert.ok(red>100&&blue>100,'Both portrait edges must be visible in the actual PDF');assert.ok(red/blue>.9&&red/blue<1.1,`Top edge clipped: ${red} / ${blue}`);
 }finally{await pdf.loadingTask.destroy();}
 }finally{await session.close();}
});

test('explicit portrait height reserves header space, survives template changes and HTML export',{timeout:30000},async()=>{
 const core=require('../resume-core'),templates=require('../lib/templates');const doc=templates.apply({markdown:'![证件照](templates/portrait.png)\n\n# Example Name\nPhone: 10000000000 Email: example@example.com Contact: example\n\n## Summary\nA short summary.\n\n## Experience\nExample company',settings:{photoHeight:37.76}},'internship');
 assert.equal(templates.apply(doc,'projects').settings.photoHeight,'37.76');assert.throws(()=>core.normalizeSettings({photoHeight:100}));
 const file=path.resolve('tmp/tests',randomUUID(),'resume.paper.json');const session=await renderer.createSession({file});
 try{const result=await session.measure(doc,{details:true});const photo=result.blocks.find(b=>b.kind==='img'),section=result.blocks.find(b=>b.text==='Summary');assert.ok(Math.abs(photo.heightMm-37.76)<.1);const gap=section.topMm+section.heightMm-photo.topMm-photo.heightMm;assert.ok(gap>=0&&gap<1,'Portrait bottom should sit directly above the first section rule');const body=result.blocks.find(b=>b.text==='A short summary.');assert.ok(body.topMm>photo.topMm+photo.heightMm,'Photo must not overlap summary text');assert.deepEqual(result.overflow,[]);const output=path.join(path.dirname(file),'export.html');fs.mkdirSync(path.dirname(file),{recursive:true});assert.match(require('../cli').exportHTML(doc,output,file),/data-photo-height="37.76"/);
 const reverted=await session.measure({...doc,settings:{...doc.settings,photoHeight:''}},{details:true});assert.ok(reverted.blocks.find(b=>b.kind==='img').heightMm<photo.heightMm);
 }finally{await session.close();}
});

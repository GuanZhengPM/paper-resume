'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{once}=require('node:events');
const store=require('../lib/document-store'),renderer=require('../lib/render'),{main}=require('../cli');
test('fresh browser upload, content consultation, CLI apply, manual editing and PDF download form one workflow',{timeout:90000},async()=>{
 const folder=path.resolve('tmp/tests/release',randomUUID()),file=path.join(folder,'resume.paper.json');fs.mkdirSync(folder,{recursive:true});
 const home=path.join(folder,'agent-home');const installed=require('../lib/agent-install').install({home});assert.ok(fs.existsSync(path.join(path.dirname(installed.skill),'references/setup.md')));
 const server=require('../lib/server').start({file,port:0,quiet:true});await once(server,'listening');const browser=await renderer.launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('[data-template="projects"]').click();
  await page.locator('#resume-name').fill('Release Example');await page.locator('#resume-file').setInputFiles({name:'example.txt',mimeType:'text/plain',buffer:Buffer.from('Example Name\nExperience\nExample Company 2024.01 - Present\n- Reviewed customer feedback and delivered 3 improvements.\n- Assisted with launch.\nEducation\nExample University 2020.09 - 2024.06\n- Bachelor degree.')});
  await page.locator('#create-submit').click();await page.locator('#create-dialog').waitFor({state:'hidden'});await page.locator('#pdf-pages canvas').first().waitFor();
  const id=new URL(page.url()).searchParams.get('resume'),target=require('../lib/library').resolve(file,id);const doc=store.load(target);assert.equal(doc.settings.templateId,'projects');
  const packet=await main(['content','--file',file,'--id',id,'--target','Product manager','--role','product']);assert.equal(packet.expectedRevision,doc.revision);
  const before='Reviewed customer feedback and delivered 3 improvements.',after='Delivered 3 improvements based on customer feedback.';
  const plan={version:1,expectedRevision:doc.revision,target:'Product manager',role:'product',mode:'plain',diagnosis:['Lead with the documented result; clarify launch responsibilities before strengthening that claim.'],answers:[],questions:[{question:'What did you own during launch?',status:'open'}],changes:[{id:'c1',before,after,reason:'Keep the same facts and make the result easier to find.',status:'ready',evidence:[{source:'resume',quote:before}]},{id:'c2',before:'Assisted with launch.',after:'Led launch with [example: 15%] growth.',reason:'Responsibilities and metrics are not yet supported.',status:'needs-input',evidence:[{source:'resume',quote:'Assisted with launch.'}]}]};
  const planFile=path.join(folder,'plan.json');fs.writeFileSync(planFile,JSON.stringify(plan));const preview=await main(['content','--file',file,'--id',id,'--action','preview','--plan',planFile]);assert.equal(preview.canApply,true);assert.equal(store.load(target).revision,doc.revision);
  const applied=await main(['content','--file',file,'--id',id,'--action','apply','--plan',planFile,'--select','c1']);await page.waitForFunction(r=>window.PaperApp.getRevision()===r,applied.revision);assert.ok((await page.locator('#editor').inputValue()).includes(after));assert.deepEqual(store.load(target).settings,doc.settings);
  const persisted=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/api/document')&&r.ok());await page.locator('#editor').fill((await page.locator('#editor').inputValue())+'\n\nManual follow-up.');await persisted;
  await assert.rejects(main(['content','--file',file,'--id',id,'--action','apply','--plan',planFile]),{code:'REVISION_CONFLICT'});
  const downloading=page.waitForEvent('download');await page.locator('#pdf-download').click();const download=await downloading,pdf=fs.readFileSync(await download.path());const extracted=await require('../lib/import').pdfText(pdf);assert.match(extracted.text,/Delivered 3 improvements/);assert.match(extracted.text,/Manual follow-up/);assert.match(extracted.text,/Assisted with launch/);assert.doesNotMatch(extracted.text,/15%/);
  const artifact=path.join(folder,'accepted.pdf');fs.writeFileSync(artifact,pdf);await page.screenshot({path:path.join(folder,'accepted.png')});
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});

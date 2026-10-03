const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');const core=require('../resume-core');const store=require('../lib/document-store');const {main}=require('../cli');const renderer=require('../lib/render');
test('local font names are safe and custom point sizes are accepted',()=>{
 for(const name of ['Segoe UI','Georgia','华文楷体','Source Han Serif SC'])assert.equal(core.normalizeSettings({fontFamily:name}).fontFamily,name);
 for(const name of ['','x" onload="alert(1)','x; color:red','</style>','x\nArial'])assert.throws(()=>core.normalizeSettings({fontFamily:name}));
 assert.equal(core.normalizeSettings({fontSize:10.25}).fontSize,'10.25');
});
test('custom fonts render in PDF and exported HTML without changing the interface font',{timeout:30000},async()=>{
 const dir=path.resolve('tmp/tests/local-font',randomUUID());fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'resume.paper.json');
 store.commit(file,{markdown:'# 张三\n## 工作经历\n完成项目100项，GitHub / Microsoft。',settings:{fontFamily:'Segoe UI',fontSize:10.25,roleGap:0}},null);
 const result=await main(['render','--file',file,'--output',path.join(dir,'preview')]);assert.equal(result.actualPages||result.report?.actualPages,1);
 const output=path.join(dir,'resume.html');await main(['export','--file',file,'--output',output]);assert.match(fs.readFileSync(output,'utf8'),/--role-gap:0mm/);
 const browser=await renderer.launchBrowser();try{const page=await browser.newPage();await page.goto(require('node:url').pathToFileURL(output).href);await page.evaluate(()=>document.fonts.ready);assert.match(await page.locator('.paper').evaluate(el=>getComputedStyle(el).fontFamily),/Segoe UI/);await page.screenshot({path:path.join(dir,'html.png')});}finally{await browser.close();}
});

'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {once}=require('node:events');
const core=require('../resume-core.js');
const store=require('./document-store.js');
const renderVersion=require('node:crypto').createHash('sha256').update(['app.js','resume.css','styles.css','resume-core.js','resume-structure.js','template-profiles.js','resume-renderer.js','text-style.js','lib/render.js','lib/pdf-images.js'].map(name=>fs.readFileSync(path.resolve(__dirname,'..',name))).map(buffer=>buffer.toString('utf8')).join('\n')).digest('hex');
function dependency(name) {
  const paths=[path.resolve(__dirname,'..'),path.resolve(path.dirname(process.execPath),'..'),...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)];
  try {return require(require.resolve(name,{paths}));} catch {core.fail(`缺少 ${name}；请运行 npm install。基础编辑命令无需这些依赖。`,'RENDER_DEPENDENCY');}
}
function browserCandidates(explicit) {
  if (explicit) {if(!fs.existsSync(explicit))core.fail('browser-path 不存在');return [path.resolve(explicit)];}
  const candidates=[process.env.PAPER_BROWSER_PATH];
  if(process.platform==='win32')for(const folder of [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean)) for(const name of ['Google/Chrome/Application/chrome.exe','Microsoft/Edge/Application/msedge.exe'])candidates.push(path.join(folder,name));
  else if(process.platform==='darwin')candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  else candidates.push('/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/opt/google/chrome/chrome');
  const matches=[...new Set(candidates.filter(value=>value && fs.existsSync(value)))];
  if(!matches.length)core.fail('找不到 Chrome / Edge；安装其中一个，或指定 --browser-path。','BROWSER_NOT_FOUND');
  return matches;
}
function browserExecutable(explicit) {return browserCandidates(explicit)[0];}
async function launchBrowser(explicit) {
  const {chromium}=dependency('playwright-core');const failures=[];
  for(const executablePath of browserCandidates(explicit)) {
    try {return await chromium.launch({headless:true,executablePath,timeout:30000});}
    catch(error) {failures.push(`${path.basename(executablePath)}: ${error.message.split('\n')[0]}`);}
  }
  core.fail('后台浏览器无法启动；可用 --browser-path 指定其他 Chromium。'+failures.join('; '),'BROWSER_LAUNCH_FAILED');
}
async function createSession(options={}) {
  const {PDFDocument}=dependency('pdf-lib');
  let snapshot;let browser;let server;
  try {
    server=require('./server.js').start({file:options.file || 'resume.paper.json',port:0,quiet:true,getSnapshot:()=>snapshot});
    await once(server,'listening');
    browser=await launchBrowser(options.browserPath);
    const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const url=`http://127.0.0.1:${server.address().port}/index.html`;let loaded=false;const metrics={navigations:0,pdfRenders:0,geometryChecks:0};
    async function measure(input,artifacts={}) {
      snapshot={...core.document(input),revision:store.revision(input),fileName:path.basename(options.file || 'resume.paper.json')};errors.length=0;
      if(!loaded){await page.goto(url+'?view=render',{waitUntil:'domcontentloaded'});await page.evaluate(()=>window.paperReady);loaded=true;metrics.navigations++;}else await page.evaluate(doc=>window.PaperApp.renderSnapshot(doc),snapshot);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#resume img,#resume svg image')].map(img=>{if(img.tagName.toLowerCase()==='image'){const loaded=new Image();loaded.src=img.getAttribute('href');return loaded.decode().catch(()=>{});}return img.decode().catch(()=>{});}));});
      await page.evaluate(()=>window.PaperRenderer.decorateExperiences(document.getElementById('resume')));
      if(errors.length)core.fail('渲染失败：'+errors.join('; '),'RENDER_FAILED');
      const layout=await page.evaluate(()=>window.PaperApp.inspectLayout());
      metrics.geometryChecks++;let pdf,basePdf,images=[],actualPages=null;if(!artifacts.geometryOnly){
        const compositor=require('./pdf-images');let records;
        try{records=await compositor.prepare(page);const raw=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
          if(records.length){const composed=await compositor.compose(raw,records,snapshot.settings.imagePositions);pdf=composed.pdf;basePdf=composed.basePdf;images=composed.images;}else pdf=basePdf=raw;
        }finally{await compositor.cleanup(page);}
        metrics.pdfRenders++;actualPages=(await PDFDocument.load(pdf)).getPageCount();
      }
      const paths={};
      if(artifacts.prefix) {
        const prefix=path.resolve(artifacts.prefix);fs.mkdirSync(path.dirname(prefix),{recursive:true});
        paths.pdf=prefix+'.pdf';paths.report=prefix+'.report.json';if(!artifacts.pdfOnly)paths.screenshot=prefix+'.png';
        fs.writeFileSync(paths.pdf,pdf);paths.basePdf=prefix+'.base.pdf';fs.writeFileSync(paths.basePdf,basePdf);
        if(paths.screenshot){if(Object.keys(snapshot.settings.imagePositions||{}).length)await require('./pdf-images').screenshot(page,pdf,paths.screenshot);else await page.locator('#resume').screenshot({path:paths.screenshot});}
        if(artifacts.ui) {loaded=false;await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(async()=>{await window.paperReady;await document.fonts.ready;});paths.ui=prefix+'.ui.png';await page.screenshot({path:paths.ui,fullPage:true});}
      }
      const targetPages=snapshot.settings.targetPages==='auto'?'auto':Number(snapshot.settings.targetPages);
      const result={images,renderVersion,revision:snapshot.revision,actualPages,targetPages,fitsTarget:actualPages===null?null:!layout.overflow.length&&(targetPages==='auto'||actualPages<=targetPages),estimatedPages:layout.estimatedPages,remainingMmEstimated:layout.remainingMmEstimated,overflow:layout.overflow,settings:snapshot.settings,artifacts:paths,...(artifacts.details?{blocks:layout.blocks}:{})};
      if(paths.report)fs.writeFileSync(paths.report,JSON.stringify(result,null,2)+'\n','utf8');
      return result;
    }
    return {measure,inspect:input=>measure(input,{geometryOnly:true}),metrics,close:async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));}};
  } catch(error) {if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));throw error;}
}
async function render(input,options={}) {const session=await createSession(options);try{return await session.measure(input,{prefix:options.output,ui:options.ui,details:options.details});}finally{await session.close();}}
async function fit(input,options={}) {
  const session=options.session||await createSession(options);const attempts=[];
  try {
    const candidates=core.fitCandidates(input);let best;
    for(const [index,candidate] of candidates.entries()) {
      const report=await session.measure(candidate);
      attempts.push({step:index,actualPages:report.actualPages,overflowCount:report.overflow.length,settings:candidate.settings});best={document:candidate,report};
      if(report.actualPages===1 && !report.overflow.length)break;
    }
    const fits=best.report.actualPages===1 && !best.report.overflow.length;
    if(options.output)best.report=await session.measure(best.document,{prefix:options.output,ui:options.ui,details:options.details});
    return {fits,document:best.document,report:best.report,attempts,message:fits?'已通过实际 PDF 检查：1 页 A4':'在正文至少 9pt、上下边距至少 6mm、左右边距至少 8mm 的范围内仍无法压为一页。请精简内容或保留多页；原文档未修改。'};
  } finally {if(!options.session)await session.close();}
}
module.exports={createSession,render,fit,dependency,browserExecutable,launchBrowser,renderVersion};

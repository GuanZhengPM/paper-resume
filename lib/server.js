'use strict';
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const store=require('./document-store');const core=require('../resume-core');const templates=require('./templates');const library=require('./library');
const ROOT=path.resolve(__dirname,'..');const allowed=new Set(['index.html','styles.css','resume.css','app.js','image-drag.js','document-sync.js','text-style.js','page-layout.js','resume-core.js','resume-structure.js','template-profiles.js','resume-renderer.js','CLI使用说明.md','AGENT_GUIDE.md','示例简历.md']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.md':'text/plain; charset=utf-8','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
function start({file,port=8765,quiet=false,getSnapshot}){
 const previews=new Map();let workerPromise,workerQueue=Promise.resolve(),workerIdle;
 function renderPreview(doc,prefix){const run=async()=>{clearTimeout(workerIdle);if(!workerPromise)workerPromise=require('./render').createSession({file});const worker=await workerPromise;try{return await worker.measure(doc,{prefix,pdfOnly:true});}catch(error){workerPromise=null;await worker.close().catch(()=>{});throw error;}finally{workerIdle=setTimeout(async()=>{const old=workerPromise;workerPromise=null;if(old)await (await old).close().catch(()=>{});},45000);workerIdle.unref();}};const task=workerQueue.then(run,run);workerQueue=task.catch(()=>{});return task;}
 async function preview(target,doc){const key=target+doc.revision;if(!previews.has(key)){if(previews.size>12)previews.delete(previews.keys().next().value);const promise=(async()=>{const prefix=path.join(path.dirname(target),'.paper-previews',doc.revision);let report;try{report=JSON.parse(fs.readFileSync(prefix+'.report.json','utf8'));if(report.revision!==doc.revision||report.renderVersion!==require('./render').renderVersion||!fs.existsSync(report.artifacts.pdf))report=null;}catch{}if(!report)report=await renderPreview(doc,prefix);return {report,pdf:report.artifacts.pdf};})();previews.set(key,promise);promise.catch(()=>previews.delete(key));}return previews.get(key);}
 const server=http.createServer(async(request,response)=>{
  const json=(status,data)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(data));};
  try{
   if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host||''))return json(403,{error:{code:'INVALID_HOST',message:'仅支持本机访问'}});
   const url=new URL(request.url,`http://${request.headers.host}`);const id=url.searchParams.get('id')||'primary';
   const body=async(max=2*1024*1024)=>{if(getSnapshot)core.fail('只读快照不支持修改');if(request.headers.origin&&request.headers.origin!==url.origin)core.fail('不允许跨站修改','INVALID_ORIGIN');if(!/^application\/json(?:;|$)/i.test(request.headers['content-type']||''))core.fail('需要 application/json');const chunks=[];let size=0;for await(const c of request){size+=c.length;if(size>max)core.fail('请求文件过大');chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{core.fail('无效 JSON');}};
   const target=()=>library.resolve(file,id);const checked=revision=>{const previous=store.load(target());if(typeof revision!=='string'||previous.revision!==revision)core.fail('简历已更新，请重新读取。','REVISION_CONFLICT');return previous;};
   const dataBuffer=input=>{if(typeof input.data!=='string'||!input.data||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data))core.fail('无效文件数据');return Buffer.from(input.data,'base64');};
   if(url.pathname==='/api/templates'&&request.method==='GET')return json(200,{templates:templates.templates});
   if(url.pathname==='/api/rename'&&request.method==='POST'){const input=await body();return json(200,library.rename(file,id,input.name));}
   if(url.pathname==='/api/documents'){
    if(request.method==='GET')return json(200,{documents:getSnapshot?[]:library.list(file)});
    if(request.method!=='POST'||getSnapshot)return json(405,{error:{message:'不支持此方法'}});
    const input=await body(36*1024*1024);let prepared,buffer;if(input.data){buffer=dataBuffer(input);prepared=await require('./import').prepare(buffer,input.fileName,input.template||'projects');prepared=await require('./ingest').arrange(prepared,{file});}
    const saved=library.create(file,{name:input.name,template:input.template||'projects',document:prepared?.document});
    let imported;if(prepared)imported=require('./import').commit(saved.file,prepared,buffer,saved.document.revision);
    if(prepared?.report)previews.set(saved.file+(imported?.document||saved.document).revision,Promise.resolve({report:prepared.report,pdf:prepared.report.artifacts.pdf}));
    return json(200,{id:saved.id,name:saved.name,document:{...(imported?.document||saved.document),fileName:saved.name},warnings:prepared?.warnings||[],pagination:prepared?.pagination});
   }
   if(url.pathname==='/api/document'){
    if(request.method==='GET'){const doc=getSnapshot?getSnapshot():store.load(target());return json(200,{...doc,fileName:getSnapshot?doc.fileName:library.list(file).find(d=>d.id===id)?.name});}
    if(request.method!=='PUT'||getSnapshot)return json(405,{error:{message:'不支持此方法'}});const input=await body(8*1024*1024);const previous=checked(input.expectedRevision);const next=input.operations?core.apply(previous,input.operations):input.document;const saved=store.commit(target(),next,input.expectedRevision);return json(200,{...saved.document,fileName:library.list(file).find(d=>d.id===id)?.name});
   }
   if(url.pathname==='/api/import'&&request.method==='POST'){
    const input=await body(36*1024*1024);checked(input.expectedRevision);const buffer=dataBuffer(input);let prepared=await require('./import').prepare(buffer,input.fileName,input.template||'preserve');prepared=await require('./ingest').arrange(prepared,{file:target()});const saved=require('./import').commit(target(),prepared,buffer,input.expectedRevision);return json(200,{document:{...saved.document,fileName:library.list(file).find(d=>d.id===id)?.name},warnings:saved.warnings});
   }
   if(url.pathname==='/api/template'&&request.method==='POST'){
    const input=await body();let previous=checked(input.expectedRevision);
    if(input.template==='bilingual')previous=await require('./bilingual').convert(previous);
    const draft=templates.apply(previous,input.template);
    const output=path.join(path.dirname(target()),'.paper-previews','template-'+require('node:crypto').randomUUID());
    const result=await require('./autolayout').layout(draft,{file:target(),output});
    if(!result.fits)core.fail(result.message,'LAYOUT_FAILED');
    const saved=store.commit(target(),result.document,input.expectedRevision);
    previews.set(target()+saved.document.revision,Promise.resolve({report:result.report,pdf:result.report.artifacts.pdf}));
    return json(200,{document:{...saved.document,fileName:library.list(file).find(d=>d.id===id)?.name}});
   }
   if(url.pathname==='/api/layout'&&request.method==='POST'){
    const input=await body();const previous=checked(input.expectedRevision);const output=path.join(path.dirname(target()),'.paper-previews','layout-'+require('node:crypto').randomUUID());const result=await require('./autolayout').layout(previous,{mode:input.mode||'smart',file:target(),output});if(!result.fits)return json(200,{fits:false,message:result.message,pages:result.report.actualPages});const saved=store.commit(target(),result.document,input.expectedRevision);if(result.report.artifacts.pdf){if(previews.size>12)previews.delete(previews.keys().next().value);previews.set(target()+saved.document.revision,Promise.resolve({report:result.report,pdf:result.report.artifacts.pdf}));}return json(200,{fits:true,document:{...saved.document,fileName:library.list(file).find(d=>d.id===id)?.name},message:result.message});
   }
   if(url.pathname==='/api/image-position'&&request.method==='POST'){
    const input=await body(),previous=checked(input.expectedRevision),rendered=await preview(target(),previous);const image=rendered.report.images?.find(i=>i.id===input.imageId);if(!image)core.fail('图片已变化，请刷新预览');
    const positions={...(previous.settings.imagePositions||{})};
    if(input.position===null)delete positions[input.imageId];else{
      const p=input.position;if(!p||!Number.isInteger(p.page)||p.page<1||p.page>rendered.report.actualPages||!Number.isFinite(p.x)||!Number.isFinite(p.y))core.fail('图片位置无效');
      let width=image.width,height=image.height;
      if(p.width!==undefined||p.height!==undefined){
        if(!Number.isFinite(p.width)||!Number.isFinite(p.height)||p.width<=0||p.height<=0)core.fail('图片尺寸无效');
        if(Math.abs(p.width/p.height-image.width/image.height)>.01)core.fail('缩放必须保持图片比例');
        const minHeight=image.kind==='照片'?8:4,maxHeight=image.kind==='照片'?65:image.pageHeight;
        if(p.height<minHeight-.01||p.height>maxHeight+.01||p.width>image.pageWidth)core.fail('图片尺寸超出范围');
        height=p.height;width=height*image.width/image.height;
      }
      positions[input.imageId]={page:p.page,x:Math.max(0,Math.min(p.x,image.pageWidth-width)),y:Math.max(0,Math.min(p.y,image.pageHeight-height)),width,height,...(image.kind==='照片'?{layoutHeight:positions[input.imageId]?.layoutHeight||image.height}:{})};
    }
    const saved=store.commit(target(),{...previous,settings:{...previous.settings,imagePositions:positions}},input.expectedRevision);return json(200,{document:{...saved.document,fileName:library.list(file).find(d=>d.id===id)?.name}});
   }
   if(url.pathname==='/api/image'&&request.method==='POST'){
    const input=await body(4*1024*1024);const previous=checked(input.expectedRevision);const buffer=dataBuffer(input);const crop=await require('./images').cropBounds(buffer,input.crop||(input.kind==='logo'?'auto':'none'));const next=require('./images').insert(previous,buffer,input.kind,input.heading,target(),{position:input.position,crop});const saved=store.commit(target(),next,input.expectedRevision);return json(200,{document:{...saved.document,fileName:library.list(file).find(d=>d.id===id)?.name}});
   }
   if((url.pathname==='/api/preview'||url.pathname==='/api/pdf')&&request.method==='GET'){
    if(getSnapshot)return json(405,{error:{message:'快照不支持 PDF 预览'}});const doc=store.load(target());if(url.searchParams.get('revision')&&url.searchParams.get('revision')!==doc.revision)core.fail('预览版本已更新','REVISION_CONFLICT');const result=await preview(target(),doc);const pdfUrl=`/api/pdf?id=${encodeURIComponent(id)}&revision=${doc.revision}`;
    if(url.pathname==='/api/preview')return json(200,{revision:doc.revision,pages:result.report.actualPages,pdfUrl,basePdfUrl:pdfUrl+'&layer=base',images:result.report.images||[],overflow:result.report.overflow});
    response.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'no-store',...(url.searchParams.has('download')?{'Content-Disposition':"attachment; filename=resume.pdf; filename*=UTF-8''"+encodeURIComponent((library.list(file).find(d=>d.id===id)?.name||'简历')+'.pdf')}:{})});return fs.createReadStream(url.searchParams.get('layer')==='base'?result.report.artifacts.basePdf:result.pdf).pipe(response);
   }
   if(!['GET','HEAD'].includes(request.method))return json(405,{error:{message:'不支持此方法'}});
   const imageAsset=/^\/assets\/([a-f0-9]{64}\.(?:png|jpg|webp))$/.exec(url.pathname);if(imageAsset){const asset=path.join(require('./images').folder(file),imageAsset[1]);if(!fs.existsSync(asset))return json(404,{error:{message:'图片不存在'}});response.writeHead(200,{'Content-Type':{png:'image/png',jpg:'image/jpeg',webp:'image/webp'}[path.extname(asset).slice(1)],'Cache-Control':'private, max-age=86400'});return fs.createReadStream(asset).pipe(response);}
   const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname).slice(1);if(!allowed.has(name)&&!/^(fonts|vendor|templates)\/[A-Za-z0-9_.-]+$/.test(name)&&!/^docs\/templates\/[A-Za-z0-9_.-]+\.(png|pdf)$/.test(name))return json(404,{error:{message:'资源不存在'}});
   const asset=path.join(ROOT,name);if(!fs.existsSync(asset)||!fs.statSync(asset).isFile())return json(404,{error:{message:'资源不存在'}});const stat=fs.statSync(asset);const etag='"'+stat.size+'-'+Math.trunc(stat.mtimeMs)+'"';const cache=/^(fonts|vendor)\//.test(name)?'private, max-age=86400':'no-cache';if(request.headers['if-none-match']===etag){response.writeHead(304,{ETag:etag,'Cache-Control':cache});return response.end();}response.writeHead(200,{'Content-Type':mime[path.extname(asset)]||'application/octet-stream','Cache-Control':cache,ETag:etag,'X-Content-Type-Options':'nosniff'});if(request.method==='HEAD')return response.end();fs.createReadStream(asset).pipe(response);
  }catch(error){json(error.code==='REVISION_CONFLICT'?409:error.code==='DOCUMENT_LOCKED'?423:error.code==='INVALID_ORIGIN'?403:400,{error:{code:error.code||'REQUEST_FAILED',message:error.message,actualRevision:error.actualRevision,contentAudit:error.contentAudit}});}
 });server.on('close',()=>{clearTimeout(workerIdle);const old=workerPromise;workerPromise=null;if(old)old.then(worker=>worker.close()).catch(()=>{});});server.listen(port,'127.0.0.1',()=>{if(!quiet)process.stdout.write(JSON.stringify({ok:true,url:`http://127.0.0.1:${port}/index.html`,file:path.resolve(file)})+'\n');});server.on('error',error=>{process.stderr.write(JSON.stringify({ok:false,error:{code:error.code,message:error.message}})+'\n');process.exitCode=1;});return server;
}
module.exports={start};

#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const core=require('./resume-core.js');
const store=require('./lib/document-store.js');
const {start}=require('./lib/server.js');
const ROOT=__dirname;
const structure=require('./resume-structure');
const help={name:'paper-resume',usage:'node cli.js <command> --file resume.paper.json [options]',commands:{
  'install-agent':'安装 Codex 自动导入与编辑技能；已有不同版本时需 --force，保留备份',
  content:'内容优化：--action prepare|preview|apply；prepare 可用 --target 目标 --jd JD.txt --brief 要求.txt --role 岗位类别 --mode impact|plain --output 准备包.json；preview/apply 使用 --plan 方案.json，可用 --select c1,c2，apply --dry-run 仅预览',
  intake:'提取原文件和结构草稿，供宿主 Agent 对照核对：--input 文件 [--output intake.json]',
  import:'默认新建并自动排版；--structure structured.json 接收宿主整理结果；显式 --file 或 --id 更新已有简历。导入已有 PDF / DOCX / MD / TXT / JSON：--input 文件 --template projects|internship|research|academic|bilingual；--dry-run 查看提取结果',
  templates:'列出预设模板',template:'套用模板：--name projects|internship|research|academic|bilingual；保留正文，重排真实章节并应用模板字号、边距与经历布局；--dry-run 预览',
  rename:'重命名：--id 简历ID --name 新名称；保留正文和版本',list:'列出所有简历与文件位置',create:'新建简历：--template projects；可选 --name 自定义名称；返回 id，可用于后续 --id',layout:'自动整理排版，保留模板规范并允许自然多页；--dry-run 预览',image:'添加图片：--input photo.png --kind photo|logo|qr；二维码默认右上角，可用 --position left|right，保留完整图片及四周空白；photo 可用 --position left|right；logo 用 --heading 标题；logo和证件照可用 --crop auto|none|x,y,width,height，裁白边后等比例缩放，原图保留',
  init:'创建文档：--input resume.md 或 .json（默认通用模板）',show:'读取内容、settings、revision、行号、标题和分列；--summary 省略全文；--structured 读取当前正文的结构与块 ID',
  apply:'批量修改：--patch changes.json 或 --patch -（stdin）；--expect revision；--dry-run 预览不写入',
  style:'修改文字行：--heading 名称 / --line N / --row N；--size 12 --rule off --align center --bold --level 3；--cell N',
  settings:'修改整页设置：--json 配置JSON 或 --patch 配置文件',replace:'精确替换：--from 旧内容 --to 新内容；--all 或 --occurrence N',
  row:'两列/三列：--line N / --row N --cells JSON数组 --widths 1:2:1',
  'normalize-spaces':'移除中英与数字间的单个空格，保留英文词组、分列和连续空格',
  export:'导出：--output 简历.md / 简历.html / 简历.json；HTML 附带字体，可在浏览器打印成 PDF',
  render:'后台生成完整简历 PNG、PDF 与版面报告：--output output/preview；--ui 额外生成界面截图；--details 输出段落位置',
  check:'后台检查实际 PDF 页数与溢出，不生成文件',
  fit:'强制收紧排版至 1 页，保留内容：--output output/fitted；--dry-run 只预览；无法做到则保留原文件、退出码 2',
  serve:'启动编辑页面、PDF预览与上传入口：--port 8765（仅本机）；没有简历时显示模板首页',schema:'输出可用操作及字段说明',help:'显示帮助'
},agentGuide:'AGENT_GUIDE.md'};
function argumentsFor(argv) {
  const boolean=new Set(['dry-run','summary','all','bold','italic','no-bold','no-italic','force','help','ui','details','full','lines','new','no-layout','structured']);
  const allowed=new Set([...boolean,'file','input','patch','expect','heading','line','row','text','occurrence','size','rule','align','underline','level','cell','json','from','to','from-file','to-file','cells','widths','output','port','browser-path','template','name','id','kind','position','crop','structure','action','target','jd','brief','role','mode','plan','select']);
  const options={}; let command;
  for (let index=0;index<argv.length;index++) {
    const arg=argv[index];
    if (!arg.startsWith('--')) {if(command) core.fail(`多余参数：${arg}`); command=arg;continue;}
    const key=arg.slice(2); if (!allowed.has(key)) core.fail(`未知参数：--${key}`);
    if (boolean.has(key)) options[key]=true;
    else {if (argv[index+1]===undefined || argv[index+1].startsWith('--')) core.fail(`--${key} 缺少值`);options[key]=argv[++index];}
  }
  return {command:options.help?'help':command || 'help',options};
}
function jsonInput(file) {try {return JSON.parse(fs.readFileSync(file==='-'?0:path.resolve(file),'utf8').replace(/^\uFEFF/,''));} catch(error) {core.fail(`无法读取 JSON：${error.message}`);}}
function parseJSON(text) {try {return JSON.parse(text);} catch {core.fail('参数不是有效 JSON；多行内容请使用 --patch 文件');}}
function target(options) {
  const keys=['heading','line','row','text'].filter(key=>options[key]!==undefined);
  if (keys.length!==1) core.fail('请选择一个目标：--heading、--line、--row 或 --text');
  const key=keys[0]; const value=['line','row'].includes(key)?Number(options[key]):options[key];
  return {[key]:value,...(options.occurrence?{occurrence:Number(options.occurrence)}:{})};
}
function preview(previous,next) {
  const before=previous.markdown.split('\n'); const after=next.markdown.split('\n'); const lines=[];
  for(let index=0;index<Math.max(before.length,after.length);index++) if(before[index]!==after[index]) lines.push({line:index+1,before:before[index] ?? null,after:after[index] ?? null});
  const settings=Object.fromEntries(Object.keys(next.settings).filter(key=>next.settings[key]!==previous.settings[key]).map(key=>[key,{before:previous.settings[key],after:next.settings[key]}]));
  return {lines,settings};
}
function exportHTML(document,output,sourceFile=path.resolve('resume.paper.json')) {
  const renderer=require('./resume-renderer.js').create(require('./vendor/marked.js'),require('./text-style.js'));
  const folder=path.basename(output,'.html')+'.assets'; const assets=path.join(path.dirname(output),folder);fs.mkdirSync(assets,{recursive:true});
  for (const name of ['NotoSansSC.ttf','NotoSerifSC.ttf','OFL.txt']) {const source=path.join(ROOT,'fonts',name);if(fs.existsSync(source)) fs.copyFileSync(source,path.join(assets,name));}
  for(const m of document.markdown.matchAll(/!\[[^\]]*\]\(assets\/([a-f0-9]{64}\.(?:png|jpg|webp))\)/g)){const source=path.join(require('./lib/images').folder(sourceFile),m[1]);if(fs.existsSync(source))fs.copyFileSync(source,path.join(assets,m[1]));}
  for(const name of ['portrait.svg','portrait.png','emblem.svg'])fs.copyFileSync(path.join(ROOT,'templates',name),path.join(assets,name));
  let css=fs.readFileSync(path.join(ROOT,'resume.css'),'utf8').replaceAll('fonts/',encodeURIComponent(folder)+'/');
  const settings=document.settings;
  css+=`\n@page {size:A4;margin:${settings.marginTop||settings.marginVertical}mm ${settings.marginHorizontal}mm ${settings.marginBottom||settings.marginVertical}mm;}\nbody{padding:24px} @media print{body{padding:0}}`;
  const font=core.settingSchema.fontFamily.enum.includes(settings.fontFamily)?settings.fontFamily:'custom';
  const style=`--local-font:'${settings.fontFamily}';--page-spacing:${settings.pageSpacing||0}mm;--resume-font:${settings.fontSize}pt;--margin-vertical:${settings.marginVertical}mm;--margin-horizontal:${settings.marginHorizontal}mm;--experience-gap:${settings.experienceGap}mm;--experience-inner:${settings.experienceInner}mm;--role-gap:${settings.roleGap??1}mm;--margin-top:${settings.marginTop||settings.marginVertical}mm;--margin-bottom:${settings.marginBottom||settings.marginVertical}mm;${settings.lineHeight?'--custom-leading:'+settings.lineHeight:''}`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>简历</title><style>${css}</style></head><body><article class="paper" data-photo-height="${settings.photoHeight||''}" data-template="${settings.templateId||''}" data-theme="${settings.theme}" data-font="${font}" data-density="${settings.density}" style="${style}">${renderer.parse(document.markdown).replaceAll('templates/portrait.svg',encodeURIComponent(folder)+'/portrait.svg').replaceAll('templates/portrait.png',encodeURIComponent(folder)+'/portrait.png').replaceAll('templates/emblem.svg',encodeURIComponent(folder)+'/emblem.svg').replaceAll('src="assets/','src="'+encodeURIComponent(folder)+'/').replaceAll('href="assets/','href="'+encodeURIComponent(folder)+'/')}</article><script>const decorate=${require('./resume-renderer.js').decorateExperiences.toString()};decorate(document.querySelector('.paper'));document.fonts.ready.then(()=>decorate(document.querySelector('.paper')));</script></body></html>`;
}
async function main(argv) {
  const {command,options}=argumentsFor(argv); const baseFile=path.resolve(options.file || 'resume.paper.json');
  if(command==='install-agent')return require('./lib/agent-install').install({force:options.force});
  if(command==='intake'){
    if(!options.input)core.fail('需要 --input');
    const result=await require('./lib/ingest').intake(options.input,options.template||'preserve');
    if(options.output){const output=path.resolve(options.output);if(output===result.source)core.fail('输出不能覆盖原文件');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return {output,source:result.source,needsVision:result.needsVision,warnings:result.warnings};}
    return result;
  }
  if(command==='rename')return require('./lib/library').rename(baseFile,options.id||'primary',options.name);
  if(command==='list')return {documents:require('./lib/library').list(baseFile)};
  if(command==='create'){const result=require('./lib/library').create(baseFile,{name:options.name,template:options.template});return {id:result.id,name:result.name,file:result.file,revision:result.document.revision};}
  const file=options.id?require('./lib/library').resolve(baseFile,options.id):baseFile;
  if (command==='help') return help;
  if (command==='templates') return {templates:require('./lib/templates').templates};
  if (command==='import') {
    if(!options.input)core.fail('需要 --input');
    const before=fs.existsSync(file)?store.load(file):null;
    if(options.expect && options.expect!==before?.revision)core.fail('文档已更新，请重新读取 revision','REVISION_CONFLICT');
    const importer=require('./lib/import');const buffer=fs.readFileSync(path.resolve(options.input));
    const fresh=options.new||(!options.id&&!options.file);
    const supplied=options.structure?jsonInput(options.structure):undefined;
    let prepared=await importer.prepare(buffer,options.input,options.template || (fresh?'projects':'preserve'),{structure:supplied?.structure||supplied});
    if(options['dry-run'])return {file,dryRun:true,revision:before?.revision||null,...prepared};
    if(prepared.needsVision)core.fail('扫描页需要由宿主 Agent 识别，再通过 --structure 导入。','VISION_REQUIRED');
    if(!options['no-layout'])prepared=await require('./lib/ingest').arrange(prepared,{file,output:options.output,browserPath:options['browser-path']});
    if(fresh){
      const created=require('./lib/library').create(baseFile,{name:options.name,template:prepared.template,document:prepared.document});
      const saved=importer.commit(created.file,prepared,buffer,created.document.revision);
      return {id:created.id,name:created.name,file:created.file,revision:saved.document.revision,source:saved.source,warnings:prepared.warnings,report:prepared.report,contentAudit:prepared.contentAudit,pagination:prepared.pagination,images:prepared.images,template:prepared.template,url:'http://127.0.0.1:8765/index.html?resume='+created.id};
    }
    const saved=importer.commit(file,prepared,buffer,before?.revision||null);
    return {file,revision:saved.document.revision,changed:saved.changed,backup:saved.backup,source:saved.source,warnings:saved.warnings,template:saved.template,settings:saved.document.settings,report:prepared.report,contentAudit:prepared.contentAudit,pagination:prepared.pagination,images:prepared.images};
  }
  if (command==='schema') return {schemaVersion:1,structure:structure.schema,settings:core.settingSchema,operations:{
    'set-structure':{structure:'schema.structure；修改前读取 revision'},'edit-block':{id:'show --structured 返回的块 ID',values:'替换该块的字段'},'move-section':{id:'章节 ID',index:'目标序号，从 0 开始'},
    settings:{values:'settings 对象'},'set-markdown':{markdown:'完整 Markdown'},replace:{from:'精确旧文本',to:'替换文本',occurrence:'从 1 开始，重复匹配时必填；或 all:true'},
    style:{target:'line / heading / row / text，重复目标加 occurrence',cell:'可选列号（1–3）',style:{size:'8–36 或空字符串',align:'left / center / right / 空字符串',rule:'on / off / 空字符串',underline:'on / off / 空字符串',bold:'boolean',italic:'boolean',level:'0–6'}},
    row:{target:'line / row',cells:'2 或 3 个单行 Markdown 字符串',widths:'例如 1:2:1'},insert:{target:'目标',position:'before / after（默认）',text:'Markdown'},gap:{target:'目标',position:'before / after',mm:'0–40'},remove:{target:'开始行',endLine:'含此行的结束行'},'normalize-spaces':{}
  },batch:{expectedRevision:'show 返回的 revision',operations:'按顺序执行；可用 --dry-run 预览'},content:require('./lib/content').schema,agentGuide:'AGENT_GUIDE.md'};
  if (command==='init' || command==='serve' && !fs.existsSync(file) && (options.input || options.template)) {
    if (fs.existsSync(file) && !options.force) core.fail('文档已存在；换一个文件名或明确使用 --force','DOCUMENT_EXISTS');
    let input=options.template?require('./lib/templates').apply({markdown:''},options.template):{markdown:fs.readFileSync(path.join(ROOT,'示例简历.md'),'utf8'),settings:{}};
    if (options.input) input=/\.json$/i.test(options.input)?jsonInput(options.input):{markdown:fs.readFileSync(path.resolve(options.input),'utf8'),settings:{}};
    const previous=fs.existsSync(file)?store.load(file):null;
    const result=store.commit(file,input,previous?.revision || null);
    if(command==='init') return {file,changed:result.changed,revision:result.document.revision,settings:result.document.settings,backup:result.backup};
  }
  if (command==='serve') {
    const port=Number(options.port || 8765);if (!Number.isInteger(port) || port<1 || port>65535) core.fail('port 必须为 1–65535');
    start({file,port});return undefined;
  }
  const previous=store.load(file);
  if(command==='content'){
    const content=require('./lib/content'),action=options.action||'prepare';
    if(action==='prepare'){const packet=content.prepare(previous,options);return options.output?{file,output:content.writeNew(options.output,packet),status:packet.status,revision:previous.revision}:packet;}
    if(!['preview','apply'].includes(action)||!options.plan)core.fail('content 需要 --action preview|apply --plan 方案.json');
    const result=content.review(previous,jsonInput(options.plan),options.select);
    const output=options.output?content.writeNew(options.output,/\.md$/i.test(options.output)?content.report(result):result):undefined;
    if(action==='preview'||options['dry-run'])return {file,...result,output,applied:false};
    if(!result.canApply)core.fail('所选修改包含待补充信息、示例数字或缺少依据，请先修正方案','CONTENT_NOT_READY');
    const saved=store.commit(file,result.document,result.expectedRevision);
    return {file,applied:true,changed:saved.changed,revision:saved.document.revision,backup:saved.backup,output,changes:result.changes.filter(c=>c.selected),next:'运行 render 检查修改后的 PDF；需要调整排版时再执行 layout。'};
  }
  if(command==='image'){
    if(!options.input)core.fail('需要 --input');const buffer=fs.readFileSync(path.resolve(options.input));const crop=await require('./lib/images').cropBounds(buffer,options.crop);const next=require('./lib/images').insert(previous,buffer,options.kind||'photo',options.heading,file,{dryRun:options['dry-run'],position:options.position,crop});
    if(options['dry-run'])return {file,dryRun:true,revision:previous.revision,changes:preview(previous,next)};
    const saved=store.commit(file,next,options.expect||previous.revision);return {file,revision:saved.document.revision,backup:saved.backup};
  }
  if(command==='layout'){
    const result=await require('./lib/autolayout').layout(previous,{file,output:options.output,browserPath:options['browser-path']});
    if(options['dry-run']||!result.fits)return {file,...result,applied:false};
    const saved=store.commit(file,result.document,options.expect||previous.revision);return {file,revision:saved.document.revision,backup:saved.backup,report:result.report,applied:true};
  }
  if(['render','check','fit'].includes(command)) {
    const renderer=require('./lib/render.js');const output=options.output?options.output.replace(/\.(pdf|png)$/i,''):command==='render'?'output/preview':command==='fit'?'output/fitted':undefined;
    const renderOptions={file,output,browserPath:options['browser-path'],ui:options.ui,details:options.details};
    if(command!=='fit')return {file,...await renderer.render(previous,renderOptions)};
    if(options.expect && options.expect!==previous.revision)core.fail('文档已更新，请重新读取 revision','REVISION_CONFLICT');
    const result=await renderer.fit(previous,renderOptions);
    const changes=preview(previous,result.document);
    if(!result.fits){process.exitCode=2;return {file,fits:false,applied:false,message:result.message,report:result.report,attempts:result.attempts,changes,revision:previous.revision};}
    if(options['dry-run'])return {file,fits:true,applied:false,dryRun:true,message:result.message,report:result.report,attempts:result.attempts,changes,revision:previous.revision};
    const saved=store.commit(file,result.document,previous.revision);
    return {file,fits:true,applied:true,changed:saved.changed,revision:saved.document.revision,backup:saved.backup,message:result.message,report:result.report,attempts:result.attempts,changes};
  }
  if (command==='show') return {file,...previous,...(options.structured?{structure:structure.parse(previous.markdown)}:{}),inspection:{...core.inspect(previous.markdown),images:core.inspect(previous.markdown).images.map(image=>({...image,...(image.source?.startsWith('assets/')?{file:path.join(require('./lib/images').folder(file),path.basename(image.source))}:{})})),...(!options.lines?{lines:undefined}:{})},...(options.summary || options.lines || options.structured?{markdown:undefined}:{})};
  if (command==='export') {
    if (!options.output) core.fail('需要 --output');const output=path.resolve(options.output);if (output===file) core.fail('导出路径不能覆盖源文档');
    fs.mkdirSync(path.dirname(output),{recursive:true});
    let content;
    if (/\.md$/i.test(output)) content=previous.markdown;
    else if (/\.json$/i.test(output)) content=JSON.stringify(previous,null,2)+'\n';
    else if (/\.html$/i.test(output)) content=exportHTML(previous,output,file);
    else core.fail('导出支持 .md、.html、.json；PDF 请在编辑器或导出的 HTML 中打印');
    fs.writeFileSync(output,content,'utf8');return {file,output,format:path.extname(output).slice(1),revision:previous.revision};
  }
  let operations,templateReport;let expected=options.expect || previous.revision;
  if (command==='apply') {
    if (!options.patch) core.fail('apply 需要 --patch 文件或 -');const patch=jsonInput(options.patch);
    operations=Array.isArray(patch)?patch:patch.operations;expected=options.expect || patch.expectedRevision || previous.revision;
  } else if (command==='template') {
    const source=options.name==='bilingual'?await require('./lib/bilingual').convert(previous):previous;
    let next=require('./lib/templates').apply(source,options.name);
    if(!options['dry-run']&&!options['no-layout']){
      const arranged=await require('./lib/autolayout').layout(next,{file,output:options.output,browserPath:options['browser-path']});
      if(!arranged.fits)core.fail(arranged.message,'LAYOUT_FAILED');next=arranged.document;templateReport=arranged.report;
    }
    operations=[{op:'set-markdown',markdown:next.markdown},{op:'settings',values:next.settings}];
  }
  else if (command==='settings') operations=[{op:'settings',values:options.patch?jsonInput(options.patch):parseJSON(options.json || '')}];
  else if (command==='style') {
    const style={}; for (const key of ['size','rule','align','underline','level']) if (options[key]!==undefined) style[key]=['size','level'].includes(key)?Number(options[key]):options[key];
    for (const key of ['bold','italic']) {if(options[key]) style[key]=true; if(options['no-'+key]) style[key]=false;}
    if (!Object.keys(style).length) core.fail('需要至少一个样式参数');
    operations=[{op:'style',target:target(options),style,...(options.cell?{cell:Number(options.cell)}:{})}];
  } else if (command==='row') operations=[{op:'row',target:target(options),cells:parseJSON(options.cells || ''),widths:options.widths || '1:1:1'}];
  else if (command==='replace') operations=[{op:'replace',from:options['from-file']?fs.readFileSync(path.resolve(options['from-file']),'utf8'):options.from,to:options['to-file']?fs.readFileSync(path.resolve(options['to-file']),'utf8'):options.to,all:options.all || false,...(options.occurrence?{occurrence:Number(options.occurrence)}:{})}];
  else if (command==='normalize-spaces') operations=[{op:command}];
  else core.fail(`未知命令：${command}`);
  if (expected!==previous.revision) core.fail('文档已更新，请重新 show 后使用新的 revision','REVISION_CONFLICT');
  const next=core.apply(previous,operations);const changes=preview(previous,next);
  if (options['dry-run']) return {file,dryRun:true,revision:previous.revision,changes,...(options.full?{document:next}:{})};
  const result=store.commit(file,next,expected);
  return {file,changed:result.changed,revision:result.document.revision,settings:result.document.settings,backup:result.backup,changes,...(templateReport?{report:templateReport}:{}),...(options.full?{document:result.document}:{})};
}
if (require.main===module) main(process.argv.slice(2)).then(result=>{if(result!==undefined)process.stdout.write(JSON.stringify({ok:true,...result},null,2)+'\n');}).catch(error=>{process.stderr.write(JSON.stringify({ok:false,error:{code:error.code || 'CLI_ERROR',message:error.message,actualRevision:error.actualRevision,contentAudit:error.contentAudit}},null,2)+'\n');process.exitCode=1;});
module.exports={main,preview,exportHTML};

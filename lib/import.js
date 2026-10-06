'use strict';
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');const {pathToFileURL}=require('node:url');
const core=require('../resume-core');const store=require('./document-store');const templates=require('./templates');
const structure=require('../resume-structure');const recovery=require('./import-text');
const MAX_BYTES=25*1024*1024;
function resolveDependency(name){try{return require.resolve(name,{paths:[path.resolve(__dirname,'..'),path.resolve(path.dirname(process.execPath),'..'),...(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)]});}catch{core.fail('导入需要 '+name+'；请先运行 npm install。','IMPORT_DEPENDENCY');}}
function toMarkdown(text,options){return recovery.analyze(text,options).markdown;}
async function pdfText(buffer,{allowEmpty=false}={}){
 const pdfjs=await import(pathToFileURL(resolveDependency('pdfjs-dist/legacy/build/pdf.mjs')).href);
 const task=pdfjs.getDocument({data:new Uint8Array(buffer),useSystemFonts:true,isEvalSupported:false});let pdf;
 try{pdf=await task.promise;if(pdf.numPages>50)core.fail('PDF 超过 50 页，请上传简历文件。');const pages=[];const warnings=[];const imagePages=[];let images=[];const boldPhrases=[];
  for(let number=1;number<=pdf.numPages;number++){
   const page=await pdf.getPage(number);boldPhrases.push(...await require('./import-emphasis').pdfBold(page,pdfjs));const content=await page.getTextContent();const items=content.items.filter(i=>typeof i.str==='string'&&i.str.trim());
   if(number===1)try{const extracted=await require('./import-images').pdfPortrait(page,pdfjs);images=extracted.images;warnings.push(...extracted.imageWarnings);}catch{warnings.push('页头图片未能自动提取，请由 Agent 对照原稿补充。');}
   if(!items.length){imagePages.push(number);warnings.push('第 '+number+' 页没有可提取文字（可能是扫描图片），该页需由 agent 识别补充。');pages.push('');continue;}
   const rows=[];
   for(const item of items.sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
    let row=rows.find(r=>Math.abs(r.y-item.transform[5])<Math.max(2,Math.min(item.height||10,r.height)*0.3));
    if(!row){row={y:item.transform[5],height:item.height||10,items:[]};rows.push(row);}row.items.push(item);
   }
   pages.push(rows.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.transform[4]-b.transform[4]).map((item,i,all)=>{
    const previous=all[i-1];const gap=previous?item.transform[4]-(previous.transform[4]+previous.width):0;
    return (gap>Math.max(2,(item.height||10)*0.25)?' ':'')+item.str;
   }).join('')).join('\n'));
  }
  const text=pages.join('\n\n').replace(/[\u2f00-\u2fd5]/g,c=>c.normalize('NFKC'));if(!text.trim()&&!allowEmpty)core.fail('这个 PDF 没有可提取的文字，可能是扫描件。请在 Codex 中上传，让 Agent 识别后导入。','NO_TEXT');
  warnings.push('PDF 已按页面位置提取文字；双栏、图标、链接与跨行内容请由 agent 对照原文件核对。');return {text,warnings,pages:pdf.numPages,imagePages,images,boldPhrases};
 }finally{if(pdf)await pdf.loadingTask.destroy();else await task.destroy();}
}
async function docxText(buffer){
 const JSZip=require(resolveDependency('jszip'));const zip=await JSZip.loadAsync(buffer);const entry=zip.file('word/document.xml');
 if(!entry)core.fail('Word 文件缺少正文。');if(entry._data?.uncompressedSize>10*1024*1024)core.fail('Word 正文过大。');
 const xml=await entry.async('string');const decode=s=>s.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
 const paragraphs=[...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map(match=>[...match[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:(tab|br)\b[^>]*\/?\s*>/g)].map(token=>token[2]?(token[2]==='tab'?'    ':'\n'):decode(token[1])).join(''));
 const extracted=await require('./import-images').docxPortrait(zip,xml);
 return {text:paragraphs.join('\n\n'),images:extracted.images,warnings:[...extracted.imageWarnings,'Word 表格已按文档顺序提取；页眉、页脚、图片与文本框内容请由 agent 对照原文件核对。']};
}
async function prepare(buffer,fileName,templateId='preserve',options={}){
 if(buffer.length>MAX_BYTES)core.fail('文件不能超过 25MB。');const ext=path.extname(fileName).toLowerCase();let parsed;let document;
 if(ext==='.pdf')parsed=await pdfText(buffer,{allowEmpty:options.allowEmpty||Boolean(options.structure)});
 else if(ext==='.docx')parsed=await docxText(buffer);
 else if(['.md','.txt','.json'].includes(ext)){
  const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/^\uFEFF/,'');
  if(ext==='.json'){let input;try{input=JSON.parse(text);}catch{core.fail('无效的项目 JSON。');}document=core.document(input);parsed={text:document.markdown,warnings:[]};}
  else{parsed={text,warnings:[]};if(ext==='.md')document=core.document({markdown:text});}
 }else core.fail('支持 PDF、DOCX、Markdown、TXT 和项目 JSON。');
 if(!parsed.text.trim()&&!options.allowEmpty&&!options.structure)core.fail('文件中没有可导入的文字。','NO_TEXT');
 const recovered=recovery.analyze(parsed.text,{format:ext==='.docx'?'docx':'text'});
 let audit;
 if(options.structure){
  const normalized=structure.validate(options.structure);
  audit=contentAudit(parsed.text,normalized,{allowAdditional:Boolean(parsed.imagePages?.length)});
  if(!audit.preserved){const error=new Error('整理结果遗漏或新增了原文内容，请根据 contentAudit 重新核对；先运行 intake 查看原文。');error.code='CONTENT_MISMATCH';error.contentAudit=audit;throw error;}
  document=core.document({markdown:structure.serialize(normalized)});
 }
 document=document||core.document({markdown:recovered.markdown});
 if(!options.structure&&parsed.boldPhrases?.length)document=core.document({...document,markdown:require('./import-emphasis').restore(document.markdown,parsed.boldPhrases)});
 document=require('./import-images').attach(document,parsed.images);
 if(templateId==='bilingual')document=await require('./bilingual').convert(document);
 document=templates.apply(document,templateId);core.validateMarkdown(document.markdown);
 return {document,structure:structure.parse(document.markdown),text:parsed.text,images:parsed.images||[],warnings:[...parsed.warnings,...recovered.warnings],joinedLines:recovered.joinedLines,pages:parsed.pages,imagePages:parsed.imagePages,template:templateId,fileName:path.basename(fileName),...(audit?{contentAudit:audit}:{}),needsVision:(!parsed.text.trim()||Boolean(parsed.imagePages?.length))&&!options.structure};
}
function contentAudit(source,organized,{allowAdditional=false}={}){
 const clean=text=>text.split('\n').map(line=>line.replace(/^#+\s*/,'').replace(/\*\*/g,'').replace(/^\d+[.)、]\s+/,'').replace(/\s+\{(?:size|align|rule|underline)=[^{}]*\}\s*$/,''))
  .filter(line=>!/^:::/.test(line)&&!recovery.heading(line)).join('\n').replace(/!\[[^\]]*\]\([^)]+\)/g,'').replace(/\\([_*[\]#>|])/g,'$1').normalize('NFKC');
 const counts=text=>{const result=new Map();for(const char of clean(text).replace(/[^\p{L}\p{N}]/gu,'').toLowerCase())result.set(char,(result.get(char)||0)+1);return result;};
 const before=counts(source),after=counts(structure.text(organized));
 // Markdown layout directives and emphasis are syntax, not source content.
 const missing=[],added=[];
 for(const [char,count] of before)if((after.get(char)||0)<count)missing.push({character:char,count:count-(after.get(char)||0)});
 for(const [char,count] of after)if((before.get(char)||0)<count)added.push({character:char,count:count-(before.get(char)||0)});
 const numbers=text=>(clean(text).match(/\d+(?:[.,]\d+)*/g)||[]).sort();
 const beforeNumbers=numbers(source),afterNumbers=numbers(structure.text(organized));
 const remaining=[...afterNumbers];
 const numbersPreserved=beforeNumbers.every(number=>{const at=remaining.indexOf(number);if(at<0)return false;remaining.splice(at,1);return true;})&&(allowAdditional||!remaining.length);
 const checked=Boolean(source.trim());
 return {preserved:!checked||(!missing.length&&(allowAdditional||!added.length)&&numbersPreserved),missing,added,numbersPreserved,checked,partialSource:allowAdditional,method:'character-and-number-coverage; semantic review remains with the host agent'};
}
function commit(file,prepared,buffer,expectedRevision){
 const previous=fs.existsSync(file)?store.load(file):null;
 if((previous?.revision||null)!==expectedRevision)core.fail('文档已更新，请重新导入。','REVISION_CONFLICT');
 require('./import-images').persist(prepared.images,file);
 const folder=path.join(path.dirname(path.resolve(file)),'.paper-imports',randomUUID());fs.mkdirSync(folder,{recursive:true});
 const source=path.join(folder,'source'+path.extname(prepared.fileName).toLowerCase());fs.writeFileSync(source,buffer,{flag:'wx'});fs.writeFileSync(path.join(folder,'extracted.txt'),prepared.text,'utf8');
 const saved=store.commit(file,prepared.document,expectedRevision);
 return {...saved,source,warnings:prepared.warnings,template:prepared.template,pages:prepared.pages};
}
module.exports={prepare,commit,toMarkdown,pdfText,contentAudit,MAX_BYTES};

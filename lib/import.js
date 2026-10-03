'use strict';
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');const {pathToFileURL}=require('node:url');
const core=require('../resume-core');const store=require('./document-store');const templates=require('./templates');
const MAX_BYTES=25*1024*1024;
function resolveDependency(name){try{return require.resolve(name,{paths:[path.resolve(__dirname,'..'),path.resolve(path.dirname(process.execPath),'..'),...(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)]});}catch{core.fail('导入需要 '+name+'；请先运行 npm install。','IMPORT_DEPENDENCY');}}
function literal(text){return text.replace(/([\\`*_\[\]#>|])/g,'\\$1');}
function toMarkdown(text){
 const lines=text.replace(/\r\n?/g,'\n').split('\n');const output=[];let nameSeen=false;
 const sections=/^(?:个人(?:信息|简介|总结|项目|优势|技能)|基本信息|联系方式|工作(?:经历|经验)|实习经历|项目(?:经历|经验)|教育(?:经历|背景)|专业技能|技术(?:能力|技能)|技能(?:清单|特长)|荣誉(?:奖项)?|获奖(?:经历)?|论文(?:发表)?|自我评价|社会实践|校园经历|科研经历|学术论文|Research(?: Experience)?|Education|Experience|Work Experience|Internships|Projects|Skills|Publications|Awards)$/i;
 const date=/^(.*?)\s+((?:19|20)\d{2}[.\/年-]\d{1,2}(?:月)?\s*(?:[-–—~至])\s*(?:(?:19|20)\d{2}[.\/年-]\d{1,2}(?:月)?|至今|现在|Present))\s*$/i;
 for(const raw of lines){
  const line=raw.trim();if(!line){if(output.length&&output.at(-1)!=='')output.push('');continue;}
  if(!nameSeen){nameSeen=true;if(line.length<=16&&!sections.test(line)&&!/[\d@：:]/.test(line)){output.push('::: center','# '+literal(line),':::','');continue;}}
  if(sections.test(line.replace(/[：:]$/,''))){output.push('','## '+literal(line.replace(/[：:]$/,'')),'');continue;}
  const dated=date.exec(line);
  if(dated&&dated[1].trim()){output.push('::: row',literal(dated[1].trim())+' || '+literal(dated[2]),':::');continue;}
  if(line.length<=45 && /(?:公司|集团|大学|学院|科技|研究院)(?:[（(][^）)]*[）)])?$/.test(line)){output.push('','### **'+literal(line)+'**');continue;}
  if(/^[•●▪\uF0B7]\s*/.test(line)){output.push('- '+literal(line.replace(/^[•●▪\uF0B7]\s*/,'')));continue;}
  output.push(literal(line));
 }
 return output.join('\n').trim()+'\n';
}
async function pdfText(buffer){
 const pdfjs=await import(pathToFileURL(resolveDependency('pdfjs-dist/legacy/build/pdf.mjs')).href);
 const task=pdfjs.getDocument({data:new Uint8Array(buffer),useSystemFonts:true,isEvalSupported:false});let pdf;
 try{pdf=await task.promise;if(pdf.numPages>50)core.fail('PDF 超过 50 页，请上传简历文件。');const pages=[];const warnings=[];
  for(let number=1;number<=pdf.numPages;number++){
   const page=await pdf.getPage(number);const content=await page.getTextContent();const items=content.items.filter(i=>typeof i.str==='string'&&i.str.trim());
   if(!items.length){warnings.push('第 '+number+' 页没有可提取文字（可能是扫描图片），该页需由 agent 识别补充。');pages.push('');continue;}
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
  const text=pages.join('\n\n').replace(/[\u2f00-\u2fd5]/g,c=>c.normalize('NFKC'));if(!text.trim())core.fail('这个 PDF 没有可提取的文字，可能是扫描件。请交给宿主 agent 识别，或上传含文字的 PDF / Word。','NO_TEXT');
  warnings.push('PDF 已按页面位置提取文字；双栏、图标、链接与跨行内容请由 agent 对照原文件核对。');return {text,warnings,pages:pdf.numPages};
 }finally{if(pdf)await pdf.destroy();else await task.destroy();}
}
async function docxText(buffer){
 const JSZip=require(resolveDependency('jszip'));const zip=await JSZip.loadAsync(buffer);const entry=zip.file('word/document.xml');
 if(!entry)core.fail('Word 文件缺少正文。');if(entry._data?.uncompressedSize>10*1024*1024)core.fail('Word 正文过大。');
 const xml=await entry.async('string');const decode=s=>s.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
 const paragraphs=[...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map(match=>[...match[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:(tab|br)\b[^>]*\/?\s*>/g)].map(token=>token[2]?(token[2]==='tab'?'    ':'\n'):decode(token[1])).join(''));
 return {text:paragraphs.join('\n'),warnings:['Word 表格已按文档顺序提取；页眉、页脚、图片与文本框内容请由 agent 对照原文件核对。']};
}
async function prepare(buffer,fileName,templateId='preserve'){
 if(buffer.length>MAX_BYTES)core.fail('文件不能超过 25MB。');const ext=path.extname(fileName).toLowerCase();let parsed;let document;
 if(ext==='.pdf')parsed=await pdfText(buffer);
 else if(ext==='.docx')parsed=await docxText(buffer);
 else if(['.md','.txt','.json'].includes(ext)){
  const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/^\uFEFF/,'');
  if(ext==='.json'){let input;try{input=JSON.parse(text);}catch{core.fail('无效的项目 JSON。');}document=core.document(input);parsed={text:document.markdown,warnings:[]};}
  else{parsed={text,warnings:[]};if(ext==='.md')document=core.document({markdown:text});}
 }else core.fail('支持 PDF、DOCX、Markdown、TXT 和项目 JSON。');
 if(!parsed.text.trim())core.fail('文件中没有可导入的文字。','NO_TEXT');
 document=document||core.document({markdown:toMarkdown(parsed.text)});if(templateId==='bilingual')document=await require('./bilingual').convert(document);else document=templates.apply(document,templateId);core.validateMarkdown(document.markdown);
 return {document,text:parsed.text,warnings:parsed.warnings,pages:parsed.pages,template:templateId,fileName:path.basename(fileName)};
}
function commit(file,prepared,buffer,expectedRevision){
 const previous=fs.existsSync(file)?store.load(file):null;
 if((previous?.revision||null)!==expectedRevision)core.fail('文档已更新，请重新导入。','REVISION_CONFLICT');
 const folder=path.join(path.dirname(path.resolve(file)),'.paper-imports',randomUUID());fs.mkdirSync(folder,{recursive:true});
 const source=path.join(folder,'source'+path.extname(prepared.fileName).toLowerCase());fs.writeFileSync(source,buffer,{flag:'wx'});fs.writeFileSync(path.join(folder,'extracted.txt'),prepared.text,'utf8');
 const saved=store.commit(file,prepared.document,expectedRevision);
 return {...saved,source,warnings:prepared.warnings,template:prepared.template,pages:prepared.pages};
}
module.exports={prepare,commit,toMarkdown,pdfText,MAX_BYTES};

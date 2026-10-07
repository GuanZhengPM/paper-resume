'use strict';
const fs=require('node:fs');const path=require('node:path');const core=require('../resume-core');
const structure=require('../resume-structure');const profiles=require('../template-profiles');
const templates=[
 {id:'projects',name:'工作与项目',description:'工作经历、个人项目、教育、技能',file:'templates/projects.md'},
 {id:'internship',name:'实习与校园',description:'实习 · 校园 · 证件照',file:'templates/internship.md'},
 {id:'research',gallery:false,name:'科研与论文',description:'教育、科研、论文、项目、技能',file:'templates/research.md'},
 {id:'bilingual',name:'中英双语',description:'中文 · 英文独立排版',file:'templates/bilingual.md'},
 {id:'academic',name:'科研与论文',description:'英文论文 · 科研 · 开源项目',file:'templates/academic.md'}
];
function sample(id){const template=templates.find(t=>t.id===id);if(!template)core.fail('未知模板：'+id);return fs.readFileSync(path.join(__dirname,'..',template.file),'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');}
function clearPageHints(markdown){
 const stack=[];let fence=null;
 return markdown.split('\n').filter(line=>{
  if(/^```|^~~~/.test(line)){fence=fence?null:line.slice(0,3);return true;}if(fence)return true;
  const open=/^::: (keep|row|center|left|right)(?:\s|$)/.exec(line);
  if(open){stack.push(open[1]);return open[1]!=='keep';}
  if(/^:::\s*$/.test(line))return stack.pop()!=='keep';
  return !/^::: page-spacing /.test(line);
 }).join('\n');
}
function alignHeader(header){
 const pictures=[],lines=[];let alignment=false;
 for(const line of header.split('\n')){
  if(/^!\[/.test(line)){pictures.push(line);continue;}
  if(/^::: (center|left|right)\s*$/.test(line)){alignment=true;continue;}
  if(alignment&&/^:::\s*$/.test(line)){alignment=false;continue;}
  if(line.trim())lines.push(line);
 }
 // Leave complex custom header blocks intact; center normal name/contact headers as a unit.
 if(lines.some(line=>/^:::|^```|^~~~/.test(line)))return header;
 return [...pictures,...(lines.length?['::: center',...lines,':::']:[])].join('\n');
}
function apply(input,id){
 const original=core.document(input);if(id==='preserve')return original;
 const profile=profiles[id];if(!profile)core.fail('未知模板：'+id);
 const source=clearPageHints(original.markdown.trim()?original.markdown:sample(id));
 // Explicit page boundaries retain their language/content grouping.
 const markdown=source.split(/^::: page[ \t]*$/m).map(part=>{
  const data=structure.parse(part);data.header=alignHeader(data.header);
  return structure.serialize(data,{profile,reorder:true,compactParagraphs:true,omitEmpty:Boolean(original.markdown.trim())});
 }).join('\n::: page\n\n');
 return core.document({...original,markdown,settings:{...original.settings,...profile.settings,templateId:id}});
}
module.exports={templates,apply,sample,profiles};

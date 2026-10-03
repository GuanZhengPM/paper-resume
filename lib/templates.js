'use strict';
const fs=require('node:fs');const path=require('node:path');const core=require('../resume-core');
const templates=[
 {id:'projects',name:'工作与项目',description:'工作经历、个人项目、教育、技能',file:'templates/projects.md'},
 {id:'internship',name:'实习与校园',description:'实习 · 校园 · 证件照',file:'templates/internship.md'},
 {id:'research',gallery:false,name:'科研与论文',description:'教育、科研、论文、项目、技能',file:'templates/research.md'},
 {id:'bilingual',name:'中英双语',description:'中文一页 · 英文一页',file:'templates/bilingual.md'},
 {id:'academic',name:'科研与论文',description:'英文论文 · 科研 · 开源项目',file:'templates/academic.md'}
];
const aliases=[['工作经历','工作经验','Experience','Work Experience'],['个人项目','项目经历','项目经验','Projects','Personal Projects'],['教育经历','教育背景','Education'],['专业技能','技术技能','技能清单','Skills'],['实习经历','Internships','Internship Experience'],['校园经历','校园活动','Campus Experience'],['科研经历','Research','Research Experience'],['论文发表','论文','学术论文','Publications']];
function sample(id){const template=templates.find(t=>t.id===id);if(!template)core.fail('未知模板：'+id);return fs.readFileSync(path.join(__dirname,'..',template.file),'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');}
function apply(input,id){const original=core.document(input);if(id==='preserve')return original;const markdown=sample(id);
 if(!original.markdown.trim())return core.document({...original,markdown});
 // Keep the imported Markdown verbatim; append only absent example headings, without a block model or reordering.
 const present=core.inspect(original.markdown).headings.map(h=>h.title.toLowerCase());const missing=core.inspect(markdown).headings.filter(h=>h.level===2&&!present.some(title=>{const group=aliases.find(a=>a.some(x=>x.toLowerCase()===h.title.toLowerCase()))||[h.title];return group.some(x=>x.toLowerCase()===title);}));
 return core.document({...original,markdown:original.markdown+(missing.length?'\n\n'+missing.map(h=>'## '+h.title).join('\n\n')+'\n':'')});
}
module.exports={templates,apply,sample};

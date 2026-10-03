const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
const core=require('../resume-core');const store=require('../lib/document-store');
const source='::: center\n## 姓名 {size=14 rule=off}\n:::\n\n### **工作经历** {rule=on}\n\n#### **公司**\n::: row 1:2:1\n公司 || 部门    岗位 || 2024.01 - 至今\n:::\n- 使用 GUI Agent 支持 100 人\n';
test('settings validate limits and booleans',()=>{
  assert.equal(core.normalizeSettings({fontSize:10.5,experienceInner:0}).fontSize,'10.5');
  assert.throws(()=>core.normalizeSettings({marginHorizontal:4}));
  assert.throws(()=>core.normalizeSettings({showGuides:'false'}));
  assert.throws(()=>core.normalizeSettings({unexpected:1}));
});
test('style changes keep heading emphasis, date and meaningful spaces',()=>{
  const doc=core.apply({markdown:source},[{op:'style',target:{heading:'工作经历'},style:{level:3,bold:true,size:12}},{op:'style',target:{row:1},cell:2,style:{align:'left'}}]);
  assert.match(doc.markdown,/### \*\*工作经历\*\* \{size=12 rule=on\}/);
  assert.match(doc.markdown,/部门    岗位 \{align=left\} \|\| 2024\.01 - 至今/);
});
test('ambiguous replacements and targets are rejected',()=>{
  assert.throws(()=>core.apply({markdown:'## 工作\n## 工作'},[{op:'style',target:{heading:'工作'},style:{bold:true}}]),{code:'AMBIGUOUS_TARGET'});
  assert.throws(()=>core.apply({markdown:'重复 重复'},[{op:'replace',from:'重复',to:'新'}]),{code:'AMBIGUOUS_TARGET'});
  assert.equal(core.apply({markdown:'重复 重复'},[{op:'replace',from:'重复',to:'新',occurrence:2}]).markdown,'重复 新');
});
test('row conversion accepts empty date and preserves width syntax',()=>{
  const doc=core.apply({markdown:source},[{op:'row',target:{row:1},cells:['**公司**','部门 岗位',''],widths:'1:2:1'}]);
  assert.match(doc.markdown,/::: row 1:2:1\n\*\*公司\*\* \|\| 部门 岗位 \|\| \n:::/);
  assert.throws(()=>core.apply(doc,[{op:'row',target:{row:1},cells:['a','b'],widths:'1:0:1'}]));
});
test('space cleanup preserves syntax, links, code and row spacing',()=>{
  const value=source+'\n这里使用 Agent 支持 20 位用户\n`代码 1`\n[中文 链接](https://example.com/a)\n中文    对齐';
  const clean=core.cleanSpaces(value);
  assert.match(clean,/这里使用Agent支持20位用户/);
  assert.match(clean,/GUI Agent支持100人/);
  assert.match(clean,/部门    岗位/);
  assert.match(clean,/中文    对齐/);
  assert.match(clean,/`代码 1`/);
  assert.match(clean,/\[中文 链接\]\(https:\/\/example.com\/a\)/);
});
test('revision conflict prevents overwrite and invalid batch leaves file intact',()=>{
  const directory=path.resolve(__dirname,'../tmp/tests',randomUUID());fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'doc.paper.json');
  const first=store.commit(file,{markdown:source},null);
  const next=core.apply(first.document,[{op:'settings',values:{fontSize:10}}]);
  const second=store.commit(file,next,first.document.revision);
  assert.ok(fs.existsSync(second.backup));
  assert.throws(()=>store.commit(file,{markdown:'旧内容'},first.document.revision),{code:'REVISION_CONFLICT'});
  assert.throws(()=>core.apply(second.document,[{op:'replace',from:'公司',to:'新',all:true},{op:'style',target:{line:1},style:{size:7}}]));
  assert.equal(store.load(file).revision,second.document.revision);
});
test('fit candidates preserve text, respect lower bounds and remove manual pagination',()=>{
  const doc={markdown:source+'\n::: page\n\n\n## 项目\n说明',settings:{fontSize:12,marginVertical:20}};
  const candidates=core.fitCandidates(doc);const last=candidates.at(-1);
  assert.equal(candidates.length,6);assert.equal(last.settings.fontSize,'9');assert.equal(last.settings.marginVertical,'6');
  assert.equal(last.settings.marginHorizontal,'8');assert.doesNotMatch(last.markdown,/::: page/);
  assert.match(last.markdown,/部门    岗位/);assert.match(last.markdown,/使用 GUI Agent 支持 100 人/);
  assert.match(last.markdown,/姓名/);core.validateMarkdown(last.markdown);
});

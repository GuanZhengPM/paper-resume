const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
const structure=require('../resume-structure');const templates=require('../lib/templates');const importer=require('../lib/import');const core=require('../resume-core');const store=require('../lib/document-store');const {main}=require('../cli');

const source='示例姓名\n邮箱：person@example.com\n工作经历\n示例公司  产品经理  2023.01 - 至今\n· 数据分析：负责100项项目，\n完成指标核对与复盘。\n· Built a know-\nledge base for 12 teams.\n教育背景\n示例大学  本科  2019.09 - 2023.06\n完成课程学习。\n个人技能与评价\n· 熟悉SQL与Python。';

test('organization, role, location and dates remain distinct across repeated template changes',()=>{
 const input={version:1,header:'# Example',sections:[{title:'Experience',blocks:[{kind:'entry',title:'Company',subtitle:'Manager',location:'Shanghai',date:'2024.01 - Present',blocks:[{kind:'list',items:['Delivered 100 projects']}]}]}]};
 let markdown=structure.serialize(input,{profile:templates.profiles.projects});
 for(const name of ['projects','internship','projects']){
  markdown=templates.apply({markdown},name).markdown;const entry=structure.parse(markdown).sections[0].blocks[0];assert.equal(structure.plain(entry.title),'Company');assert.equal(entry.subtitle,'Manager');assert.equal(entry.location,'Shanghai');assert.equal(entry.date,'2024.01 - Present');
 }
});

test('entry heading styles remain outside emphasis when applying templates',()=>{
 for(const heading of ['### Company {size=14 rule=off}','### Company · Manager | 2024.01 - Present {size=14 rule=off}']){
  const draft=templates.apply({markdown:'# Name\n\n## Experience\n'+heading+'\n- Work'},'internship');
  assert.match(draft.markdown,/### \*\*Company\*\* \{size=14 rule=off\}/);assert.equal(structure.parse(draft.markdown).sections[0].blocks[0].headingStyle,'{size=14 rule=off}');
 }
});

test('import restores paragraphs and bullet boundaries and maps dates, organizations and roles',async()=>{
 const p=await importer.prepare(Buffer.from(source),'resume.txt','internship');
 assert.equal(p.joinedLines,2);assert.deepEqual(p.structure.sections.map(s=>s.type),['education','work','evaluation']);
 const job=p.structure.sections[1].blocks[0];assert.equal(structure.plain(job.title),'示例公司');assert.equal(job.subtitle,'产品经理');assert.equal(job.date,'2023.01 - 至今');
 assert.deepEqual(job.blocks[0].items,['**数据分析**：负责100项项目，完成指标核对与复盘。','Built a knowledge base for 12 teams.']);
 assert.equal(importer.contentAudit(source,p.structure).preserved,true);
});

test('switching templates changes real section order and layout without adding fake sections or losing custom blocks',()=>{
 const input=core.document({markdown:'# Example\n\n## 教育背景\n### University | 2019.09 - 2023.06\n- Degree\n\n## 工作经历\n### Company · Manager | 2023.07 - Present\n- Delivered 100 projects\n\n## 我的作品\n[Portfolio](https://example.com)\n\n```text\n## literal heading\n::: keep\n```\n',settings:{fontSize:14,fontFamily:'times'}});
 const work=templates.apply(input,'projects');assert.ok(work.markdown.indexOf('## 工作经历')<work.markdown.indexOf('## 教育背景'));assert.equal(work.settings.fontSize,'10.5');assert.equal(work.settings.templateId,'projects');assert.doesNotMatch(work.markdown,/## 个人项目/);assert.match(work.markdown,/## 我的作品/);assert.match(work.markdown,/```text\n## literal heading\n::: keep\n```/);
 const intern=templates.apply(work,'internship');assert.ok(intern.markdown.indexOf('## 教育背景')<intern.markdown.indexOf('## 工作经历'));assert.equal(intern.settings.fontFamily,'sans');assert.match(intern.markdown,/Manager \|\| 2023.07 - Present/);
 for(const doc of [work,intern,templates.apply(intern,'projects')])assert.equal(importer.contentAudit(input.markdown,structure.parse(doc.markdown)).preserved,true);
});

test('structured edits see manual changes, preserve custom styles and keep blocks, and reject stale revisions',async()=>{
 const folder=path.resolve('tmp/tests',randomUUID());const file=path.join(folder,'resume.paper.json');
 const first=store.commit(file,templates.apply({markdown:'# Example\n\n## 工作经历 {size=13}\n### Company | 2024.01 - Present\n- Delivered 100 projects\n\n## 自我评价\n::: keep\nManual content\n:::\n'},'projects'),null).document;
 const manual=store.commit(file,{...first,markdown:first.markdown.replace('Manual content','::: keep\nManual revision\n:::')},first.revision).document;
 const read=await main(['show','--file',file,'--structured']);assert.equal(read.revision,manual.revision);const block=read.structure.sections[0].blocks[0].blocks[0];assert.equal(block.items[0],'Delivered 100 projects');
 const patch=path.join(folder,'edit.json');fs.writeFileSync(patch,JSON.stringify({expectedRevision:manual.revision,operations:[{op:'edit-block',id:block.id,values:{items:['Delivered 120 projects']}}]}));
 await main(['apply','--file',file,'--patch',patch]);const changed=store.load(file);assert.match(changed.markdown,/Delivered 120 projects/);assert.match(changed.markdown,/Manual revision/);assert.match(changed.markdown,/\{size=13\}/);assert.match(changed.markdown,/::: keep/);assert.deepEqual(changed.settings,manual.settings);
 await assert.rejects(main(['apply','--file',file,'--patch',patch]),{code:'REVISION_CONFLICT'});
});

test('coverage rejects deletions, additions and changed numbers; scanned source requires visual review',async()=>{
 const p=await importer.prepare(Buffer.from(source),'resume.txt','projects');const good=p.structure;assert.equal(importer.contentAudit(source,good).preserved,true);
 for(const replacement of ['负责','负责001项项目','负责100项项目和额外荣誉']){
  const bad=JSON.parse(JSON.stringify(good));bad.sections[0].blocks[0].blocks[0].items[0]=replacement;
  await assert.rejects(importer.prepare(Buffer.from(source),'resume.txt','projects',{structure:bad}),error=>error.code==='CONTENT_MISMATCH'&&error.contentAudit.preserved===false);
 }
 const {PDFDocument,StandardFonts}=require('../lib/render').dependency('pdf-lib');const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('Example Name',{x:30,y:700,font});pdf.addPage();const bytes=Buffer.from(await pdf.save());
 const extracted=await importer.prepare(bytes,'mixed.pdf','projects',{allowEmpty:true});assert.equal(extracted.needsVision,true);assert.deepEqual(extracted.imagePages,[2]);await assert.rejects(require('../lib/ingest').arrange(extracted,{file:'tmp/resume.paper.json'}),{code:'VISION_REQUIRED'});
 const reviewed={version:1,header:'# Example Name',sections:[{title:'Experience',blocks:[{kind:'paragraph',text:'Transcribed 100 projects'}]}]};
 const ready=await importer.prepare(bytes,'mixed.pdf','projects',{structure:reviewed});assert.equal(ready.needsVision,false);assert.equal(ready.contentAudit.partialSource,true);assert.equal(ready.contentAudit.preserved,true);
});

test('CLI intake and new structured import preserve existing documents and produce a checked multi-page PDF',{timeout:60000},async()=>{
 const folder=path.resolve('tmp/tests',randomUUID());const file=path.join(folder,'resume.paper.json');const original=store.commit(file,{markdown:'# Existing resume'},null).document;
 const input=path.join(folder,'source.txt');const text='Example Name\nExperience\nExample Company 2024.01 - Present\n'+Array.from({length:85},(_,i)=>'· Delivered project '+(i+1)+' with research, implementation and verification.').join('\n');fs.writeFileSync(input,text);
 const intake=await main(['intake','--input',input]);const structured=path.join(folder,'structure.json');fs.writeFileSync(structured,JSON.stringify(intake.structure));
 const result=await main(['import','--file',file,'--new','--input',input,'--structure',structured,'--template','projects','--output',path.join(folder,'imported')]);
 assert.ok(result.id);assert.equal(store.load(file).revision,original.revision);assert.equal(result.contentAudit.preserved,true);assert.ok(result.report.actualPages>1);assert.deepEqual(result.report.overflow,[]);assert.ok(fs.existsSync(result.source));assert.ok(fs.existsSync(result.report.artifacts.pdf));assert.equal(store.load(result.file).settings.fontSize,'10.5');
 const extracted=await importer.pdfText(fs.readFileSync(result.report.artifacts.pdf));assert.match(extracted.text,/project 85/);assert.match(extracted.text,/project 1 /);
});

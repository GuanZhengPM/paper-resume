const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');const importer=require('../lib/import'),templates=require('../lib/templates'),structure=require('../resume-structure'),renderer=require('../lib/render');
const markdown='# Example Name\n\n电话：10000000000 邮箱：person@example.com 微信号：example\n\n## 个人总结\n\n第一段总结。\n\n第二段总结。\n\n## 实习经历\n### Company | 2024.01 - Present\n- Delivered 100 projects\n\n## 自我评价\n保留我的评价\n\n## 志愿服务\n社区服务20小时';
test('templates center all header text, avoid generated paragraph gaps, and retain non-template sections',()=>{
 const document=templates.apply({markdown},'projects'),data=structure.parse(document.markdown);
 assert.match(data.header,/::: center\n# Example Name\n电话：[\s\S]*微信号：example\n:::/);
 assert.match(document.markdown,/第一段总结。\n第二段总结。/);assert.doesNotMatch(document.markdown,/## 个人项目|## 专业技能|## 工作经历/);
 assert.deepEqual(data.sections.map(s=>s.title),['个人总结','实习经历','自我评价','志愿服务']);
 const html=require('../resume-renderer').create(require('../vendor/marked'),require('../text-style')).parse(document.markdown);
 assert.doesNotMatch(html,/class="layout-gap"/);assert.equal(importer.contentAudit(markdown,data).preserved,true);
});
async function photo(){const {createCanvas}=renderer.dependency('@napi-rs/canvas');const c=createCanvas(100,140),ctx=c.getContext('2d');ctx.fillStyle='#263c59';ctx.fillRect(0,0,100,140);return c.toBuffer('image/png');}
test('PDF imports preserve a corner portrait, exclude decorative lines, and render the asset',{timeout:40000},async()=>{
 const {PDFDocument,StandardFonts}=renderer.dependency('pdf-lib'),pdf=await PDFDocument.create(),page=pdf.addPage([595,842]);const font=await pdf.embedFont(StandardFonts.Helvetica);
 ['Example Name','Email: person@example.com','Experience','Company 2024.01 - Present','Delivered 100 projects'].forEach((line,i)=>page.drawText(line,{x:40,y:800-i*30,size:12,font}));const embedded=await pdf.embedPng(await photo());page.drawImage(embedded,{x:490,y:727,width:70,height:98});
 const prepared=await importer.prepare(Buffer.from(await pdf.save()),'source.pdf','projects');assert.equal(prepared.images.length,1);assert.equal(prepared.images[0].position,'right');assert.ok(Math.abs(Number(prepared.document.settings.photoHeight)-98*25.4/72)<.01);assert.match(prepared.document.markdown,/!\[证件照\]\(assets\//);assert.doesNotMatch(JSON.stringify(prepared),/"buffer"/);
 const folder=path.resolve('tmp/tests',randomUUID()),file=path.join(folder,'resume.paper.json');const result=await require('../lib/ingest').arrange(prepared,{file,output:path.join(folder,'preview')});assert.ok(fs.existsSync(path.join(folder,'.paper-assets',prepared.images[0].name)));assert.deepEqual(result.report.overflow,[]);assert.equal(result.pagination.increased,false);
 const extracted=await importer.pdfText(fs.readFileSync(result.report.artifacts.pdf));assert.match(extracted.text,/100 projects/);
});
test('Word imports retain a header portrait and the original text',async()=>{
 const JSZip=renderer.dependency('jszip'),zip=new JSZip();zip.file('word/media/photo.png',await photo());zip.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="rId1" Target="media/photo.png"/></Relationships>');
 zip.file('word/document.xml','<w:document><w:body><w:p><w:r><w:t>示例姓名</w:t><w:drawing><wp:anchor><wp:extent cx="720000" cy="1008000"/><a:blip r:embed="rId1"/></wp:anchor></w:drawing></w:r></w:p><w:p><w:r><w:t>工作经历</w:t></w:r></w:p><w:p><w:r><w:t>完成100个项目</w:t></w:r></w:p></w:body></w:document>');
 const result=await importer.prepare(await zip.generateAsync({type:'nodebuffer'}),'resume.docx','projects');assert.equal(result.images.length,1);assert.ok(Math.abs(Number(result.document.settings.photoHeight)-1008000/36000)<.01);assert.match(result.document.markdown,/!\[证件照\]/);assert.match(result.document.markdown,/完成100个项目/);
});

test('import reports page growth instead of treating no overflow as complete layout quality',{timeout:40000},async()=>{
 const {PDFDocument,StandardFonts}=renderer.dependency('pdf-lib'),pdf=await PDFDocument.create(),page=pdf.addPage([595,842]),font=await pdf.embedFont(StandardFonts.Helvetica);
 const lines=['Example Name','Experience','Company 2024.01 - Present',...Array.from({length:85},(_,i)=>'- Delivered project '+(i+1)+' with research and verification.')];
 lines.forEach((line,i)=>page.drawText(line,{x:30,y:810-i*8,size:6,font}));
 const prepared=await importer.prepare(Buffer.from(await pdf.save()),'small-type.pdf','projects');const folder=path.resolve('tmp/tests',randomUUID());const result=await require('../lib/ingest').arrange(prepared,{file:path.join(folder,'resume.paper.json'),output:path.join(folder,'preview')});
 assert.equal(result.pagination.sourcePages,1);assert.ok(result.pagination.outputPages>1);assert.equal(result.pagination.increased,true);assert.ok(result.warnings.some(w=>w.includes('原稿 1 页')));assert.match(result.document.markdown,/project 85/);assert.equal(result.document.settings.fontSize,'10.5');
});

const test=require('node:test');const assert=require('node:assert/strict');const core=require('../resume-core');const renderer=require('../lib/render');const {layout}=require('../lib/autolayout');const {pdfText}=require('../lib/import');const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
test('smart layout cleans excess whitespace within one page, preserves facts and code',{timeout:30000},async()=>{
 const markdown='# 示例姓名\n\n\n\n## 工作经历\n\n负责交付100个项目\n\n\n\n::: gap 15mm\n\n## 教育经历\n示例大学\n\n```text\na\n\n\nb\n```';
 const result=await layout(core.document({markdown,settings:{fontSize:10}}));assert.equal(result.fits,true);assert.equal(result.report.actualPages,1);assert.match(result.document.markdown,/交付100个项目/);assert.doesNotMatch(result.document.markdown,/::: gap 15mm/);assert.match(result.document.markdown,/a\n\n\nb/);assert.ok(Number(result.document.settings.fontSize)>=10);
 const prefix=path.resolve('tmp/tests',randomUUID(),'preview');const report=await renderer.render(result.document,{output:prefix});const parsed=await pdfText(fs.readFileSync(report.artifacts.pdf));assert.doesNotMatch(parsed.text,/@page|目标.*页|末页已用/);assert.match(parsed.text,/100个项目/);
});

test('smart layout fills usable A4 height without changing resume text',{timeout:60000},async()=>{
 const markdown=fs.readFileSync(path.resolve('tests/fixtures/fill-page.md'),'utf8');
 const input=core.document({markdown});const result=await layout(input);
 assert.equal(result.report.actualPages,1);assert.deepEqual(result.report.overflow,[]);assert.equal(result.metrics.navigations,1);assert.ok(result.metrics.pdfRenders<=3);assert.ok(result.metrics.geometryChecks>result.metrics.pdfRenders);
 assert.ok(result.report.remainingMmEstimated<=8,`Remaining blank area: ${result.report.remainingMmEstimated}mm`);
 assert.equal(result.document.markdown,input.markdown);assert.ok(Number(result.document.settings.fontSize)<=12);
 const repeated=await layout(result.document);assert.equal(repeated.report.actualPages,1);assert.ok(repeated.report.remainingMmEstimated<=8);
 const compressed=core.fitCandidates(result.document);assert.equal(compressed[1].settings.pageSpacing,'');
});

test('bilingual layout preserves language boundaries and allows natural multi-page content',{timeout:60000},async()=>{
 const markdown=fs.readFileSync('templates/examples/bilingual.md','utf8');const input=core.document({markdown,settings:{targetPages:'auto'}});const result=await layout(input);assert.equal(result.fits,true);assert.deepEqual(result.report.overflow,[]);assert.equal(result.document.markdown.split(/^::: page$/m).length,2);
 let pages=0;for(const part of result.document.markdown.split(/^::: page$/m)){const single=await renderer.render(core.document({...result.document,markdown:part}));pages+=single.actualPages;}assert.equal(result.report.actualPages,pages);assert.ok(pages>=2);assert.equal(result.document.settings.fontSize,input.settings.fontSize);
 const prefix=path.resolve('tmp/tests',randomUUID(),'bilingual');const report=await renderer.render(result.document,{output:prefix});const parsed=await pdfText(fs.readFileSync(report.artifacts.pdf));assert.equal(parsed.pages,pages);assert.match(parsed.text,/Jack/);assert.match(parsed.text,/张三/);
});

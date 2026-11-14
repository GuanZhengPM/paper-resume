const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{once}=require('node:events');
const core=require('../resume-core'),renderer=require('../lib/render');
test('README syntax tables keep two columns, including row delimiters',()=>{
 const {Marked}=require('../vendor/marked');const parser=new Marked();
 for(const name of ['README.md','README.en.md']){const tokens=parser.lexer(fs.readFileSync(name,'utf8'));const table=tokens.find(t=>t.type==='table'&&t.rows.some(r=>r[0].text==='`::: row`'));assert.ok(table);assert.equal(table.header.length,2);const row=table.rows.find(r=>r[0].text==='`::: row`');assert.match(parser.parseInline(row[1].text),/\|\|/);assert.ok(!tokens.some(t=>t.type==='table'&&t.rows.some(r=>r.length!==t.header.length)));}
});
test('CLI operations support cities and independently styled three-column entries',()=>{
 const doc=core.apply({markdown:'# 张三\n## 工作经历\n待排版标题'},[{op:'row',target:{text:'待排版标题'},cells:['**示例公司**','产品团队 · 产品经理','2024 - 至今 · 北京'],widths:'2:3:2'},{op:'style',target:{row:1},cell:2,style:{align:'left',size:10.5}}]);core.validateMarkdown(doc.markdown);const row=core.inspect(doc.markdown).rows[0];assert.equal(row.widths,'2:3:2');assert.equal(row.cells[1].style.align,'left');assert.match(row.cells[2].text,/北京/);
});
test('same-line company headings retain company spacing and UI typography is consistent',{timeout:30000},async()=>{
 const doc={...core.document({markdown:'# 张三\n## 工作经历\n### **公司甲** · 产品经理 | 2024 · 上海\n工作简介甲\n### **公司乙** · 工程师 | 2025 · 北京\n工作简介乙'}),revision:'variants'};
 const server=require('../lib/server').start({file:'tmp/variants.paper.json',port:0,quiet:true,getSnapshot:()=>doc});await once(server,'listening');const browser=await renderer.launchBrowser();
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/?view=render');await page.evaluate(()=>window.paperReady);await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>({titles:[...document.querySelectorAll('#resume h3')].map(el=>el.className),paragraphs:[...document.querySelectorAll('#resume>p')].map(el=>el.className),ui:['body','.brand','#layout-toggle','textarea','select','dialog'].map(s=>getComputedStyle(document.querySelector(s)).fontFamily),paper:getComputedStyle(document.querySelector('#resume')).fontFamily,logo:document.querySelector('.brand-logo').getAttribute('src')}));
 assert.match(result.titles[0],/experience-title/);assert.match(result.titles[1],/experience-separated/);assert.ok(result.paragraphs.every(s=>s.includes('experience-content')));assert.equal(new Set(result.ui).size,1);assert.notEqual(result.paper,result.ui[0]);assert.equal(result.logo,'templates/portrait.png');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
test('section headings followed by rows keep section typography and three-column rows fit long left labels',{timeout:30000},async()=>{
 const doc={...core.document({markdown:'# 张三\n## 工作经历 {size=12.5}\n::: row\n***示例科技-基础平台与技术中台-智能应用产品部*** || 产品经理 || 2024.01 - 至今\n:::\n说明\n## 个人项目 {size=12.5}\n::: row\n**项目甲** || 2026\n:::\n项目说明\n## 教育经历 {size=12.5}\n说明',settings:{pageSpacing:.9}}),revision:'section-headings'};
 const server=require('../lib/server').start({file:'tmp/section-headings.paper.json',port:0,quiet:true,getSnapshot:()=>doc});await once(server,'listening');const browser=await renderer.launchBrowser();
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/?view=render');await page.evaluate(()=>window.paperReady);await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>({headings:[...document.querySelectorAll('#resume h2')].map(el=>{const style=getComputedStyle(el);return {text:el.textContent,className:el.className,fontSize:style.fontSize,fontWeight:style.fontWeight,marginTop:style.marginTop,marginBottom:style.marginBottom};}),rowCellLines:document.querySelector('#resume .layout-row[data-columns="3"] > div:first-child strong, #resume .layout-row[data-columns="3"] > div:first-child em').getClientRects().length}));
 const {headings,rowCellLines}=result;
 assert.equal(headings.length,3);assert.ok(headings.every(item=>!item.className.includes('experience-title')&&!item.className.includes('experience-separated')));assert.equal(new Set(headings.map(item=>item.fontSize)).size,1);assert.equal(new Set(headings.map(item=>item.fontWeight)).size,1);assert.equal(new Set(headings.map(item=>item.marginTop)).size,1);assert.equal(new Set(headings.map(item=>item.marginBottom)).size,1);assert.equal(rowCellLines,1);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

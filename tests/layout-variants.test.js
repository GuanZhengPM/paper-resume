const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{once}=require('node:events');
const core=require('../resume-core'),renderer=require('../lib/render');
test('README syntax tables keep consistent columns, including row delimiters',()=>{
 const {Marked}=require('../vendor/marked');const parser=new Marked();
 for(const name of ['README.md','README.en.md']){const tokens=parser.lexer(fs.readFileSync(name,'utf8'));const table=tokens.find(t=>t.type==='table'&&t.rows.some(r=>r[0].text==='`::: row`'));assert.ok(table);assert.ok(table.header.length>=2);const row=table.rows.find(r=>r[0].text==='`::: row`');assert.match(parser.parseInline(row.map(c=>c.text).join(' ')),/\|\|/);assert.ok(!tokens.some(t=>t.type==='table'&&t.rows.some(r=>r.length!==t.header.length)));}
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
 const markdown=[
  '# 张三',
  '## 工作经历 {size=12.5}',
  '#### **示例科技**',
  '::: row',
  '***示例科技-基础平台与技术中台-智能应用产品部*** || 产品经理 || 2024.01 - 至今 · 北京',
  ':::',
  '::: row',
  '***示例科技集团-人工智能与大数据平台-智能研发效能平台部*** || 高级产品经理 || 2023.01 - 2023.12',
  ':::',
  '::: row',
  '***示例科技集团-超长跨国业务部门名称测试用于验证当单行宽度真正不足以容纳全部文字时能够自然折行且不挤压右侧岗位与时间列-核心平台研发部*** || 平台产品经理 || 2022.01 - 2022.12',
  ':::',
  '- 负责核心平台产品规划与落地',
  '### **第二公司** · 商业化部门 · 策略产品经理 | 2021.01 - 2021.12 · 上海',
  '- 负责策略迭代',
  '## 项目经历 {size=12.5}',
  '::: row',
  '**开源评测基准项目：真实场景多语言术语识别评测** || 2026.10',
  ':::',
  '- 项目说明',
  '## 教育背景 {size=12.5}',
  '### **示例大学（985）**',
  '::: row',
  '计算机科学与技术 + 金融学 本科 || 2017.09 - 2021.06 · 北京',
  ':::',
  '::: page',
  '# Zhang San',
  '## Work Experience {size=12.5}',
  '#### **Example Corp**',
  '::: row',
  '***AI Platform & Data Infrastructure Department*** || Product Manager || 2024.01 - Present · Beijing',
  ':::',
  '## Personal Projects {size=12.5}',
  '::: row',
  '**Open Evaluation Benchmark for Speech Recognition** || 2026.10',
  ':::',
  '## Education {size=12.5}',
  '#### **Example University**',
  '::: row',
  'B.S. in Computer Science || 2017.09 - 2021.06',
  ':::'
 ].join('\n');
 const doc={...core.document({markdown,settings:{fontSize:10.5,pageSpacing:.5}}),revision:'section-headings'};
 const server=require('../lib/server').start({file:'tmp/section-headings.paper.json',port:0,quiet:true,getSnapshot:()=>doc});await once(server,'listening');const browser=await renderer.launchBrowser();
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/?view=render');await page.evaluate(()=>window.paperReady);await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>{
  const pt=el=>Math.round(parseFloat(getComputedStyle(el).fontSize)*0.75*100)/100;
  const weight=el=>getComputedStyle(el).fontWeight;
  const lines=el=>{const range=document.createRange();range.selectNodeContents(el);return new Set([...range.getClientRects()].filter(r=>r.width>1).map(r=>Math.round(r.top))).size;};
  const h2s=[...document.querySelectorAll('#resume h2')];
  const sectionGaps=h2s.map(h2=>{const next=h2.nextElementSibling;return Math.round((next.getBoundingClientRect().top-h2.getBoundingClientRect().bottom)*25.4/96*10)/10;});
  const level2=[
   ...document.querySelectorAll('#resume h4.experience-title, #resume h3.experience-title'),
   ...document.querySelectorAll('#resume .layout-row.experience-title > div:first-child')
  ].map(el=>({text:el.textContent.trim().slice(0,20),pt:pt(el),weight:weight(el)}));
  const level3=[
   ...document.querySelectorAll('#resume .experience-title + .layout-row > div, #resume .role-title > div'),
   ...document.querySelectorAll('#resume .layout-row.experience-title > div:last-child'),
   ...document.querySelectorAll('#resume .entry-subtitle, #resume .entry-date'),
   ...document.querySelectorAll('#resume li')
  ].map(el=>({text:el.textContent.trim().slice(0,20),pt:pt(el)}));
  const workRows=[...document.querySelectorAll('#resume .layout-row[data-columns="3"]')];
  return {
   h2Sizes:[...new Set(h2s.map(pt))],
   sectionGaps:[...new Set(sectionGaps)],
   level2Sizes:[...new Set(level2.map(x=>x.pt))],
   level2Weights:[...new Set(level2.map(x=>x.weight))],
   level3Sizes:[...new Set(level3.map(x=>x.pt))],
   moderateRowLines:lines(workRows[0].children[0]),
   longRowLines:lines(workRows[1].children[0]),
   longRowAutoGrid:workRows[1].dataset.autoGrid,
   extremeRowLines:lines(workRows[2].children[0]),
   extremeRowMiddleLines:lines(workRows[2].children[1]),
   extremeRowRightLines:lines(workRows[2].children[2]),
   overflow:document.querySelector('#resume').scrollWidth>document.querySelector('#resume').clientWidth+2
  };
 });
 assert.deepEqual(result.h2Sizes,[12.5]);
 assert.deepEqual(result.sectionGaps,[2]);
 assert.deepEqual(result.level2Sizes,[11]);
 assert.deepEqual(result.level2Weights,['700']);
 assert.deepEqual(result.level3Sizes,[10.5]);
 assert.equal(result.moderateRowLines,1);
 assert.equal(result.longRowLines,1);
 assert.equal(result.longRowAutoGrid,'left');
 assert.ok(result.extremeRowLines>=2);
 assert.equal(result.extremeRowMiddleLines,1);
 assert.equal(result.extremeRowRightLines,1);
 assert.equal(result.overflow,false);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

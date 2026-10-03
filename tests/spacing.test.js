const test=require('node:test');const assert=require('node:assert/strict');const {once}=require('node:events');const core=require('../resume-core');const renderer=require('../lib/render');
test('HTML export retains role spacing, including zero',()=>{
 const fs=require('node:fs'),path=require('node:path');const folder=path.resolve('tmp/tests/html-spacing');fs.mkdirSync(folder,{recursive:true});
 for(const roleGap of [0,.75]){const html=require('../cli').exportHTML(core.document({markdown:'# 示例姓名',settings:{roleGap}}),path.join(folder,'resume.html'));assert.ok(html.includes('--role-gap:'+roleGap+'mm'));}
});
test('departments share one company and use a smaller gap than the next company',{timeout:30000},async()=>{
 const markdown='# 示例姓名\n### 工作经历\n#### 公司甲\n::: row\n部门甲 || 产品经理 || 2024\n:::\n工作简介甲\n::: row\n部门乙 || 产品经理 || 2025\n:::\n工作简介乙\n\n#### TTC\n::: row\n部门丙 || 产品经理 || 2026\n:::\n工作简介丙';
 const doc={...core.document({markdown,settings:{experienceGap:3,roleGap:.75,experienceInner:.5,pageSpacing:2}}),revision:'fixture'};
 const server=require('../lib/server').start({file:'tmp/spacing-fixture.paper.json',port:0,quiet:true,getSnapshot:()=>doc});await once(server,'listening');const browser=await renderer.launchBrowser();
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?view=render');await page.evaluate(()=>window.paperReady);
 const result=await page.evaluate(()=>{const company=[...document.querySelectorAll('#resume h4')].find(el=>el.textContent==='TTC');const role=document.querySelector('#resume .role-title');return {company:company.className,role:role.textContent,companyGap:parseFloat(getComputedStyle(company).marginTop),roleGap:parseFloat(getComputedStyle(role).marginTop),roles:document.querySelectorAll('.role-title').length};});
 assert.match(result.company,/experience-separated/);assert.equal(result.roles,1);assert.match(result.role,/部门乙/);assert.ok(result.roleGap<result.companyGap);assert.equal(await page.locator('[data-setting="roleGap"]').count(),1);assert.equal(await page.locator('[data-setting="experienceInner"]').count(),1);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

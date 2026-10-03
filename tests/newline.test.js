const test=require('node:test');const assert=require('node:assert/strict');
const renderer=require('../resume-renderer').create(require('../vendor/marked'),require('../text-style'));
test('one return is one break, two returns leave one blank line',()=>{
  assert.equal((renderer.parse('第一行\n第二行').match(/<br>/g)||[]).length,1);
  const two=renderer.parse('第一段\n\n第二段');assert.match(two,/height:1lh/);assert.equal((two.match(/<p>/g)||[]).length,2);
  assert.equal((renderer.parse('旧换行<br>\n下一行').match(/<br>/g)||[]).length,1);
  assert.equal((renderer.parse('第一行<br>\n<br>\n第二行').match(/<br>/g)||[]).length,2);
  assert.match(renderer.parse('```txt\n第一行<br>\n第二行\n```'),/第一行&lt;br&gt;\n第二行/);
  assert.match(renderer.parse('第一段\n\n---\n\n第二段'),/<hr/);
});
test('source separators do not add blank lines around resume structure',()=>{
  const source='## 工作经历\n\n### 公司\n\n::: row\n部门 || 时间\n:::\n\n- 贡献\n\n### 下一家公司\n::: row\n部门 || 时间\n:::';
  assert.doesNotMatch(renderer.parse(source),/class="layout-gap"/);
  assert.match(renderer.parse('## 标题\n\n\n正文'),/height:1lh/);
});

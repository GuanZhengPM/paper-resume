'use strict';
const fs=require('node:fs'),path=require('node:path');
const core=require('../resume-core'),store=require('./document-store'),structure=require('../resume-structure');
const roles=['general','product','ai-product','operations','algorithm','ai-infra','embedded','robotics','backend'];
const schema={version:1,expectedRevision:'prepare 返回的 revision',target:'目标岗位或方向',mode:'impact | plain',role:roles,diagnosis:['基于原文和目标岗位的问题、优势与修改假设'],answers:[{id:'fact-1',text:'用户实际补充的事实；不能来自 JD 或示例'}],questions:[{id:'q-1',question:'需要补充的职责、行动或结果',status:'open | answered | unavailable',answer:'用户答复（有则填写）'}],changes:[{id:'c-1',before:'原文中的精确片段',after:'建议改文',reason:'为什么改、与目标的关系',status:'ready | needs-input',occurrence:'同样原文多次出现时，指定第几处，从 1 开始',evidence:[{source:'resume | fact-1',quote:'原文或用户补充事实中的精确引文'}]}]};
function textFile(file){return file?fs.readFileSync(path.resolve(file),'utf8').replace(/^\uFEFF/,''):'';}
function writeNew(file,value){const output=path.resolve(file);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return output;}
function prepare(doc,options={}){
 const role=options.role||'general',mode=options.mode||'impact';if(!roles.includes(role)||!['impact','plain'].includes(mode))core.fail('无效的岗位类别或优化模式');
 const jd=textFile(options.jd),brief=textFile(options.brief);
 return {version:1,expectedRevision:doc.revision||store.revision(doc),target:options.target||'',role,mode,status:options.target||jd?'ready-for-diagnosis':'needs-target',resume:core.document(doc),structure:structure.parse(doc.markdown),jobDescription:jd,userBrief:brief,proposalSchema:schema,workflow:'由当前 Agent 读取原文和目标，诊断、按需提问、记录真实补充信息，再生成优化方案。CLI 不调用模型，不把准备包当作已优化结果。'};
}
function nonempty(value,label){if(typeof value!=='string'||!value.trim())core.fail(label+'不能为空');}
function numbers(text){return [...new Set(structure.plain(text).match(/\d+(?:[.,]\d+)*(?:%|％)?/g)||[])];}
function review(doc,plan,selection){
 if(!plan||plan.version!==1||!Array.isArray(plan.changes))core.fail('内容方案需要 version:1 和 changes 数组');
 if(plan.expectedRevision!==doc.revision)core.fail('简历已更新，请重新读取并生成内容方案','REVISION_CONFLICT');
 nonempty(plan.target,'优化目标');if(!['impact','plain'].includes(plan.mode)||!roles.includes(plan.role))core.fail('方案需要有效的 mode 和 role');
 if(!Array.isArray(plan.diagnosis)||!plan.diagnosis.length||plan.diagnosis.some(d=>typeof d!=='string'||!d.trim()))core.fail('需要基于原文的 diagnosis');
 const facts=new Map([['resume',doc.markdown]]);
 for(const answer of plan.answers||[]){nonempty(answer.id,'补充事实 ID');nonempty(answer.text,'补充事实');if(facts.has(answer.id))core.fail('补充事实 ID 重复');facts.set(answer.id,answer.text);}
 const questions=plan.questions||[];if(!Array.isArray(questions))core.fail('questions 必须是数组');
 for(const q of questions){nonempty(q.question,'问题');if(!['open','answered','unavailable'].includes(q.status))core.fail('无效的问题状态');if(q.status==='answered')nonempty(q.answer,'用户答复');}
 const wanted=selection?new Set(selection.split(',').map(s=>s.trim()).filter(Boolean)):null;if(wanted&&!wanted.size)core.fail('select 不能为空');
 const ids=new Set(),changes=[],spans=[];
 for(const change of plan.changes){
  nonempty(change.id,'修改 ID');if(ids.has(change.id))core.fail('修改 ID 重复');ids.add(change.id);nonempty(change.before,'原文');nonempty(change.reason,'修改原因');
  if(!['ready','needs-input'].includes(change.status))core.fail('修改状态必须是 ready 或 needs-input');
  if(typeof change.after!=='string')core.fail('改文必须是字符串');
  const matches=[];for(let at=0;(at=doc.markdown.indexOf(change.before,at))!==-1;at+=change.before.length)matches.push(at);
  if(!matches.length)core.fail('修改 '+change.id+' 的原文不在当前简历中');
  if(matches.length>1&&change.occurrence===undefined)core.fail('修改 '+change.id+' 的原文重复，请指定 occurrence');
  const occurrence=change.occurrence??1;if(!Number.isInteger(occurrence)||occurrence<1||occurrence>matches.length)core.fail('occurrence 超出范围');
  const selected=wanted?wanted.has(change.id):change.status==='ready',blockers=[];
  if(change.status==='needs-input')blockers.push('需要用户补充事实');
  if(!Array.isArray(change.evidence)||!change.evidence.length)blockers.push('缺少改写依据');
  const support=[];
  for(const evidence of change.evidence||[]){const source=facts.get(evidence.source);if(!source||typeof evidence.quote!=='string'||!evidence.quote.trim()||!source.includes(evidence.quote))core.fail('修改 '+change.id+' 的依据无法定位');support.push(evidence.quote);}
  if(/\[(?:示例|待补充|待确认|杜撰|example|TODO)[^\]]*\]/i.test(change.after))blockers.push('改文仍含示例或待补充内容');
  const supplied=numbers([change.before,...support].join('\n')),newNumbers=numbers(change.after).filter(n=>!supplied.includes(n));if(newNumbers.length)blockers.push('新增数字缺少引用依据：'+newNumbers.join('、'));
  if(/(^|\n)\s*(?::::|```|~~~)|!\[/.test(change.before+'\n'+change.after))blockers.push('内容优化不修改图片或排版指令；请使用常规 apply');
  const start=matches[occurrence-1],end=start+change.before.length;
  if(selected){if(spans.some(s=>start<s.end&&end>s.start))core.fail('选定修改的原文重叠，请合并为一项');spans.push({start,end,after:change.after});}
  changes.push({...change,selected,blockers,removedNumbers:numbers(change.before).filter(n=>!numbers(change.after).includes(n))});
 }
 if(wanted)for(const id of wanted)if(!ids.has(id))core.fail('找不到修改 ID：'+id);
 const selected=changes.filter(c=>c.selected),canApply=selected.length>0&&selected.every(c=>!c.blockers.length);
 let markdown=doc.markdown;for(const s of spans.sort((a,b)=>b.start-a.start))markdown=markdown.slice(0,s.start)+s.after+markdown.slice(s.end);
 const next=core.document({...doc,markdown});core.validateMarkdown(next.markdown);
 return {expectedRevision:doc.revision,target:plan.target,mode:plan.mode,role:plan.role,diagnosis:plan.diagnosis,questions,changes,canApply,document:next,factCheck:'引用和新增数字检查不等于事实真实性或语义核验；Agent 须核对职责、成果归属、指标口径和用户补充信息。'};
}
function report(result){
 const lines=['# 简历内容优化方案','',`目标：${result.target}`,`模式：${result.mode==='plain'?'专业表达':'价值与成果'}`,'','## 诊断','',...result.diagnosis.map(d=>'- '+d),''];
 for(const c of result.changes){lines.push('## '+c.id+(c.selected?' · 本次选用':''),'','原文：',c.before,'','建议改为：',c.after,'','原因：'+c.reason,'',...c.blockers.map(b=>'待处理：'+b));}
 if(result.questions.length)lines.push('## 待补充信息','',...result.questions.map(q=>'- '+q.question+'（'+q.status+'）'+(q.answer?' '+q.answer:'')), '');
 lines.push(result.factCheck,'');return lines.join('\n');
}
module.exports={prepare,review,report,writeNew,schema};

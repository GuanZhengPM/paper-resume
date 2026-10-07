(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./text-style.js'),require('./resume-structure.js'),require('./template-profiles.js'));
  else root.PaperCore = factory({readLineStyle, writeLineStyle},root.PaperStructure,root.PaperTemplates);
})(typeof globalThis === 'object' ? globalThis : this, function (styles, structure, profiles) {
  'use strict';
  const defaults = {theme:'ink', fontSize:'11', density:'normal', fontFamily:'serif', targetPages:'1', marginVertical:'12', marginHorizontal:'14', showGuides:true, experienceGap:'4', experienceInner:'1',marginTop:'',marginBottom:'',lineHeight:'',pageSpacing:''};
  const settingSchema = {
    imagePositions:{type:'imagePositions'},
    templateId:{enum:['','projects','internship','research','academic','bilingual']},
    theme:{enum:['ink','forest','navy']}, fontSize:{min:8,max:36},
    density:{enum:['compact','normal','airy']}, fontFamily:{allowCustom:true,maxLength:80,enum:['serif','sans','yahei','times','arial','calibri','simsun','kaiti','fangsong']}, targetPages:{enum:['auto','1','2','3']},
    marginVertical:{min:6,max:30}, marginTop:{min:6,max:30,optional:true}, marginBottom:{min:6,max:30,optional:true}, lineHeight:{min:1,max:2,optional:true}, pageSpacing:{min:0,max:20,optional:true}, photoHeight:{min:8,max:65,optional:true}, marginHorizontal:{min:8,max:30}, experienceGap:{min:0,max:15}, roleGap:{min:0,max:10,optional:true}, experienceInner:{min:0,max:6}, showGuides:{type:'boolean'}
  };
  function fail(message, code='INVALID_INPUT') { const error=new Error(message); error.code=code; throw error; }
  function normalizeSettings(input={}, base=defaults) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('settings 必须是对象');
    const result={...base};
    for (const [key,value] of Object.entries(input)) {
      const rule=settingSchema[key];
      if (!rule) fail(`未知设置：${key}`);
      if(rule.type==='imagePositions'){
        if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>200)fail('图片位置无效');
        const positions=Object.create(null);
        for(const [id,position] of Object.entries(value)){
          if(!id||id.length>300000||!position||typeof position!=='object')fail('图片位置无效');
          const keys=['page','x','y','width','height'];if(Object.keys(position).some(k=>!keys.includes(k)&&k!=='layoutHeight')||keys.some(k=>typeof position[k]!=='number'||!Number.isFinite(position[k])))fail('图片位置无效');
          if(!Number.isInteger(position.page)||position.page<1||position.page>50||position.x<0||position.y<0||position.width<=0||position.height<=0||position.x+position.width>211||position.y+position.height>298)fail('图片不能超出页面');
          if(position.layoutHeight!==undefined&&(!Number.isFinite(position.layoutHeight)||position.layoutHeight<=0||position.layoutHeight>298))fail('图片布局高度无效');
          positions[id]={...position};
        }
        result[key]=positions;continue;
      }
      if(rule.optional && value===''){result[key]='';continue;}
      if (rule.type==='boolean') { if (typeof value!=='boolean') fail(`${key} 必须为布尔值`); result[key]=value; }
      else if (key==='fontFamily') { const name=typeof value==='string'?value.trim():''; if(!name || name.length>80 || !/^[\p{L}\p{N} ._()-]+$/u.test(name)) fail('字体请输入本机字体名称，最多80个字符'); result[key]=name; }
      else if (rule.enum) { if (!rule.enum.includes(String(value))) fail(`${key} 不在允许值中`); result[key]=String(value); }
      else { if (value === '' || value === null || typeof value === 'boolean' || !Number.isFinite(Number(value)) || Number(value)<rule.min || Number(value)>rule.max) fail(`${key} 必须在 ${rule.min}–${rule.max} 之间`); result[key]=String(Number(value)); }
    }
    // A partial photo-height setting updates manually placed portraits as well.
    if(Object.hasOwn(input,'photoHeight')&&!Object.hasOwn(input,'imagePositions')&&result.imagePositions){
      result.imagePositions={...result.imagePositions};
      for(const [id,box] of Object.entries(result.imagePositions))if(id.startsWith('照片:')){
        if(!result.photoHeight){delete result.imagePositions[id];continue;}
        const height=Number(result.photoHeight),width=height*box.width/box.height;
        if(width>209.8)fail('照片过宽，请减小高度');
        result.imagePositions[id]={...box,layoutHeight:box.layoutHeight||box.height,width,height,x:Math.min(box.x,209.8-width),y:Math.min(box.y,297-height)};
      }
    }
    return result;
  }
  function document(input) {
    if (!input || typeof input.markdown!=='string') fail('文档必须包含 markdown 字符串');
    if (input.schemaVersion!==undefined && input.schemaVersion!==1) fail('不支持此文档版本');
    return {schemaVersion:1, markdown:input.markdown.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'), settings:normalizeSettings(input.settings || {})};
  }
  const plain = text => styles.readLineStyle(text).text.replace(/ ?!\[[^\]]*\]\([^)]+\)/g,'').replace(/(?:\*{1,3}|\+\+|__)/g,'').trim();
  function inspect(markdown) {
    const lines=markdown.split('\n');
    const headings=[]; const rows=[];
    let layout=null;
    lines.forEach((text,index) => {
      const open=/^::: (center|left|right|row|keep)(?: ([1-9]:[1-9]:[1-9]))?[ \t]*$/.exec(text);
      if (open) { layout={mode:open[1],line:index+1,widths:open[2] || '1:1:1'}; return; }
      if (/^:::[ \t]*$/.test(text)) { layout=null; return; }
      const heading=/^(#{1,6})[ \t]+(.+)$/.exec(text);
      if (heading) headings.push({line:index+1,level:heading[1].length,title:plain(heading[2]),style:styles.readLineStyle(heading[2]).style});
      if (layout?.mode==='row' && text.trim()) rows.push({row:rows.length+1,line:index+1,startLine:layout.line,endLine:lines.findIndex((value,at)=>at>index && /^:::[ \t]*$/.test(value))+1,cells:text.split(' || ').map(cell=>({text:styles.readLineStyle(cell.trim()).text,style:styles.readLineStyle(cell.trim()).style})),widths:layout.widths});
    });
    return {images:lines.flatMap((text,index)=>[...text.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map(m=>({line:index+1,alt:m[1],type:m[2].startsWith('data:')?m[2].slice(5,m[2].indexOf(';')):'template',encodedLength:m[2].length,...(!m[2].startsWith('data:')?{source:m[2]}:{})}))),lineCount:lines.length,headings,rows,lines:lines.map((text,index)=>({line:index+1,text}))};
  }
  function targetLine(markdown,target) {
    if (!target || typeof target!=='object') fail('请提供 target：line、heading、row 或 text');
    const info=inspect(markdown); let matches;
    if (target.line!==undefined) {
      if (!Number.isInteger(target.line) || target.line<1 || target.line>info.lineCount) fail('line 超出范围');
      return target.line-1;
    }
    if (target.heading!==undefined) matches=info.headings.filter(h=>h.title===target.heading).map(h=>h.line-1);
    else if (target.row!==undefined) matches=info.rows.filter(row=>row.row===target.row).map(row=>row.line-1);
    else if (typeof target.text==='string' && target.text) matches=info.lines.filter(line=>line.text.includes(target.text)).map(line=>line.line-1);
    else fail('target 需要 line、heading、row 或非空 text');
    if (!matches.length) fail('找不到目标','NOT_FOUND');
    if (target.occurrence!==undefined) {
      if (!Number.isInteger(target.occurrence) || target.occurrence<1 || target.occurrence>matches.length) fail('occurrence 超出范围');
      return matches[target.occurrence-1];
    }
    if (matches.length!==1) fail('目标不唯一，请指定 occurrence 或 line','AMBIGUOUS_TARGET');
    return matches[0];
  }
  function validateStyle(style) {
    if (!style || typeof style!=='object' || Array.isArray(style)) fail('style 必须是对象');
    for (const [key,value] of Object.entries(style)) {
      if (['bold','italic'].includes(key)) { if (typeof value!=='boolean') fail(`${key} 必须为布尔值`); }
      else if (key==='level') { if (!Number.isInteger(value) || value<0 || value>6) fail('level 必须为 0–6'); }
      else if (key==='size') { if (value!=='' && (typeof value==='boolean' || !Number.isFinite(Number(value)) || Number(value)<8 || Number(value)>36)) fail('size 必须为 8–36，空字符串表示默认'); }
      else if (key==='align') { if (!['','left','center','right'].includes(value)) fail('align 需要 left、center、right 或空字符串'); }
      else if (['rule','underline'].includes(key)) { if (!['','on','off'].includes(value)) fail(`${key} 需要 on、off 或空字符串`); }
      else fail(`未知样式：${key}`);
    }
  }
  function emphasis(text,key,on) {
    const match=/^(\*{1,3})([\s\S]+)\1$/.exec(text);
    if (match) {
      const old=match[1].length; const has=key==='bold' ? old>=2 : old%2===1;
      const next=old+(has===on ? 0 : on ? (key==='bold'?2:1) : -(key==='bold'?2:1));
      return '*'.repeat(next)+match[2]+'*'.repeat(next);
    }
    return on ? (key==='bold'?'**':'*')+text+(key==='bold'?'**':'*') : text;
  }
  function styleText(text,patch) {
    const parsed=styles.readLineStyle(text);
    const prefix=/^(#{1,6})[ \t]+/.exec(parsed.text);
    let body=prefix ? parsed.text.slice(prefix[0].length) : parsed.text;
    if (patch.bold!==undefined) body=emphasis(body,'bold',patch.bold);
    if (patch.italic!==undefined) body=emphasis(body,'italic',patch.italic);
    const level=patch.level===undefined ? prefix?.[1].length || 0 : patch.level;
    const line=(level?'#'.repeat(level)+' ':'')+body;
    const attributes=Object.fromEntries(Object.entries(patch).filter(([key])=>!['bold','italic','level'].includes(key)));
    return styles.writeLineStyle(line,{...parsed.style,...attributes});
  }
  function cleanSpaces(markdown) {
    let row=false; let fence=false;
    return markdown.split('\n').map(line=>{
      if (/^\s*```/.test(line)) {fence=!fence; return line;}
      if (fence) return line;
      if (/^::: row(?: |$)/.test(line)) {row=true;return line;}
      if (/^:::[ \t]*$/.test(line)) {row=false;return line;}
      if (row || /^:::/.test(line)) return line;
      return line.split(/(\s+\{(?:size|rule|align|underline)=[^{}\n]+\}\s*$|`[^`]*`|\[[^\]]*\]\([^)]*\))/g).map((part,index)=>index%2 ? part : part.replace(/(?<=\p{Script=Han}) (?=[A-Za-z0-9]|[+-]\d)/gu,'').replace(/(?<=[A-Za-z0-9%+]) (?=\p{Script=Han})/gu,'')).join('');
    }).join('\n');
  }
  function validateMarkdown(markdown) {
    let block=null; let fence=false;
    for (const [index,line] of markdown.split('\n').entries()) {
      if (/^\s*```/.test(line)) {fence=!fence;continue;}
      if (fence) continue;
      const open=/^::: (center|left|right|row|keep)(?: ([1-9]:[1-9]:[1-9]))?[ \t]*$/.exec(line);
      if (open) { if (block) fail(`第 ${index+1} 行：排版块不能嵌套`); if (open[2] && open[1]!=='row') fail('只有 row 支持列宽'); block=open[1]; }
      else if (/^:::[ \t]*$/.test(line)) { if (!block) fail(`第 ${index+1} 行：多余的 :::`); block=null; }
      else if (block==='row' && line.trim() && ![2,3].includes(line.split(' || ').length)) fail(`第 ${index+1} 行：row 必须包含 2 或 3 列`);
    }
    if (block) fail('排版块未闭合');
  }
  function apply(documentInput,operations) {
    let result=document(documentInput);
    if (!Array.isArray(operations) || !operations.length) fail('operations 必须为非空数组');
    for (const operation of operations) {
      if (!operation || typeof operation!=='object') fail('无效操作');
      if (['set-structure','edit-block','move-section'].includes(operation.op)) {
        result.markdown=structure.edit(result.markdown,operation,profiles[result.settings.templateId]); continue;
      }
      if (operation.op==='settings') { result.settings=normalizeSettings(operation.values,result.settings); continue; }
      if (operation.op==='set-markdown') { if (typeof operation.markdown!=='string') fail('markdown 必须为字符串'); result.markdown=operation.markdown.replace(/\r\n?/g,'\n'); continue; }
      if (operation.op==='normalize-spaces') { result.markdown=cleanSpaces(result.markdown); continue; }
      if (operation.op==='replace') {
        if (typeof operation.from!=='string' || !operation.from || typeof operation.to!=='string') fail('replace 需要非空 from 和字符串 to');
        const matches=[]; let at=0;
        while ((at=result.markdown.indexOf(operation.from,at))!==-1) { matches.push(at); at+=operation.from.length; }
        if (!matches.length) fail('找不到要替换的内容','NOT_FOUND');
        if (operation.all===true) result.markdown=result.markdown.split(operation.from).join(operation.to);
        else {
          if (matches.length>1 && operation.occurrence===undefined) fail('替换内容不唯一，需要 occurrence 或 all','AMBIGUOUS_TARGET');
          const occurrence=operation.occurrence || 1;
          if (!Number.isInteger(occurrence) || occurrence<1 || occurrence>matches.length) fail('occurrence 超出范围');
          const position=matches[occurrence-1]; result.markdown=result.markdown.slice(0,position)+operation.to+result.markdown.slice(position+operation.from.length);
        }
        continue;
      }
      const lineIndex=targetLine(result.markdown,operation.target);
      const lines=result.markdown.split('\n');
      if (operation.op==='style') {
        validateStyle(operation.style);
        if (/^:::/.test(lines[lineIndex]) || !lines[lineIndex].trim()) fail('样式目标必须是文字行');
        const cells=lines[lineIndex].split(' || ');
        if (operation.cell!==undefined && (!Number.isInteger(operation.cell) || operation.cell<1 || operation.cell>cells.length)) fail('cell 超出范围');
        if (cells.length>1 && operation.style.level!==undefined) fail('分列不能使用 level');
        lines[lineIndex]=cells.map((cell,index)=>operation.cell && operation.cell!==index+1 ? cell : styleText(cell,operation.style)).join(' || ');
      } else if (operation.op==='row') {
        if (!Array.isArray(operation.cells) || ![2,3].includes(operation.cells.length) || operation.cells.some(cell=>typeof cell!=='string' || /\n| \|\| /.test(cell))) fail('cells 必须是 2 或 3 个单行字符串');
        const widths=operation.widths || '1:1:1'; if (!/^[1-9]:[1-9]:[1-9]$/.test(widths)) fail('widths 例如 1:2:1');
        const existing=inspect(result.markdown).rows.find(row=>row.line===lineIndex+1);
        if (existing && (!existing.endLine || existing.endLine!==existing.startLine+2)) fail('row 操作目前要求每个 row 块只包含一行');
        const start=existing ? existing.startLine-1 : lineIndex; const count=existing ? existing.endLine-existing.startLine+1 : 1;
        lines.splice(start,count,`::: row${operation.cells.length===3 && widths!=='1:1:1'?' '+widths:''}`,operation.cells.join(' || '),':::');
      } else if (operation.op==='insert' || operation.op==='gap') {
        const after=operation.position!=='before';
        let at=lineIndex+(after?1:0);
        const row=inspect(result.markdown).rows.find(row=>row.line===lineIndex+1);
        if (operation.op==='gap' && row) at=after?row.endLine:row.startLine-1;
        let text=operation.text;
        if (operation.op==='gap') { if (!Number.isFinite(operation.mm) || operation.mm<0 || operation.mm>40) fail('mm 必须在 0–40 之间'); text=`::: gap ${operation.mm}mm`; }
        if (typeof text!=='string') fail('insert 需要 text');
        lines.splice(at,0,...text.split('\n'));
      } else if (operation.op==='remove') {
        const end=operation.endLine || lineIndex+1;
        if (!Number.isInteger(end) || end<lineIndex+1 || end>lines.length) fail('endLine 超出范围');
        lines.splice(lineIndex,end-lineIndex);
      } else fail(`未知操作：${operation.op}`);
      result.markdown=lines.join('\n');
    }
    validateMarkdown(result.markdown);
    return result;
  }
  function fitCandidates(input) {
    const original=document(input); const candidates=[{...original,settings:{...original.settings,targetPages:'1'}}];
    const steps=[{font:10.5,gap:3,inner:1,vertical:8,horizontal:10,factor:.95},{font:10,gap:2,inner:.5,vertical:6,horizontal:8,factor:.9},{font:9.5,gap:1,inner:.5,vertical:6,horizontal:8,factor:.85},{font:9,gap:.5,inner:0,vertical:6,horizontal:8,factor:.8},{font:9,gap:0,inner:0,vertical:6,horizontal:8,factor:.75}];
    for(const step of steps) {
      const settings=normalizeSettings({density:'compact',targetPages:'1',pageSpacing:'',marginTop:original.settings.marginTop?Math.min(Number(original.settings.marginTop),step.vertical):'',marginBottom:original.settings.marginBottom?Math.min(Number(original.settings.marginBottom),step.vertical):'',lineHeight:original.settings.lineHeight?Math.min(Number(original.settings.lineHeight),1.28):'',fontSize:Math.min(Number(original.settings.fontSize),step.font),experienceGap:Math.min(Number(original.settings.experienceGap),step.gap),...(original.settings.roleGap!==undefined?{roleGap:Math.min(Number(original.settings.roleGap)||0,step.gap/2)}:{}),experienceInner:Math.min(Number(original.settings.experienceInner),step.inner),marginVertical:Math.min(Number(original.settings.marginVertical),step.vertical),marginHorizontal:Math.min(Number(original.settings.marginHorizontal),step.horizontal)},original.settings);
      let fence=false;let blanks=0;
      const markdown=original.markdown.split('\n').flatMap(line=>{
        if(/^\s*```/.test(line)){fence=!fence;return [line];}
        if(fence)return [line];
        if(!line.trim()){blanks++;return blanks>1?[]:[line];}blanks=0;
        if(/^::: page[ \t]*$/.test(line))return [];
        const spacer=/^::: gap (\d+(?:\.\d+)?)(mm|pt|px)[ \t]*$/.exec(line);
        if(spacer)return [`::: gap ${step.inner===0?0:Math.round(Number(spacer[1])*step.factor*10)/10}${spacer[2]}`];
        if(/^:::/.test(line))return [line];
        return [line.split(' || ').map(cell=>{
          const parsed=styles.readLineStyle(cell);const heading=/^(#{1,6})[ \t]+/.exec(parsed.text);
          const current=parsed.style.size || (heading && heading[1].length<=3 ? [0,18,14,12][heading[1].length] : null);
          if(current===null)return cell;
          const size=Math.min(current,Math.max(9,Math.round(current*step.factor*2)/2));
          return styles.writeLineStyle(parsed.text,{...parsed.style,size});
        }).join(' || ')];
      }).join('\n');
      candidates.push({schemaVersion:1,markdown,settings});
    }
    return candidates;
  }
  return {defaults,settingSchema,normalizeSettings,document,inspect,apply,cleanSpaces,validateMarkdown,fitCandidates,fail};
});

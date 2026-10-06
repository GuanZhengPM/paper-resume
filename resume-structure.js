(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaperStructure = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const groups = {
    summary: ['个人总结', '个人简介', '个人优势', '自我介绍', 'Summary', 'Profile', 'Professional Summary'],
    education: ['教育经历', '教育背景', 'Education'],
    work: ['工作经历', '工作经验', 'Experience', 'Work Experience', 'Professional Experience'],
    internship: ['实习经历', 'Internships', 'Internship Experience'],
    projects: ['项目经历', '项目经验', '个人项目', 'Projects', 'Personal Projects'],
    campus: ['校园经历', '校园活动', '社会实践', 'Campus Experience', 'Activities'],
    research: ['科研经历', 'Research', 'Research Experience'],
    publications: ['论文发表', '论文', '学术论文', 'Publications'],
    skills: ['个人技能', '专业技能', '技术能力', '技术技能', '技能清单', '技能特长', 'Skills', 'Technical Skills'],
    awards: ['荣誉', '荣誉奖项', '获奖经历', 'Awards', 'Honors'],
    evaluation: ['个人技能与评价', '自我评价', '个人评价']
  };
  const datePattern = /(?:19|20)\d{2}(?:[.\/年-]\d{1,2}月?)?\s*[-–—~至]\s*(?:(?:19|20)\d{2}(?:[.\/年-]\d{1,2}月?)?|至今|现在|Present|Current)/i;
  const stripStyle = value => value.replace(/\s+\{(?:size|align|rule|underline)=[^{}]*\}\s*$/, '');
  const plain = value => stripStyle(value).replace(/\*\*|__/g, '').trim();
  function typeOf(title) {
    const text = plain(title).replace(/[：:]$/, '').toLowerCase();
    return Object.keys(groups).find(key => groups[key].some(name => name.toLowerCase() === text)) || 'other';
  }
  function fail(message) { const error = new Error(message); error.code = 'INVALID_STRUCTURE'; throw error; }
  function string(value, label) { if (typeof value !== 'string') fail(label + ' 必须是字符串'); return value; }
  function validate(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.sections)) fail('structure 需要 version:1、header 和 sections');
    string(input.header, 'header');
    let count = 0;
    const ids = new Set();
    function blocks(values, depth = 0) {
      if (!Array.isArray(values) || depth > 8) fail('无效或嵌套过深的 blocks');
      return values.map(block => {
        if (!block || ++count > 10000) fail('文档块过多或无效');
        const result = {kind: block.kind};
        if (block.id !== undefined) {
          if (typeof block.id !== 'string' || !block.id || ids.has(block.id)) fail('块 ID 必须唯一');
          ids.add(block.id); result.id = block.id;
        }
        if (['paragraph', 'raw'].includes(block.kind)) result.text = string(block.text, 'text');
        else if (block.kind === 'list') {
          if (!Array.isArray(block.items) || !block.items.length) fail('列表 items 不能为空');
          result.items = block.items.map(text => string(text, 'item'));
          if (block.ordered) result.ordered = true;
        } else if (block.kind === 'entry') {
          result.title = string(block.title, 'title');
          for (const key of ['subtitle', 'date', 'location', 'headingStyle']) if (block[key] !== undefined) result[key] = string(block[key], key);
          if(result.headingStyle&&!/^\{(?:size|align|rule|underline)=[^{}\n]*\}$/.test(result.headingStyle))fail('headingStyle 必须是有效的局部样式后缀');
          result.blocks = blocks(block.blocks || [], depth + 1);
        } else fail('未知块类型：' + block.kind);
        return result;
      });
    }
    const sections = input.sections.map((section, index) => {
      if (!section || typeof section !== 'object') fail('无效章节');
      const title = string(section.title, '章节 title');
      const id = section.id || 'section-' + (index + 1);
      if (typeof id !== 'string' || ids.has(id)) fail('章节 ID 必须唯一');
      ids.add(id);
      return {id, title, type: typeOf(title), blocks: blocks(section.blocks)};
    });
    return {version: 1, header: input.header, sections};
  }
  function parse(markdown) {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const header = [], sections = [];
    let section, entry, serial = 0;
    const destination = () => entry ? entry.blocks : section.blocks;
    const push = block => { block.id = 'block-' + (++serial); destination().push(block); return block; };
    const ensureSection = () => {
      if (!section) { section = {id:'section-1', title:'', type:'other', blocks:[]}; sections.push(section); }
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const heading = /^##\s+(.+)$/.exec(line) || (/^###\s+(.+)$/.test(line) && typeOf(line.replace(/^###\s+/,''))!=='other' ? /^###\s+(.+)$/.exec(line) : null);
      if (heading) {
        section = {id:'section-' + (sections.length + 1), title:heading[1], type:typeOf(heading[1]), blocks:[]};
        sections.push(section); entry = null; continue;
      }
      if (/^```|^~~~/.test(line)) {
        const raw = [line], fence = line.slice(0, 3);
        while (++i < lines.length) { raw.push(lines[i]); if (lines[i].startsWith(fence)) break; }
        if (!section) header.push(raw.join('\n')); else push({kind:'raw', text:raw.join('\n')});
        continue;
      }
      const directive = /^::: (center|left|right|row)(?: [1-9]:[1-9]:[1-9])?\s*$/.exec(line);
      if (directive) {
        const raw = [line], body = [];
        while (++i < lines.length) { raw.push(lines[i]); if (/^:::\s*$/.test(lines[i])) break; body.push(lines[i]); }
        if (!section) { header.push(raw.join('\n')); continue; }
        if (directive[1] === 'row' && body.filter(x=>x.trim()).length === 1) {
          const cells = body.find(x=>x.trim()).split(/\s*\|\|\s*/).map(x=>x.trim());
          if ([2, 3].includes(cells.length) && datePattern.test(plain(cells.at(-1)))) {
            if (entry && !entry.blocks.length && !entry.date) {
              const role=cells.slice(0, -1).join(' · ');if(role)entry.subtitle = role;entry.date = cells.at(-1);
            } else {
              entry = null;
              entry = push({kind:'entry', title:cells[0], ...(cells.length===3?{subtitle:cells[1]}:{}), date:cells.at(-1), blocks:[]});
            }
            continue;
          }
        }
        push({kind:'raw', text:raw.join('\n')}); continue;
      }
      if (!section) { header.push(line); continue; }
      if (!line.trim()) continue;
      const title = /^#{3,4}\s+(.+)$/.exec(line);
      if (title) {
        entry = null;
        const content=stripStyle(title[1]),headingStyle=title[1].slice(content.length).trim();
        const pieces = content.split(' | '), right = pieces.length > 1 ? pieces.pop() : '';
        const left=pieces.join(' | ').split(' · '), name=left.shift();
        entry = push({kind:'entry', title:name, ...(left.length?{subtitle:left.join(' · ')}:{}), ...(right?{[datePattern.test(plain(right))?'date':'location']:right}:{}), ...(headingStyle?{headingStyle}:{}), blocks:[]});
        continue;
      }
      const bullet = /^(?:[-+*] |\d+[.)] )(.+)$/.exec(line);
      if (bullet) {
        const items = [bullet[1]], ordered = /^\d/.test(line);
        while (i + 1 < lines.length) {
          const next = lines[i + 1], item = /^(?:[-+*] |\d+[.)] )(.+)$/.exec(next);
          if (item && /^\d/.test(next) === ordered) { items.push(item[1]); i++; }
          else if (/^ {2,}\S/.test(next)) { items[items.length - 1] += '\n' + next.trimStart(); i++; }
          else break;
        }
        push({kind:'list', items, ...(ordered?{ordered:true}:{})}); continue;
      }
      if (/^:::|^!\[|^\||^---\s*$/.test(line)) { push({kind:'raw', text:line}); continue; }
      const paragraph = [line];
      while (i + 1 < lines.length && lines[i + 1].trim() && !/^(?:#|:::|[-+*] |\d+[.)] |!\[|\||```|~~~)/.test(lines[i + 1])) paragraph.push(lines[++i]);
      ensureSection(); push({kind:'paragraph', text:paragraph.join('\n')});
    }
    return validate({version:1, header:header.join('\n').trim(), sections});
  }
  function serialize(input, options = {}) {
    const data = validate(input), profile = options.profile || {};
    let sections = data.sections;
    if (options.reorder && profile.order) {
      const rank = section => { const at = profile.order.indexOf(section.type); return at < 0 ? profile.order.length : at; };
      sections = [...sections].sort((a,b)=>rank(a)-rank(b));
    }
    const output = [data.header];
    function renderBlocks(blocks){
      let result='';for(let i=0;i<blocks.length;i++){
        const adjacentParagraphs=options.compactParagraphs&&blocks[i].kind==='paragraph'&&blocks[i-1]?.kind==='paragraph';
        result+=(i?(adjacentParagraphs?'\n':'\n\n'):'')+render(blocks[i]);
      }return result;
    }
    const strong = text => /\*\*/.test(text) ? text : '**' + text + '**';
    function render(block) {
      if (block.kind === 'paragraph' || block.kind === 'raw') return block.text;
      if (block.kind === 'list') return block.items.map((text,i)=>(block.ordered?(i+1)+'. ':'- ')+text.replace(/\n/g,'\n  ')).join('\n');
      const title = block.title, subtitle = block.subtitle || '', date = block.date || '', location = block.location || '';
      let heading;
      if (profile.entry === 'stacked') {
        heading = '### ' + strong(title) + (location?' | '+location:!subtitle&&date?' | '+date:'');
        if (subtitle && date) heading += '\n\n::: row\n' + subtitle + ' || ' + date + '\n:::';
        else if (date && location) heading += '\n\n::: row\n  || ' + date + '\n:::';
        else if (subtitle) heading += '\n\n' + subtitle;
      } else {
        heading = '### ' + strong(title) + (subtitle?' · '+subtitle:'') + (location?' | '+location:date?' | '+date:'');
        if(location&&date)heading += '\n\n::: row\n  || ' + date + '\n:::';
      }
      if(block.headingStyle)heading=heading.replace(/^(.*)$/m,'$1 '+block.headingStyle);
      return [heading, renderBlocks(block.blocks)].filter(Boolean).join('\n\n');
    }
    for (const section of sections) {
      if (!section.blocks.length && options.omitEmpty) continue;
      if (section.title) output.push('## ' + section.title);
      output.push(renderBlocks(section.blocks));
    }
    return output.filter(x=>x.trim()).join('\n\n').trim() + '\n';
  }
  function edit(markdown, operation, profile) {
    const data = parse(markdown);
    if (operation.op === 'set-structure') return serialize(operation.structure, {profile});
    if (operation.op === 'move-section') {
      const index = data.sections.findIndex(x=>x.id===operation.id);
      if (index < 0) fail('找不到章节 ID，请重新读取 structure');
      if (!Number.isInteger(operation.index) || operation.index < 0 || operation.index >= data.sections.length) fail('index 超出章节范围（从 0 开始）');
      const [section] = data.sections.splice(index,1); data.sections.splice(operation.index,0,section);
    } else if (operation.op === 'edit-block') {
      let found = false;
      function visit(blocks) { for (let i=0;i<blocks.length;i++) {
        if (blocks[i].id === operation.id) {
          if (!operation.values || typeof operation.values !== 'object') fail('需要 values');
          blocks[i] = {...blocks[i], ...operation.values, id:blocks[i].id, kind:blocks[i].kind}; found = true;
        } else if (blocks[i].blocks) visit(blocks[i].blocks);
      }}
      data.sections.forEach(s=>visit(s.blocks));
      if (!found) fail('找不到块 ID，请重新读取 structure');
    } else fail('未知结构操作');
    return serialize(data, {profile});
  }
  function text(input) {
    const data = validate(input), values = [data.header];
    function visit(block) {
      if (block.text !== undefined) values.push(block.text);
      if (block.items) values.push(...block.items);
      if (block.kind === 'entry') { values.push(block.title, block.subtitle || '', block.date || '', block.location || ''); block.blocks.forEach(visit); }
    }
    data.sections.forEach(s=>{values.push(s.title);s.blocks.forEach(visit);});
    return values.join('\n');
  }
  const schema = {version:1, header:'姓名、联系方式等头部 Markdown', sections:[{id:'读取时生成的章节 ID', title:'章节名称', type:'自动识别的章节类型', blocks:[
    {kind:'entry', title:'公司、学校或项目名称', subtitle:'岗位、专业等', date:'起止时间', location:'可选地点', headingStyle:'可选局部标题样式，如 {size=12 rule=off}', blocks:[]},
    {kind:'paragraph', text:'完整段落'}, {kind:'list', items:['完整条目']}, {kind:'raw', text:'保留的 Markdown 排版或特殊内容'}
  ]}]};
  return {groups, typeOf, datePattern, parse, validate, serialize, edit, text, schema, plain};
});

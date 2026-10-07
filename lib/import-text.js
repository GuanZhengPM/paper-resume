'use strict';
const structure=require('../resume-structure');
const sectionNames=new Set(Object.values(structure.groups).flat().map(x=>x.toLowerCase()));
const bullet=/^(?:[·•●▪\uF0B7]\s*|[-+*]\s+|\d+[.)、]\s*)(.*)$/;
const heading=text=>sectionNames.has(text.replace(/[：:]$/,'').trim().toLowerCase());
const dated=text=>{const match=structure.datePattern.exec(text);return match&&match.index>0&&match.index+match[0].length===text.length?{label:text.slice(0,match.index).trim(),date:match[0]}:null;};
const literal=text=>text.replace(/([\\`*_\[\]#>|])/g,'\\$1');
function join(left,right){
  if (/[\p{Script=Han}]$/u.test(left)||/^[\p{Script=Han}，。；：！？、（）]/u.test(right))return left+right;
  if (/[A-Za-z]-$/.test(left)&&/^[a-z]/.test(right))return left.slice(0,-1)+right;
  return left+' '+right;
}
function analyze(text,{format='text'}={}){
  const lines=text.replace(/\r\n?/g,'\n').replace(/\u0000/g,'').split('\n').map(x=>x.trim());
  const out=[],warnings=[];let nameSeen=false,joinedLines=0;
  const boundary=value=>!value||heading(value)||bullet.test(value)||Boolean(dated(value));
  for(let i=0;i<lines.length;i++){
    let line=lines[i];if(!line)continue;
    if(!nameSeen){nameSeen=true;if(line.length<=60&&!heading(line)&&!/[\d@：:]/.test(line)){out.push('::: center','# '+literal(line),':::','');continue;}}
    if(heading(line)){
      // Some PDF text layers contain an obsolete heading immediately beneath the visible summary title.
      if(structure.typeOf(line)==='summary'&&structure.typeOf(lines[i+1]||'')==='education'&&!dated(lines[i+2]||'')&&/拥有|具备|熟悉|经验|experienced|professional/i.test(lines[i+2]||'')){
        warnings.push('跳过紧随个人总结的空教育标题；请对照原稿确认标题顺序。');i++;
      }
      out.push('','## '+literal(line.replace(/[：:]$/,'')),'');continue;
    }
    const entry=dated(line);
    if(entry){
      let cells=entry.label.split(/\s{2,}/).filter(Boolean);
      if(cells.length===1){const match=/^(.+)\s+([^\s]*(?:经理|工程师|实习生|辩手|法学|法律|本科|硕士|博士|设计师)[^\s]*)$/.exec(entry.label);if(match)cells=[match[1],match[2]];}
      if(cells.length>=2)out.push('','### **'+literal(cells[0])+'**','', '::: row',literal(cells.slice(1).join(' · '))+' || '+literal(entry.date),':::','');
      else out.push('','### **'+literal(entry.label)+'** | '+literal(entry.date),'');
      continue;
    }
    const item=bullet.exec(line);
    if(item){
      let body=item[1];
      while(i+1<lines.length&&!boundary(lines[i+1])){
        if(format==='docx')break;
        body=join(body,lines[++i]);joinedLines++;
      }
      const colon=body.indexOf('：');
      out.push('- '+(colon>=0&&colon<36?'**'+literal(body.slice(0,colon))+'**：'+literal(body.slice(colon+1)):literal(body)));continue;
    }
    const contact=/@|(?:电话|邮箱|微信|Phone|Email)\s*[：:]|https?:\/\//i.test(line);
    if(!contact&&format!=='docx')while(i+1<lines.length&&!boundary(lines[i+1])&&!/[。！？.!?]$/.test(line)){
      const next=lines[i+1];
      if(/@|(?:电话|邮箱|微信|Phone|Email)\s*[：:]/i.test(next))break;
      line=join(line,next);i++;joinedLines++;
    }
    // Keep each paragraph distinct; no artificial line break survives inside a recovered paragraph.
    out.push('',literal(line),'');
  }
  if(/\uFFFD/.test(text))warnings.push('原文件包含无法解码的字符，需要对照原稿核对。');
  const markdown=out.join('\n').replace(/\n{3,}/g,'\n\n').trim()+'\n';
  return {markdown,warnings,joinedLines};
}
module.exports={analyze,heading,join};

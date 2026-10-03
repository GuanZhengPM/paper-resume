(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaperRenderer = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function create(library, helpers) {
    const marked = new library.Marked();
    const {readLineStyle, lineStyleAttributes} = helpers;
const escapeHTML = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const defaultTextRenderer = new library.Renderer();
marked.use({
  gfm: true,
  breaks: true,
  hooks: {
    preprocess(source) {
      // Legacy explicit breaks already include a newline for source readability.
      return source.split(/(^[ \t]*(?:`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*(?:`{3,}|~{3,})[^\n]*(?:\n|$))/gm).map((part,index)=>index%2?part:part.replace(/(<br\s*\/?\s*>)\n[ \t]*/gi,'$1')).join('');
    },
    processAllTokens(tokens) {
      // Source separators around headings/lists/layout blocks are structural.
      // Two returns between ordinary paragraphs still leave a blank line.
      const spaced = [];
      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        spaced.push(token);
        if (token.type === 'space') continue;
        let whitespace = /(?:\n[ \t]*)+$/.exec(token.raw)?.[0] || '';
        while (tokens[index + 1]?.type === 'space') {
          whitespace += tokens[++index].raw;
        }
        const cornerImage=part=>part?.type==='paragraph'&&/^(?:!\[(?:二维码-(?:left|right)|标志-(?:左|left|right)|证件照(?:-左)?|photo)(?: \{crop=[^}]+\})?\]\([^)]+\)\s*)+$/i.test(part.text);
        const paragraphBreak=token.type==='paragraph'&&tokens[index+1]?.type==='paragraph'&&!cornerImage(token)&&!cornerImage(tokens[index+1]);
        const lines = (whitespace.match(/\n/g) || []).length - (paragraphBreak?1:2);
        if (lines > 0 && index + 1 < tokens.length) {
          spaced.push({type: 'blankLines', raw: '', lines});
        }
      }
      spaced.links = tokens.links;
      return spaced;
    }
  },
  renderer: {
    text(token) {
      if (token.tokens) return this.parser.parseInline(token.tokens);
      return defaultTextRenderer.text.call(this, token).replace(/ {2,}/g, spaces => `<span class="literal-spaces">${spaces}</span>`);
    },
    html({text}) { return /^<br\s*\/?\s*>$/i.test(text.trim()) ? '<br>' : escapeHTML(text); },
    image({text,href}) {
      if (!/^(?:data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+|assets\/[a-f0-9]{64}\.(?:png|jpg|webp)|templates\/(?:portrait\.(?:svg|png)|emblem\.svg))$/.test(href || '')) return escapeHTML(text || '');
      const match=/ \{crop=(\d+(?:,\d+){5})\}$/.exec(text||'');const bounds=match?match[1].split(',').map(Number):null;if(match)text=text.slice(0,match.index);const type=/^二维码-(?:left|right)$/.test(text||'')?'resume-qr'+(text==='二维码-left'?' qr-left':''):/^标志-(?:左|left|right)$/.test(text||'')?'resume-header-logo'+(text==='标志-right'?' logo-right':''):/^(证件照(?:-左)?|photo)$/i.test(text || '')?'resume-photo'+(text==='证件照-左'?' photo-left':''):'resume-logo';
      if(bounds&&bounds[2]>0&&bounds[3]>0&&bounds[4]>0&&bounds[5]>0&&bounds[0]+bounds[2]<=bounds[4]&&bounds[1]+bounds[3]<=bounds[5])return `<svg class="${type}" viewBox="${bounds.slice(0,4).join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHTML(text)}" data-aspect="${bounds[2]/bounds[3]}"><image href="${escapeHTML(href)}" width="${bounds[4]}" height="${bounds[5]}"/></svg>`;
      return `<img class="${type}" src="${escapeHTML(href)}" alt="${escapeHTML(text || '')}">`;
    },
    link({href, title, tokens}) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:\/\/|mailto:|tel:|#)/i.test(href)) return label;
      return `<a href="${escapeHTML(href)}"${title ? ` title="${escapeHTML(title)}"` : ''} target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
    heading({depth, tokens, text}) {
      const parsed = readLineStyle(text);
      text = parsed.text;
      const attrs = lineStyleAttributes(parsed.style);
      if (depth === 3 && text.includes(' | ')) {
        const at = text.lastIndexOf(' | ');
        return `<h3${attrs}><span class="entry-title">${marked.parseInline(text.slice(0, at))}</span><span class="entry-date">${marked.parseInline(text.slice(at + 3))}</span></h3>`;
      }
      return `<h${depth}${attrs}>${marked.parseInline(text)}</h${depth}>`;
    },
    paragraph({text}) {
      const parsed = readLineStyle(text);
      return `<p${lineStyleAttributes(parsed.style)}>${marked.parseInline(parsed.text)}</p>`;
    },
    listitem(token) {
      const parsed = readLineStyle(token.text);
      if (!Object.keys(parsed.style).length) return false;
      return `<li${lineStyleAttributes(parsed.style)}>${marked.parse(parsed.text)}</li>`;
    }
  },
  extensions: [{
    name: 'underlineText', level: 'inline',
    start(src) { return src.indexOf('++'); },
    tokenizer(src) {
      const match = /^\+\+([^\n]+?)\+\+/.exec(src);
      if (match) return {type: 'underlineText', raw: match[0], text: match[1]};
    },
    renderer(token) { return `<u>${marked.parseInline(token.text)}</u>`; }
  }, {
    name: 'styledLine', level: 'block',
    start(src) { const at = src.search(/^[^\n]+\s\{(?:size|rule|align|underline)=[^\n]+\}\s*$/m); return at < 0 ? undefined : at; },
    tokenizer(src) {
      const match = /^([^\n]+)(?:\n|$)/.exec(src);
      if (!match || /^(?:\s*#|\s*[-+*] |\s*\d+[.)] |:::|\s*>)/.test(match[1])) return;
      const parsed = readLineStyle(match[1]);
      if (Object.keys(parsed.style).length) return {type: 'styledLine', raw: match[0], ...parsed};
    },
    renderer(token) { return `<p${lineStyleAttributes(token.style)}>${marked.parseInline(token.text)}</p>`; }
  }, {
    name: 'blankLines',
    renderer(token) {
      return `<div class="layout-gap" style="height:${token.lines}lh" aria-hidden="true"></div>`;
    }
  }, {
    name: 'layout', level: 'block',
    start(src) { const at = src.search(/^::: /m); return at < 0 ? undefined : at; },
    tokenizer(src) {
      const spacing = /^::: page-spacing (\d+(?:\.\d+)?)mm[ \t]*(?:\n|$)/.exec(src);
      if (spacing) return {type: 'layout', raw: spacing[0], mode: 'spacing', amount: Math.min(Number(spacing[1]), 20)};
      const spacer = /^::: gap (\d+(?:\.\d+)?)(mm|pt|px)[ \t]*(?:\n|$)/.exec(src);
      if (spacer) return {type: 'layout', raw: spacer[0], mode: 'gap', amount: Math.min(Number(spacer[1]), 40), unit: spacer[2]};
      const page = /^::: page[ \t]*(?:\n|$)/.exec(src);
      if (page) return {type: 'layout', raw: page[0], mode: 'page'};
      const block = /^::: (center|right|left|row|keep)(?: ([1-9]:[1-9]:[1-9]))?[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(src);
      if (block && (!block[2] || block[1] === 'row')) return {type: 'layout', raw: block[0], mode: block[1], widths: block[2], body: block[3]};
    },
    renderer(token) {
      if (token.mode === 'spacing') return `<div class="page-spacing" data-spacing="${token.amount}" aria-hidden="true"></div>`;
      if (token.mode === 'gap') return `<div class="layout-gap" style="height:${token.amount}${token.unit}" aria-hidden="true"></div>`;
      if (token.mode === 'page') return '<div class="page-break" aria-hidden="true"></div>';
      if (token.mode === 'row') {
        return token.body.split('\n').filter(line => line.trim()).map(line => {
          const cells = line.split(' || ');
          if (cells.length < 2 || cells.length > 3) return `<p class="layout-error">row 需要用空格 + || + 空格分隔 2 或 3 列：${escapeHTML(line)}</p>`;
          const widths = cells.length === 3 && token.widths ? ` style="grid-template-columns:${token.widths.split(':').map(n => `minmax(0,${n}fr)`).join(' ')}"` : '';
          return `<div class="layout-row" data-columns="${cells.length}"${widths}>${cells.map(cell => { const parsed = readLineStyle(cell.trim()); return `<div${lineStyleAttributes(parsed.style)}>${marked.parseInline(parsed.text)}</div>`; }).join('')}</div>`;
        }).join('');
      }
      return `<div class="layout-${token.mode}">${marked.parse(token.body)}</div>`;
    }
  }]
});

return {parse: text => marked.parse(text), inline: text => marked.parseInline(text), decorate: decorateExperiences};
}
function decorateExperiences(resume) {
  // Keep corner images out of text flow; share each side without overlap.
  let imagePage=[],pageElements=[];
  const placeImages=()=>{
    const content=pageElements.filter(el=>!el.matches('.page-spacing,.layout-gap')&&!el.matches('p:has(> .resume-header-logo),p:has(> .resume-photo),p:has(> .resume-qr)'));
    const section=content.slice(1).find(el=>/^H[1-6]$/.test(el.tagName));
    if(section){for(const img of imagePage){const available=(section.getBoundingClientRect().top-img.parentElement.getBoundingClientRect().top)*25.4/96;const photo=img.matches('.resume-photo');const qr=img.matches('.resume-qr');const height=Math.min(photo?31:qr?18:16,Math.max(1,available+(photo?1:-1)));img.style.height=height+'mm';if(photo)img.style.width=(height*24/31)+'mm';if(qr)img.style.width=height+'mm';}}
    const photos=imagePage.filter(img=>img.matches('.resume-photo'));
    for(const side of ['left','right']){const fixed=imagePage.filter(img=>img.matches('.resume-photo,.resume-qr')&&(img.matches('.photo-left,.qr-left')?'left':'right')===side);const reserved=imagePage.some(img=>img.matches('.resume-header-logo')&&(img.matches('.logo-right')?'right':'left')===side)?30:42;const total=fixed.reduce((sum,img)=>sum+img.getBoundingClientRect().width*25.4/96,0);const scale=Math.min(1,(reserved-Math.max(0,fixed.length-1)*3)/Math.max(1,total));if(scale<1)for(const img of fixed){img.style.width=img.getBoundingClientRect().width*25.4/96*scale+'mm';img.style.height=img.getBoundingClientRect().height*25.4/96*scale+'mm';}}
    const occupied=side=>Math.max(0,...photos.filter(img=>(img.matches('.photo-left')?'left':'right')===side).map(img=>img.getBoundingClientRect().width*25.4/96+3));
    const offsets={left:occupied('left'),right:occupied('right')};
    for(const qr of imagePage.filter(img=>img.matches('.resume-qr'))){const side=qr.matches('.qr-left')?'left':'right';qr.style[side]=offsets[side]+'mm';offsets[side]+=qr.getBoundingClientRect().width*25.4/96+3;}
    for(const side of ['left','right']){
      const logos=imagePage.filter(img=>img.matches('.resume-header-logo')&&(img.matches('.logo-right')?'right':'left')===side);
      if(!logos.length)continue;
      const availableWidth=Math.max(1,42-offsets[side]);
      const availableHeight=section?Math.max(1,(section.getBoundingClientRect().top-logos[0].parentElement.getBoundingClientRect().top)*25.4/96-2):31;
      const gap=logos.length>4?1.5:3;let best;
      const icons=logos.length<=6&&logos.every(img=>Number(img.dataset.aspect)>=.6&&Number(img.dataset.aspect)<=1.5);for(let columns=icons?logos.length:1;columns<=logos.length;columns++){
        const rows=Math.ceil(logos.length/columns),width=Math.min(18,Math.max(.1,(availableWidth-(columns-1)*gap)/columns)),height=Math.min(16,Math.max(.1,(Math.min(31,availableHeight)-(rows-1)*1.5)/rows));
        const score=logos.reduce((sum,img)=>sum+Math.min(width,height*(Number(img.dataset.aspect)||18/16)),0);
        if(!best||score>best.score)best={columns,width,height,score};
      }
      logos.forEach((img,index)=>{img.style[side]=(offsets[side]+index%best.columns*(best.width+gap))+'mm';img.style.top=(Math.floor(index/best.columns)*(best.height+1.5))+'mm';img.style.width=best.width+'mm';img.style.height=best.height+'mm';});
    }
  };
  let spacing = null;
  const elements = [...resume.children].filter(element => {
    if (element.matches('.page-break')) spacing = null;
    if (element.matches('.page-spacing')) { spacing = element.dataset.spacing; return false; }
    if (spacing !== null) element.style.setProperty('--page-spacing', spacing + 'mm');
    return true;
  });
  let activeLevel = 0;
  let hasPrevious = false;
  elements.forEach((element, index) => {
    const heading = /^H[1-6]$/.test(element.tagName);
    const next = elements.slice(index + 1).find(el => !el.matches('.layout-gap'));
    const previous = elements.slice(0,index).reverse().find(el => !el.matches('.layout-gap'));
    const standaloneRow = element.matches('.layout-row[data-columns="3"]') && !previous?.classList.contains('experience-title');
    if (standaloneRow && activeLevel) {
      element.classList.add('role-title');
      return;
    }
    const isEntry = (heading && (next?.matches('.layout-row') || element.querySelector('.entry-title'))) || standaloneRow;
    if (isEntry) {
      element.classList.add('experience-title');
      if (hasPrevious) element.classList.add('experience-separated');
      activeLevel = heading ? Number(element.tagName[1]) : 4;
      hasPrevious = true;
    } else if (heading && (!activeLevel || Number(element.tagName[1]) <= activeLevel)) {
      activeLevel = 0;
      hasPrevious = false;
    } else if (activeLevel) element.classList.add('experience-content');
  });
  for(const element of resume.children){if(element.matches('.page-break')){placeImages();imagePage=[];pageElements=[];continue;}pageElements.push(element);imagePage.push(...element.querySelectorAll('.resume-header-logo,.resume-photo,.resume-qr'));}
  placeImages();
}

return {create, decorateExperiences};
});

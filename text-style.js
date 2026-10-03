function readLineStyle(text) {
  const match = /\s+\{([^{}\n]+)\}\s*$/.exec(text);
  const style = {};
  if (!match) return {text, style};
  const fields = match[1].trim().split(/\s+/);
  for (const field of fields) {
    const [key, value, extra] = field.split('=');
    if (extra !== undefined) return {text, style: {}};
    if (key === 'size' && Number(value) >= 8 && Number(value) <= 36) style.size = Number(value);
    else if (key === 'align' && ['left','center','right'].includes(value)) style.align = value;
    else if (['rule','underline'].includes(key) && ['on','off'].includes(value)) style[key] = value;
    else return {text, style: {}};
  }
  return {text: text.slice(0, match.index), style};
}

function writeLineStyle(text, patch) {
  const parsed = readLineStyle(text);
  const style = {...parsed.style, ...patch};
  const fields = ['size','rule','align','underline'].filter(key => style[key] !== undefined && style[key] !== '').map(key => `${key}=${style[key]}`);
  return parsed.text + (fields.length ? ` {${fields.join(' ')}}` : '');
}

function lineStyleAttributes(style) {
  const css = [];
  if (style.size) css.push(`font-size:${style.size}pt`);
  if (style.align) css.push(`text-align:${style.align}`);
  if (style.rule === 'on') css.push('border-bottom:0.35mm solid var(--accent)', 'padding-bottom:0.6mm');
  if (style.rule === 'off') css.push('border-bottom:0', 'padding-bottom:0');
  if (style.underline) css.push(`text-decoration:${style.underline === 'on' ? 'underline' : 'none'}`);
  return css.length ? ` class="line-styled" style="${css.join(';')}"` : '';
}

function styledLineRange(value, start, end) {
  const bounds = selectedLines(value, start, end);
  const line = value.slice(bounds.start, bounds.end);
  if (!line.includes(' || ')) return bounds;
  // Within a row, style the column containing the caret (or the selected columns).
  let at = bounds.start;
  const cells = line.split(' || ').map(cell => {
    const range = {start: at, end: at + cell.length};
    at += cell.length + 4;
    return range;
  });
  const active = cells.filter(cell => start === end ? start >= cell.start && start <= cell.end : start < cell.end && end > cell.start);
  return active.length === 1 ? active[0] : bounds;
}

if (typeof module !== 'undefined') module.exports = {readLineStyle, writeLineStyle, lineStyleAttributes};

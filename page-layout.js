function estimatePagination(blocks, available) {
  let pages = 1;
  let used = 0;
  const boundaries = [];
  const nextPage = position => { boundaries.push(position); pages++; used = 0; };
  blocks.forEach((block, index) => {
    if (block.manual) {
      if (used > 0) nextPage(block.top);
      return;
    }
    let gap = used ? block.gap : 0;
    let minimum = block.atomic ? block.height : Math.min(block.height, block.lineHeight * 2);
    if (block.keepNext) {
      for (let next = index + 1; next < blocks.length; next++) {
        const following = blocks[next];
        if (following.manual) break;
        minimum += following.gap + (following.atomic ? following.height : Math.min(following.height, following.lineHeight * 2));
        if (!following.keepNext) break;
      }
    }
    if (used && used + gap + Math.min(minimum, available) > available + 0.5) { nextPage(block.top); gap = 0; }
    let height = gap + block.height;
    while (used + height > available + 0.5) {
      const consumed = available - used;
      height -= consumed;
      nextPage(block.top + block.height - height);
    }
    used += height;
  });
  return {pages, used, boundaries, remaining: Math.max(0, available - used)};
}

function updateLayoutPreview({resume, editor, targetPages, showGuides}) {
  const pxPerMm = 96 / 25.4;
  const stage = document.querySelector('.paper-stage');
  const scale = Math.min(1, Math.max(0.3, (stage.clientWidth - 24) / (210 * pxPerMm)));
  resume.style.setProperty('--preview-zoom', scale);
  const style = getComputedStyle(resume);
  const topPadding = parseFloat(style.paddingTop);
  const available = 297 * pxPerMm - topPadding - parseFloat(style.paddingBottom);
  const origin = resume.getBoundingClientRect().top;
  const elements = [...resume.children].flatMap(element => element.matches('ul,ol') ? [...element.children] : [element]);
  let previousBottom = topPadding;
  let previousManual = false;
  const blocks = elements.map(element => {
    const rect = element.getBoundingClientRect();
    const top = (rect.top - origin) / scale;
    const height = rect.height / scale;
    const gap = previousManual ? 0 : Math.max(0, top - previousBottom);
    previousBottom = top + height;
    previousManual = element.matches('.page-break');
    const css = getComputedStyle(element);
    return {top, height, gap, manual: element.matches('.page-break'), atomic: element.matches('h1,h2,h3,h4,li,.layout-row,.layout-keep,table'), keepNext: element.matches('h1,h2,h3,h4,.layout-row'), lineHeight: parseFloat(css.lineHeight) || parseFloat(style.lineHeight)};
  });
  const prediction = estimatePagination(blocks, available);
  const target = Number(targetPages.value);
  const overflow = prediction.pages > target;
  const lastRemainingMm = prediction.remaining / pxPerMm;
  const remaining = overflow ? 0 : ((target - prediction.pages) * available + prediction.remaining) / pxPerMm;
  const lineHeight = parseFloat(style.lineHeight);
  const lines = Math.max(0, Math.floor(remaining * pxPerMm / lineHeight));
  const usedTotal = (prediction.pages - 1) * available + prediction.used;
  const percent = Math.round(usedTotal / (target * available) * 100);
  document.getElementById('page-estimate').textContent = `预计 ${prediction.pages} 页 A4 · 目标 ${target} 页`;
  document.getElementById('text-count').textContent = `${resume.textContent.replace(/\s/g, '').length} 字符`;
  document.getElementById('space-remaining').textContent = overflow ? `超出目标 ${prediction.pages - target} 页 · 末页还剩约 ${Math.round(lastRemainingMm)}mm` : `还可用约 ${Math.round(remaining)}mm / ${lines} 行正文`;
  document.getElementById('layout-height').textContent = `已用约 ${Math.round(usedTotal / pxPerMm)}mm · ${percent}%`;
  document.querySelector('.page-meter').dataset.overflow = String(overflow);
  const progress = document.getElementById('page-progress');
  progress.setAttribute('aria-valuenow', String(Math.min(100, percent)));
  progress.firstElementChild.style.width = `${Math.min(100, percent)}%`;
  const status = document.getElementById('page-status');
  status.dataset.overflow = String(overflow);
  status.textContent = `预计 ${prediction.pages} 页 · 末页已用约 ${Math.round(prediction.used / available * 100)}%`;
  const guides = document.getElementById('page-guides');
  guides.replaceChildren();
  if (showGuides.checked) prediction.boundaries.forEach((position, index) => {
    const line = document.createElement('div');
    line.className = 'page-guide';
    line.style.top = `${position * scale}px`;
    const label = document.createElement('span');
    label.textContent = `第 ${index + 1} 页预计结束`;
    line.append(label);
    guides.append(line);
  });
  return prediction;
}

if (typeof module !== 'undefined') module.exports = {estimatePagination};

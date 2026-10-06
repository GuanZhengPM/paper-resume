'use strict';
window.PaperImageDrag={create({panel,reset,onBegin,onEnd,onMove,onError}){
 let selected=null,drag=null,revision=null;
 const surfaces=()=>[...panel.querySelectorAll('.pdf-page-surface')];
 function position(button,box){const surface=surfaces().find(s=>Number(s.dataset.page)===box.page);if(!surface)return;surface.append(button);button.style.left=box.x/Number(surface.dataset.width)*100+'%';button.style.top=box.y/Number(surface.dataset.height)*100+'%';button.style.width=box.width/Number(surface.dataset.width)*100+'%';button.style.height=box.height/Number(surface.dataset.height)*100+'%';button._box={...box};}
 function select(button){selected?.classList.remove('selected');selected=button;button?.classList.add('selected');reset.hidden=!button;reset.disabled=!button;}
 async function save(button,box){try{await onMove(button.dataset.imageId,box,revision);}catch(error){onError(error.message);}finally{onEnd();}}
 function update(){if(!drag)return;const {clientX,clientY,button,offsetX,offsetY}=drag;
  if(drag.corner){
   const surface=surfaces().find(s=>Number(s.dataset.page)===drag.original.page),rect=surface.getBoundingClientRect(),pageWidth=Number(surface.dataset.width),pageHeight=Number(surface.dataset.height),old=drag.original;
   const left=drag.corner.includes('w'),top=drag.corner.includes('n'),anchorX=left?old.x+old.width:old.x,anchorY=top?old.y+old.height:old.y;
   const dx=(left?-old.width:old.width)+(clientX-drag.startX)/rect.width*pageWidth,dy=(top?-old.height:old.height)+(clientY-drag.startY)/rect.height*pageHeight;
   // Project the pointer onto the diagonal to preserve the original aspect ratio.
   const ratio=old.width/old.height,requested=(dx*(left?-ratio:ratio)+dy*(top?-1:1))/(ratio*ratio+1);
   const maxHeight=Math.min(button.dataset.kind==='照片'?65:pageHeight,(left?anchorX:pageWidth-anchorX)/ratio,top?anchorY:pageHeight-anchorY),minHeight=Math.min(button.dataset.kind==='照片'?8:4,maxHeight);
   const height=Math.max(minHeight,Math.min(requested,maxHeight)),width=height*ratio;
   position(button,{...old,x:left?anchorX-width:anchorX,y:top?anchorY-height:anchorY,width,height});return;
  }
  const surface=surfaces().reduce((best,s)=>{const r=s.getBoundingClientRect(),distance=Math.max(r.top-clientY,clientY-r.bottom,0);return !best||distance<best.distance?{s,distance}:best;},null)?.s;if(!surface)return;
  const rect=surface.getBoundingClientRect(),w=Number(surface.dataset.width),h=Number(surface.dataset.height),box={...drag.original,page:Number(surface.dataset.page)};
  box.x=Math.max(0,Math.min((clientX-rect.left)/rect.width*w-offsetX,w-box.width));box.y=Math.max(0,Math.min((clientY-rect.top)/rect.height*h-offsetY,h-box.height));position(button,box);
 }
 function scroll(){if(!drag)return;const r=panel.getBoundingClientRect();if(!drag.corner&&drag.clientY>r.bottom-45)panel.scrollTop+=14;else if(!drag.corner&&drag.clientY<r.top+45)panel.scrollTop-=14;update();drag.raf=requestAnimationFrame(scroll);}
 function finish(cancel=false){if(!drag)return;const active=drag;drag=null;cancelAnimationFrame(active.raf);panel.releasePointerCapture?.(active.pointerId);active.button.classList.remove('dragging','resizing');
  const box=active.button._box,old=active.original,changed=box.page!==old.page||Math.abs(box.x-old.x)>.1||Math.abs(box.y-old.y)>.1||Math.abs(box.height-old.height)>.1;
  if(cancel||!changed){position(active.button,old);onEnd();return;}save(active.button,{page:box.page,x:box.x,y:box.y,...(active.corner?{width:box.width,height:box.height}:{})});
 }
 panel.addEventListener('pointerdown',event=>{const button=event.target.closest('.preview-image');if(!button){select(null);return;}select(button);button.focus();if(event.button!==0||!onBegin(revision))return;event.preventDefault();const r=button.getBoundingClientRect(),box=button._box;drag={corner:event.target.closest('[data-resize]')?.dataset.resize,button,original:{...box},pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,clientX:event.clientX,clientY:event.clientY,offsetX:(event.clientX-r.left)/r.width*box.width,offsetY:(event.clientY-r.top)/r.height*box.height};panel.setPointerCapture(event.pointerId);button.classList.add(drag.corner?'resizing':'dragging');drag.raf=requestAnimationFrame(scroll);});
 panel.addEventListener('pointermove',event=>{if(drag){drag.clientX=event.clientX;drag.clientY=event.clientY;update();}});
 window.addEventListener('blur',()=>finish(true));panel.addEventListener('pointerup',()=>finish());panel.addEventListener('pointercancel',()=>finish(true));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();finish(true);}});
 panel.addEventListener('keydown',event=>{const button=event.target.closest('.preview-image');if(!button||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||drag)return;event.preventDefault();if(!onBegin(revision))return;select(button);const step=event.shiftKey?5:1,box={...button._box},surface=button.parentElement;box.x=Math.max(0,Math.min(box.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),Number(surface.dataset.width)-box.width));box.y=Math.max(0,Math.min(box.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),Number(surface.dataset.height)-box.height));position(button,box);save(button,{page:box.page,x:box.x,y:box.y});});
 reset.addEventListener('click',()=>{if(selected&&onBegin(revision))save(selected,null);});
 return {setRevision:value=>{revision=value;},isDragging:()=>Boolean(drag),install(images,rev){select(null);revision=rev;for(const item of images){const button=document.createElement('button');button.type='button';button.className='preview-image';button.dataset.imageId=item.id;button.dataset.kind=item.kind;button.title='拖动移动'+item.kind+'，拖动四角缩放；方向键微调，Esc 取消';button.setAttribute('aria-label','移动'+item.kind);const image=document.createElement('img');image.src=item.data;image.alt='';image.draggable=false;button.append(image);for(const corner of ['nw','ne','sw','se']){const handle=document.createElement('span');handle.className='image-resize-handle handle-'+corner;handle.dataset.resize=corner;handle.title='等比例缩放';handle.setAttribute('aria-hidden','true');button.append(handle);}position(button,item);button.addEventListener('focus',()=>select(button));}}};
}};

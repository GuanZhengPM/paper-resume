'use strict';
const MARKER='https://paper-resume.invalid/image/';
// Use print link rectangles to locate images on actual PDF pages, including natural page breaks.
async function prepare(page){
 return page.evaluate(async prefix=>{
  const records=[],seen=new Map();
  for(const img of document.querySelectorAll('#resume .resume-photo,#resume .resume-header-logo,#resume .resume-qr,#resume .resume-logo')){
   const svg=img.tagName.toLowerCase()==='svg',source=svg?img.querySelector('image').getAttribute('href'):img.getAttribute('src');
   const kind=img.matches('.resume-photo')?'照片':img.matches('.resume-qr')?'二维码':'Logo';
   const key=kind+':'+source,occurrence=seen.get(key)||0;seen.set(key,occurrence+1);
   let loaded=img;if(svg){loaded=new Image();loaded.src=source;await loaded.decode();}else await img.decode();
   const crop=svg?img.getAttribute('viewBox').split(/\s+/).map(Number):[0,0,loaded.naturalWidth,loaded.naturalHeight];
   const canvas=document.createElement('canvas');canvas.width=crop[2];canvas.height=crop[3];canvas.getContext('2d').drawImage(loaded,...crop,0,0,canvas.width,canvas.height);
   if(getComputedStyle(img.parentElement).position==='static'){img.parentElement.dataset.markerPosition=img.parentElement.style.position;img.parentElement.style.position='relative';}
   const box=img.getBoundingClientRect(),parent=img.parentElement.getBoundingClientRect(),aspect=crop[2]/crop[3];const width=Math.min(box.width,box.height*aspect),height=width/aspect;
   const marker=document.createElement('a');marker.href=prefix+records.length;marker.textContent='\u200b';marker.dataset.imageMarker='true';Object.assign(marker.style,{position:'absolute',left:box.left-parent.left+(box.width-width)/2+'px',top:box.top-parent.top+(box.height-height)/2+'px',width:width+'px',height:height+'px',fontSize:'1px',color:'transparent'});
   img.parentElement.append(marker);img.dataset.previewVisibility=img.style.visibility;img.style.visibility='hidden';
   records.push({id:key+':'+occurrence,kind,data:canvas.toDataURL('image/png')});
  }
  return records;
 },MARKER);
}
async function cleanup(page){await page.evaluate(()=>{document.querySelectorAll('[data-image-marker]').forEach(el=>el.remove());document.querySelectorAll('[data-preview-visibility]').forEach(el=>{el.style.visibility=el.dataset.previewVisibility;delete el.dataset.previewVisibility;});document.querySelectorAll('[data-marker-position]').forEach(el=>{el.style.position=el.dataset.markerPosition;delete el.dataset.markerPosition;});});}
async function compose(buffer,records,positions={}){
 const {PDFDocument,PDFName,PDFArray,PDFDict,PDFString,PDFHexString}=require('./render').dependency('pdf-lib');
 const pdf=await PDFDocument.load(buffer),pages=pdf.getPages(),images=[];const mm=25.4/72;
 for(let index=0;index<pages.length;index++){
  const page=pages[index],annotations=page.node.lookupMaybe(PDFName.of('Annots'),PDFArray);if(!annotations)continue;
  for(let i=annotations.size()-1;i>=0;i--){const annotation=annotations.lookup(i,PDFDict),action=annotation.lookupMaybe(PDFName.of('A'),PDFDict);const uri=action?.lookup(PDFName.of('URI'));if(!(uri instanceof PDFString||uri instanceof PDFHexString))continue;const href=uri.decodeText();if(!href.startsWith(MARKER))continue;
   const record=records[Number(href.slice(MARKER.length))];if(!record)continue;const rect=annotation.lookup(PDFName.of('Rect'),PDFArray).asArray().map(n=>n.asNumber());annotations.remove(i);
   const box={page:index+1,x:rect[0]*mm,y:(page.getHeight()-rect[3])*mm,width:(rect[2]-rect[0])*mm,height:(rect[3]-rect[1])*mm};const saved=positions[record.id];const selected=saved&&saved.page<=pages.length?saved:box;const target=pages[selected.page-1];
   const pageWidth=target.getWidth()*mm,pageHeight=target.getHeight()*mm,width=Math.min(selected.width,pageWidth),height=Math.min(selected.height,pageHeight);
   images.push({...record,...selected,width,height,x:Math.max(0,Math.min(selected.x,pageWidth-width)),y:Math.max(0,Math.min(selected.y,pageHeight-height)),pageWidth,pageHeight,manual:Boolean(saved&&saved.page<=pages.length)});
  }
 }
 const basePdf=await pdf.save();
 for(const image of images){const embedded=await pdf.embedPng(image.data),page=pages[image.page-1];page.drawImage(embedded,{x:image.x/mm,y:page.getHeight()-(image.y+image.height)/mm,width:image.width/mm,height:image.height/mm});}
 return {pdf:await pdf.save(),basePdf,images};
}
module.exports={prepare,cleanup,compose};
async function screenshot(page,pdf,destination){
 await page.evaluate(async data=>{const pdfjs=await import('./vendor/pdf.mjs?v=6.4.299');pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.mjs?v=6.4.299';const doc=await pdfjs.getDocument({data:Uint8Array.from(atob(data),c=>c.charCodeAt(0))}).promise;const container=document.createElement('div');container.id='image-position-proof';container.style.cssText='width:794px;background:white;';document.body.append(container);try{for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),viewport=p.getViewport({scale:794/p.getViewport({scale:1}).width}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.display='block';container.append(canvas);await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;}}finally{await doc.loadingTask.destroy();}},Buffer.from(pdf).toString('base64'));
 try{await page.locator('#image-position-proof').screenshot({path:destination});}finally{await page.evaluate(()=>document.querySelector('#image-position-proof')?.remove());}
}
module.exports.screenshot=screenshot;

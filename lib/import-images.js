'use strict';
const images=require('./images');
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function asset(buffer,metadata){const result={...images.image(buffer),kind:'photo',...metadata};Object.defineProperty(result,'buffer',{value:buffer});return result;}
function choose(candidates){
 const unique=[...new Map(candidates.map(item=>[item.name,item])).values()];
 return {images:unique.length===1?unique:[],imageWarnings:unique.length>1?['页头有多张可能的证件照，已保留原文件；请由 Agent 对照原稿选择。']:[]};
}
async function pdfPortrait(page,pdfjs){
 const viewport=page.getViewport({scale:1}),list=await page.getOperatorList(),stack=[];let matrix=viewport.transform;const candidates=[];
 for(let i=0;i<list.fnArray.length;i++){
  const fn=list.fnArray[i],args=list.argsArray[i];
  if(fn===pdfjs.OPS.save)stack.push([...matrix]);
  else if(fn===pdfjs.OPS.restore)matrix=stack.pop()||viewport.transform;
  else if(fn===pdfjs.OPS.transform)matrix=multiply(matrix,args);
  else if(fn===pdfjs.OPS.paintFormXObjectBegin){stack.push([...matrix]);if(args[0])matrix=multiply(matrix,args[0]);}
  else if(fn===pdfjs.OPS.paintFormXObjectEnd)matrix=stack.pop()||viewport.transform;
  else if(fn===pdfjs.OPS.paintImageXObject||fn===pdfjs.OPS.paintInlineImageXObject){
   const corners=[[0,0],[0,1],[1,0],[1,1]].map(([x,y])=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]]);
   const left=Math.min(...corners.map(p=>p[0])),top=Math.min(...corners.map(p=>p[1])),width=Math.max(...corners.map(p=>p[0]))-left,height=Math.max(...corners.map(p=>p[1]))-top;
   // A single small portrait in a page-one header corner; never treat a full-page scan or square logo as a photo.
   if(top<0||top>viewport.height*.2||width<34||width>156||height<45||height>185||width/height<.55||width/height>.92||!(left>viewport.width*.6||left+width<viewport.width*.4))continue;
   const data=fn===pdfjs.OPS.paintInlineImageXObject?args[0]:await new Promise(resolve=>(args[0].startsWith('g_')?page.commonObjs:page.objs).get(args[0],resolve));
   if(!data||data.width*data.height>20000000||data.width<32||data.height<32)continue;
   const {createCanvas}=require('./render').dependency('@napi-rs/canvas'),canvas=createCanvas(data.width,data.height),ctx=canvas.getContext('2d');
   if(data.bitmap)ctx.drawImage(data.bitmap,0,0);
   else if([pdfjs.ImageKind.RGB_24BPP,pdfjs.ImageKind.RGBA_32BPP].includes(data.kind)){
    const pixels=ctx.createImageData(data.width,data.height),stride=data.kind===pdfjs.ImageKind.RGB_24BPP?3:4;
    for(let j=0,k=0;j<pixels.data.length;j+=4,k+=stride){pixels.data[j]=data.data[k];pixels.data[j+1]=data.data[k+1];pixels.data[j+2]=data.data[k+2];pixels.data[j+3]=stride===4?data.data[k+3]:255;}ctx.putImageData(pixels,0,0);
   }else continue;
   const buffer=canvas.toBuffer('image/png');if(buffer.length<=2*1024*1024)candidates.push(asset(buffer,{position:left>viewport.width/2?'right':'left',sourcePage:1,width:data.width,height:data.height,displayHeightMm:Math.round(height*25.4/72*100)/100}));
  }
 }
 return choose(candidates);
}
async function docxPortrait(zip,xml){
 const relationships=await zip.file('word/_rels/document.xml.rels')?.async('string');if(!relationships)return choose([]);
 const targets=new Map();for(const match of relationships.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)){const attrs=Object.fromEntries([...match[1].matchAll(/([\w:]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));if(attrs.TargetMode!=='External')targets.set(attrs.Id,attrs.Target);}
 const candidates=[],paragraphs=[...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].slice(0,6);
 for(const paragraph of paragraphs)for(const drawing of paragraph[1].matchAll(/<w:drawing\b[^>]*>([\s\S]*?)<\/w:drawing>/g)){
  const ref=/<a:blip\b[^>]*r:embed="([^"]+)"/.exec(drawing[1])?.[1],target=targets.get(ref);if(!target)continue;
  const extent=/<wp:extent\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(drawing[1]);if(!extent)continue;const width=Number(extent[1])/36000,height=Number(extent[2])/36000;
  if(width<12||width>55||height<16||height>65||width/height<.55||width/height>.92)continue;
  const name=require('node:path').posix.normalize(target.startsWith('/')?target.slice(1):'word/'+target);if(!name.startsWith('word/media/'))continue;const file=zip.file(name);if(!file||file._data?.uncompressedSize>2*1024*1024)continue;
  const buffer=await file.async('nodebuffer');try{candidates.push(asset(buffer,{position:/<wp:align>left<\/wp:align>/.test(drawing[1])?'left':'right',displayHeightMm:Math.round(height*100)/100}));}catch{}
 }
 return choose(candidates);
}
function attach(document,assets){for(const item of assets||[])if(item.buffer&&!/!\[(?:证件照(?:-左)?|photo)/i.test(document.markdown)){document=images.insert(document,item.buffer,'photo',undefined,undefined,{position:item.position,dryRun:true});if(item.displayHeightMm>=8&&item.displayHeightMm<=65)document=require('../resume-core').document({...document,settings:{...document.settings,photoHeight:String(item.displayHeightMm)}});}return document;}
function persist(assets,file){for(const item of assets||[])if(item.buffer){const fs=require('node:fs'),path=require('node:path'),dir=images.folder(file);fs.mkdirSync(dir,{recursive:true});const destination=path.join(dir,item.name);if(!fs.existsSync(destination))fs.writeFileSync(destination,item.buffer,{flag:'wx'});}}
module.exports={pdfPortrait,docxPortrait,attach,persist};

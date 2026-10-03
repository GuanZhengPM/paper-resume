'use strict';
const core=require('../resume-core');
const renderer=require('./render');
function cleanWhitespace(markdown){return markdown.split(/(```[\s\S]*?```)/g).map((part,index)=>index%2?part:part.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n').replace(/^(::: gap )(\d+(?:\.\d+)?)mm[ \t]*$/gm,(_,prefix,amount)=>prefix+Math.min(4,Number(amount))+'mm')).join('').trim()+'\n';}
async function layout(input,{mode='smart',...options}={}) {
 if(mode==='one-page')return renderer.fit(input,options);
 if(/^::: page[ \t]*$/m.test(input.markdown)){
  const parts=input.markdown.replace(/^::: page-spacing [\d.]+mm[ \t]*\n?/gm,'').split(/^::: page[ \t]*$/m);const fitted=[];
  for(const markdown of parts)fitted.push(await layout(core.document({...input,markdown}),options));
  if(fitted.some(result=>!result.fits))return {fits:false,document:core.document(input),report:await renderer.render(input,options),attempts:[],message:'部分语言页内容过多，无法排入一页，原文未修改。'};
  const settings={...input.settings,targetPages:String(Math.min(3,parts.length)),fontSize:String(Math.min(...fitted.map(r=>Number(r.document.settings.fontSize)))),lineHeight:String(Math.min(...fitted.map(r=>Number(r.document.settings.lineHeight)||(r.document.settings.density==='compact'?1.28:1.38)))),pageSpacing:String(Math.min(...fitted.map(r=>Number(r.document.settings.pageSpacing)||0))),density:fitted.some(r=>r.document.settings.density==='compact')?'compact':input.settings.density};
  for(const key of ['marginVertical','marginHorizontal','experienceGap','experienceInner'])settings[key]=String(Math.min(...fitted.map(r=>Number(r.document.settings[key]))));for(const key of ['marginTop','marginBottom'])settings[key]=String(Math.min(...fitted.map(r=>Number(r.document.settings[key]||r.document.settings.marginVertical))));
  // Shared type and margins remain consistent; distribute free space independently on each page.
  const spaced=[];
  const session=await renderer.createSession(options);
  try {
   for(const result of fitted){
    const source=result.document.markdown.trim();
    const base=core.document({...input,markdown:source,settings:{...settings,targetPages:1,pageSpacing:0}});
    let best=base,low=0,high=20;let measured=await session.inspect(base);
    for(let step=0;step<12&&measured.remainingMmEstimated>4;step++){
     const amount=Math.round((low+high)*500)/1000;
     const candidate=core.document({...base,markdown:`::: page-spacing ${amount}mm\n\n`+source});
     const checked=await session.inspect(candidate);
     if(checked.estimatedPages===1&&!checked.overflow.length&&checked.remainingMmEstimated>=3){low=amount;best=candidate;measured=checked;}else high=amount;
    }
    let checked=await session.measure(best);
    // Actual PDF pagination is authoritative; retain the known fitting base on a mismatch.
    for(let retry=0;checked.actualPages!==1&&retry<6;retry++){
     low/=2;best=core.document({...base,markdown:`::: page-spacing ${low}mm\n\n`+source});checked=await session.measure(best);
    }
    spaced.push(best.markdown.trim());
   }
  }finally{await session.close();}
  const document=core.document({...input,markdown:spaced.join('\n\n::: page\n\n')+'\n',settings:{...settings,pageSpacing:0}});const report=await renderer.render(document,options);
  return {fits:report.actualPages===parts.length&&!report.overflow.length,document,report,attempts:[],message:'已分别排版每个语言页，保留分页。'};
 }

 let original=core.document({...input,markdown:cleanWhitespace(input.markdown),settings:{...input.settings,pageSpacing:''}});
 let session=await renderer.createSession(options);const attempts=[];
 try {
  let best=original,report=await session.measure(original);
  if(report.actualPages>1||report.overflow.length) {
   const fitted=await renderer.fit(original,{...options,session});if(!fitted.fits)return fitted;
   original=fitted.document;best=original;report=fitted.report;attempts.push(...fitted.attempts);

  }
  const leading=Number(original.settings.lineHeight)||(original.settings.density==='compact'?1.28:1.38);
  for(const step of [1,2,3,4]) {
   if(report.remainingMmEstimated<=4)break;
   const candidate=core.document({...original,settings:{...original.settings,fontSize:String(Math.min(12,Number(original.settings.fontSize)+step*.5)),lineHeight:String(Math.min(1.5,leading+step*.03))}});
   const result=await session.inspect(candidate);attempts.push({step,actualPages:result.actualPages,settings:candidate.settings});
   if(result.estimatedPages>1||result.overflow.length||result.remainingMmEstimated<3)break;
   best=candidate;report=result;
  }
  const base=best;let low=0,high=20;
  // Search using geometry; verify the selected candidate against actual PDF breaks.
  for(let step=0;step<10&&report.remainingMmEstimated>4;step++) {
   const spacing=Math.round((low+high)*500)/1000;
   const candidate=core.document({...base,settings:{...base.settings,pageSpacing:String(spacing)}});
   const result=await session.inspect(candidate);attempts.push({spacing,actualPages:result.actualPages,remainingMmEstimated:result.remainingMmEstimated});
   if(result.estimatedPages===1&&!result.overflow.length&&result.remainingMmEstimated>=3){low=spacing;best=candidate;report=result;}else high=spacing;
  }
  // Geometry trials are cheap; actual PDF pagination remains authoritative.
  report=await session.measure(best,options.output?{prefix:options.output}:{});
  if(report.actualPages!==1||report.overflow.length){let upper=Number(best.settings.pageSpacing)||0;best=original;report=await session.measure(best,options.output?{prefix:options.output}:{});for(let retry=0;retry<5&&upper>0.05;retry++){upper/=2;const candidate=core.document({...base,settings:{...base.settings,pageSpacing:String(upper)}});const checked=await session.measure(candidate,options.output?{prefix:options.output}:{});if(checked.actualPages===1&&!checked.overflow.length){best=candidate;report=checked;break;}}}
  return {fits:report.actualPages===1&&!report.overflow.length,document:best,report,attempts,metrics:{...session.metrics},message:report.remainingMmEstimated<=8?'已排满一页，保留页边距。':'已整理排版；内容较少，保留适当留白。'};
 }finally{if(session)await session.close().catch(()=>{});}
}
module.exports={layout};

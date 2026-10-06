'use strict';
// Conservative recovery: unambiguous bold runs only, never infer emphasis from words.
async function pdfBold(page,pdfjs){
 const list=await page.getOperatorList(),stack=[],phrases=[];let state={font:'',mode:0},run='';
 const flush=()=>{if(run.trim().length>=2)phrases.push({text:run.trim(),after:''});run='';};
 for(let i=0;i<list.fnArray.length;i++){
  const fn=list.fnArray[i],args=list.argsArray[i];
  if(fn===pdfjs.OPS.save)stack.push({...state});
  else if(fn===pdfjs.OPS.restore)state=stack.pop()||{font:'',mode:0};
  else if(fn===pdfjs.OPS.setFont)state.font=args[0];
  else if(fn===pdfjs.OPS.setTextRenderingMode)state.mode=args[0];
  else if(fn===pdfjs.OPS.showText){
   const text=args[0].filter(x=>x&&typeof x==='object').map(x=>x.unicode||'').join('');
   const font=page.commonObjs.has(state.font)?page.commonObjs.get(state.font):null;
   if(state.mode%4===2||font?.bold||font?.black||/bold|heavy|black/i.test(font?.name||font?.systemFontInfo?.baseFontName||''))run+=text;else if(text.trim()){flush();if(phrases.length)phrases[phrases.length-1].after=(phrases[phrases.length-1].after+text).slice(0,32);}
  }
 }
 flush();return phrases;
}
function restore(markdown,phrases=[]){
 for(const phrase of [...phrases].sort((a,b)=>(b.text||b).length-(a.text||a).length)){
  const text=phrase.text||phrase;
  const literal=text.replace(/([\\`*_\[\]#>|])/g,'\\$1');let at=markdown.indexOf(literal);
  if(at<0)continue;
  if(markdown.indexOf(literal,at+literal.length)>=0){
    if(!phrase.after)continue;const tail=phrase.after.slice(0,4).replace(/([\\`*_\[\]#>|])/g,'\\$1');const contextual=literal+tail;at=markdown.indexOf(contextual);if(at<0||markdown.indexOf(contextual,at+contextual.length)>=0)continue;
  }
  const line=markdown.slice(markdown.lastIndexOf('\n',at)+1,at);if(/^\s*(?:#|:::|```|~~~)/.test(line))continue;
  const end=at+literal.length;
  if([...markdown.matchAll(/\*\*[^\n]*?\*\*/g)].some(m=>at<m.index+m[0].length&&end>m.index))continue;
  markdown=markdown.slice(0,at)+'**'+literal+'**'+markdown.slice(end);
 }
 return markdown;
}
module.exports={pdfBold,restore};

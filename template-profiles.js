(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.PaperTemplates=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const base={targetPages:'auto',fontSize:'10.5',lineHeight:'1.32',density:'compact',marginVertical:'12',marginHorizontal:'14',marginTop:'',marginBottom:'',experienceGap:'3',experienceInner:'0.7',roleGap:'1',pageSpacing:''};
  return {
    projects:{entry:'inline',order:['summary','work','internship','projects','education','research','publications','campus','skills','awards','evaluation'],settings:{...base,fontFamily:'serif',theme:'ink'}},
    internship:{entry:'stacked',order:['summary','education','internship','work','projects','campus','research','publications','skills','awards','evaluation'],settings:{...base,fontFamily:'sans',theme:'navy'}},
    research:{entry:'stacked',order:['summary','education','research','publications','projects','work','internship','skills','awards','campus','evaluation'],settings:{...base,fontFamily:'serif',theme:'ink',lineHeight:'1.35'}},
    academic:{entry:'stacked',order:['summary','education','research','publications','projects','work','internship','skills','awards','campus','evaluation'],settings:{...base,fontFamily:'times',theme:'ink',fontSize:'11',lineHeight:'1.35',marginHorizontal:'16'}},
    bilingual:{entry:'inline',order:['summary','work','internship','projects','education','research','publications','skills','awards','campus','evaluation'],settings:{...base,fontFamily:'serif',theme:'ink',fontSize:'10',lineHeight:'1.28',marginVertical:'10',experienceGap:'2.5',experienceInner:'0.4',roleGap:'0.7'}}
  };
});

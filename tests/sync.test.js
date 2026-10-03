const test=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');const core=require('../resume-core');
test('invalid drafts report the save error and recover without discarding text',async()=>{
 let state=core.document({markdown:'saved'}),poll,errors=[],statuses=[];
 const context=vm.createContext({PaperCore:core,setInterval:fn=>{poll=fn;return 0;},clearInterval(){},setTimeout(){},fetch:async(url,options)=>{
  if(options?.method==='PUT'){const payload=JSON.parse(options.body);if(payload.document.markdown==='invalid draft')return {ok:false,status:400,json:async()=>({error:{message:'第 14 行：row 必须包含 2 或 3 列'}})};return {ok:true,json:async()=>({...payload.document,revision:'r1',fileName:'姓名'})};}
  return {ok:true,json:async()=>({...core.document({markdown:'saved'}),revision:'r0',fileName:'姓名'})};
 }});
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../document-sync.js'),'utf8'),context);
 const sync=context.createDocumentSync({getState:()=>state,applyState:doc=>{state=core.document(doc);},onStatus:value=>statuses.push(value),onConflict(){},onError:error=>errors.push(error.message)});
 await sync.start();state=core.document({markdown:'invalid draft'});sync.markDirty();await sync.flush();
 assert.equal(state.markdown,'invalid draft');assert.match(errors[0],/第 14 行/);assert.equal(statuses.at(-1),'offline');
 state=core.document({markdown:'repaired draft'});sync.markDirty();await poll();await sync.flush();assert.equal(sync.getRevision(),'r1');assert.equal(state.markdown,'repaired draft');assert.equal(statuses.at(-1),'connected');
});
test('flush waits for in-flight autosave and also saves edits made during it',async()=>{
  let state=core.document({markdown:'initial'});let release;const writes=[];
  const context=vm.createContext({PaperCore:core,location:{protocol:'http:'},setInterval:()=>0,clearInterval(){},setTimeout(){},fetch:async(url,options)=>{
    if(options?.method==='PUT') {
      const payload=JSON.parse(options.body);writes.push(payload);
      if(writes.length===1)await new Promise(resolve=>{release=resolve;});
      return {ok:true,json:async()=>({...payload.document,revision:'r'+writes.length,fileName:'resume.paper.json'})};
    }
    return {ok:true,json:async()=>({...state,revision:'r0',fileName:'resume.paper.json'})};
  }});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../document-sync.js'),'utf8'),context);
  const sync=context.createDocumentSync({getState:()=>state,applyState:doc=>{state=core.document(doc);},onStatus(){},onConflict(){}});
  await sync.start();state=core.document({markdown:'first edit'});sync.markDirty();const autosave=sync.flush();
  state=core.document({markdown:'second edit'});sync.markDirty();let finished=false;const beforeFit=sync.flush().then(()=>{finished=true;});
  await Promise.resolve();assert.equal(finished,false);release();await Promise.all([autosave,beforeFit]);
  assert.equal(writes.length,2);assert.equal(writes[1].document.markdown,'second edit');assert.equal(writes[1].expectedRevision,'r1');assert.equal(sync.getRevision(),'r2');
});

test('startup preserves unsynced drafts, accepts clean remote edits, and detects divergent versions',async()=>{
 const cases=[
  {local:'browser edit',remote:'old file',baseline:null,conflict:true},
  {local:'browser edit',remote:'old file',baseline:'old file',write:true},
  {local:'browser edit',remote:'agent edit',baseline:'old file',conflict:true},
  {local:'old file',remote:'agent edit',baseline:'old file',accept:true},
  {local:'same',remote:'same',baseline:null,accept:true}
 ];
 for(const scenario of cases){
  let state=core.document({markdown:scenario.local});let accepted=false;let conflict=false;const writes=[];
  const context=vm.createContext({PaperCore:core,location:{protocol:'http:'},setInterval:()=>0,clearInterval(){},setTimeout(){},fetch:async(url,options)=>{
   if(options?.method==='PUT'){const payload=JSON.parse(options.body);writes.push(payload);return {ok:true,json:async()=>({...payload.document,revision:'r1'})};}
   return {ok:true,json:async()=>({...core.document({markdown:scenario.remote}),revision:'r0'})};
  }});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../document-sync.js'),'utf8'),context);
  const sync=context.createDocumentSync({getState:()=>state,applyState:doc=>{accepted=true;state=core.document(doc);},initialDraft:true,baseline:scenario.baseline?core.document({markdown:scenario.baseline}):null,onStatus(){},onConflict:value=>{conflict=value;}});
  await sync.start();assert.equal(conflict,!!scenario.conflict);assert.equal(accepted,!!scenario.accept);assert.equal(writes.length,scenario.write?1:0);
  assert.equal(state.markdown,scenario.accept?scenario.remote:scenario.local);
 }
});

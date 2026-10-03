function createDocumentSync({getState,applyState,onStatus,onConflict,onSynced=()=>{},onError=()=>{},initialDraft=false,baseline=null,readOnly=false,url='/api/document'}) {
  let revision=null; let connected=false; let dirty=false; let saving=false; let saveTask=null; let conflict=false; let sequence=0; let timer;let paused=false;let stopped=false;
  const equal=(a,b)=>JSON.stringify(PaperCore.document(a))===JSON.stringify(PaperCore.document(b));
  const request=async (options)=>{
    const response=await fetch(url,{cache:'no-store',...options});
    const result=await response.json();if (!response.ok) {const error=new Error(result.error?.message||'文件同步失败');error.status=response.status;throw error;}
    return result;
  };
  const status=(mode,name)=>onStatus(mode,name);
  function accept(document) {
    revision=document.revision;connected=true;dirty=false;conflict=false;
    onSynced(document);applyState(document);onConflict(false);status('connected',document.fileName);
  }
  async function start() {
    const initial=getState();
    try {
      const remote=await request();
      connected=true;
      if (dirty || !equal(initial,getState())) {revision=remote.revision;conflict=true;onConflict(true);status('conflict');}
      else if (!readOnly && initialDraft && !equal(initial,remote) && (!baseline || !equal(initial,baseline))) {
        revision=remote.revision;dirty=true;
        if (baseline && equal(baseline,remote)) await flush();
        else {conflict=true;onConflict(true);status('conflict');}
      } else accept(remote);
    } catch(error) {console.warn('Resume sync:',error.stack||error.message);onError(error);status('offline');}
    if (!readOnly) timer=setInterval(poll,1500);
  }
  function markDirty() { if(readOnly)return;dirty=true;sequence++; }
  async function flush() {
    if (saving) {await saveTask;return flush();}
    if (stopped || readOnly || !connected || !dirty || conflict) return;
    saving=true;const version=sequence;
    saveTask=(async()=>{
    try {
      const remote=await request({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:revision,document:getState()})});
      revision=remote.revision;onSynced(remote);
      if (version===sequence) {dirty=false;status('connected',remote.fileName);}
    } catch(error) {
      if ([409,423].includes(error.status)) {conflict=true;onConflict(true);status('conflict');}
      else {connected=false;onError(error);status('offline');}
    } finally {saving=false; if(dirty && connected && !conflict) setTimeout(flush,200);}
    })();
    return saveTask;
  }
  async function poll() {
    if (stopped || saving || conflict || paused) return;
    try {
      const remote=await request();
      if(stopped)return;
      if (!connected) {
        connected=true;
        if (dirty && !equal(remote,getState())) {if(remote.revision===revision) {flush();return;}conflict=true;onConflict(true);status('conflict');return;}
        if (!dirty) accept(remote);
        else {revision=remote.revision;dirty=false;status('connected',remote.fileName);}
      } else if (remote.revision!==revision) {
        if (dirty) {conflict=true;onConflict(true);status('conflict');}
        else accept(remote);
      } else if (dirty) flush();else status('connected',remote.fileName);
    } catch(error) {if(connected) {connected=false;onError(error);status('offline');}}
  }
  async function loadLatest() {try {accept(await request());}catch{status('offline');}}
  return {start,markDirty,flush,loadLatest,adopt:accept,pause:()=>{paused=true;},resume:()=>{paused=false;},isConnected:()=>connected && !conflict,stop:()=>{stopped=true;clearInterval(timer);},getRevision:()=>revision};
}

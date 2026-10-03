'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const core=require('../resume-core.js');
function revision(document) { return createHash('sha256').update(JSON.stringify(core.document(document))).digest('hex'); }
function load(file) {
  if (!fs.existsSync(file)) core.fail(`文档不存在：${file}`,'DOCUMENT_NOT_FOUND');
  let raw; try {raw=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));} catch {core.fail('无法解析简历 JSON 文件','INVALID_DOCUMENT');}
  const document=core.document(raw);
  return {...document,revision:revision(document),updatedAt:raw.updatedAt || fs.statSync(file).mtime.toISOString()};
}
function atomicWrite(file,data) {
  const temp=path.join(path.dirname(file),`.${path.basename(file)}.${randomUUID()}.tmp`);
  try { fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n',{encoding:'utf8',flag:'wx'}); fs.renameSync(temp,file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function commit(file,next,expectedRevision,options={}) {
  file=path.resolve(file); fs.mkdirSync(path.dirname(file),{recursive:true});
  const lock=file+'.lock'; let handle;
  try { handle=fs.openSync(lock,'wx'); } catch (error) { if (error.code==='EEXIST') core.fail('文档正在被另一个进程写入，请重试','DOCUMENT_LOCKED'); throw error; }
  try {
    const exists=fs.existsSync(file); const previous=exists?load(file):null;
    if (previous && expectedRevision!==previous.revision) { const error=new Error('文档已更新，请重新读取 revision 再修改'); error.code='REVISION_CONFLICT'; error.actualRevision=previous.revision; throw error; }
    if (!previous && expectedRevision!==null) core.fail('文档不存在','DOCUMENT_NOT_FOUND');
    const normalized=core.document(next); core.validateMarkdown(normalized.markdown);
    const nextRevision=revision(normalized);
    if (previous?.revision===nextRevision) return {document:previous,changed:false,backup:null};
    let backup=null;
    if (previous) {
      const folder=path.join(path.dirname(file),'.paper-backups'); fs.mkdirSync(folder,{recursive:true});
      backup=path.join(folder,`${path.basename(file,'.json')}.${Date.now()}.${randomUUID().slice(0,8)}.json`);
      fs.writeFileSync(backup,JSON.stringify(previous,null,2)+'\n',{encoding:'utf8',flag:'wx'});
    }
    const document={...normalized,revision:nextRevision,updatedAt:new Date().toISOString()};
    atomicWrite(file,document);
    return {document,changed:true,backup};
  } finally { fs.closeSync(handle); fs.unlinkSync(lock); }
}
module.exports={load,commit,revision,atomicWrite};

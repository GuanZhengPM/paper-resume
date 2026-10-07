#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
async function pack(output){
 const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
 const JSZip=require('../lib/render').dependency('jszip'),zip=new JSZip();
 const files=['SKILL.md',...fs.readdirSync(path.join(root,'skills/paper-resume/references')).filter(f=>f.endsWith('.md')).sort().map(f=>'references/'+f)];
 for(const file of files)zip.file('paper-resume/'+file,fs.readFileSync(path.join(root,'skills/paper-resume',file)),{date:new Date('2026-10-07T00:00:00Z')});
 zip.file('paper-resume/LICENSE',fs.readFileSync(path.join(root,'LICENSE')),{date:new Date('2026-10-07T00:00:00Z')});
 const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});const folder=path.resolve(output||path.join(root,'output/release'));fs.mkdirSync(folder,{recursive:true});
 const name='paper-resume-skill-v'+version+'.zip',destination=path.join(folder,name),sha256=createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(destination,bytes,{flag:'wx'});fs.writeFileSync(destination+'.sha256',sha256+'  '+name+'\n',{flag:'wx'});
 return {file:destination,sha256,files:[...files,'LICENSE']};
}
if(require.main===module)pack(process.argv[2]).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={pack};

'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const core=require('../resume-core');
function install({force=false,home=process.env.CODEX_HOME||path.join(os.homedir(),'.codex')}={}){
 const root=path.resolve(__dirname,'..');
 const source=path.join(root,'skills','paper-resume');
 const folder=path.join(home,'skills','paper-resume');
 const target=path.join(folder,'SKILL.md');
 const files=[];
 function walk(dir,relative=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const rel=path.join(relative,entry.name);if(entry.isDirectory())walk(path.join(dir,entry.name),rel);else if(entry.isFile())files.push(rel);}}
 walk(source);
 // Preflight every resource before writing any file; keep local customizations recoverable.
 for(const name of files){const dest=path.join(folder,name);if(fs.existsSync(dest)&&fs.readFileSync(dest,'utf8')!==fs.readFileSync(path.join(source,name),'utf8')&&!force)core.fail('已存在不同版本的 paper-resume 技能，使用 --force 明确更新。','SKILL_EXISTS');}
 for(const name of files){const dest=path.join(folder,name);fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest)&&force)fs.copyFileSync(dest,dest+'.backup');fs.copyFileSync(path.join(source,name),dest);}
 fs.writeFileSync(path.join(folder,'installation.json'),JSON.stringify({root},null,2)+'\n');
 return {skill:target,root,message:'技能已安装。新会话可发现；当前会话可直接读取该技能继续使用。'};
}
module.exports={install};

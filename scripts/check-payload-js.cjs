const fs=require('fs'),path=require('path');
const [root,payload]=process.argv.slice(2);let count=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile()&&p.endsWith('.js')){const target=path.join(root,path.relative(payload,p));try{new Function(fs.readFileSync(target,'utf8'));}catch(err){throw new Error(target+': '+err.message);}count++;}}}
walk(payload);console.log(`Validated ${count} packaged JavaScript modules`);

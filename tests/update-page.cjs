const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../payload/www/luci-static/resources/view/chester-update/index.js'),'utf8');
let commands=[],saved=[],modals=[],saveFails=false;
const E=(tag,attrs,children)=>({tag,attrs:attrs||{},children:children||[]});
const rpc={declare:spec=>async(...args)=>{if(spec.method==='update_settings')return {auto:false,time:'03:00',keep_settings:true};saved.push(args);if(saveFails)return {success:false,message:'Save rejected'};return {success:true,auto:args[0]==='1',time:args[1],keep_settings:args[2]==='1'};}};
const backend={exec:async(command,args)=>{commands.push(args[0]);return {stdout:JSON.stringify(args[0]==='status-local'?{local_only:true,installed_version:'1.0.9',installed_bin:'10'}:{ok:false,error:'Offline'})};}};
const ui={showModal:(title,nodes)=>modals.push({title,nodes}),hideModal:()=>{},createHandlerFn:(self,fn)=>fn.bind(self)};
const methods=new Function('view','rpc','fs','dom','settings','ui','E','L','_',code)({extend:x=>x},rpc,backend,{}, {},ui,E,{},v=>v);
(async()=>{
 const local=await methods.load();assert.equal(local[0].installed_version,'1.0.9');assert.deepEqual(commands,['status-local']);
 const instance={...methods,info:local[0],checkButton:{},installButton:{},paintStatus:()=>{}};
 await instance.checkForUpdates();assert.equal(instance.info.installed_bin,'10');assert.equal(instance.info.ok,false);assert.equal(instance.checkButton.disabled,false);
 assert.deepEqual(commands,['status-local','status']);
 Object.assign(instance,{keepInput:{checked:false},autoInput:{checked:false},timeInput:{value:'03:00'},preferenceNote:{},zone:'UTC'});
 await instance.savePreferences();assert.deepEqual(saved.at(-1),['0','03:00','0']);
 // An explicit install confirmation still cannot flash when options fail to save.
 saveFails=true;instance.handleInstall(false);const confirmation=modals.at(-1).nodes.at(-1).children.at(-1);await confirmation.attrs.click();
 assert(!commands.includes('install'));assert.equal(modals.at(-1).title,'Update Could Not Start');
 const start=code.indexOf('function releaseNotes('),end=code.indexOf('function versionLabel(',start);
 const notes=new Function(code.slice(start,end)+';return releaseNotes;')();
 assert.deepEqual(notes('Bin 11: New controls. Signed OTA retained.'),['Rev. 11: New controls','Signed OTA retained.']);
 assert.deepEqual(notes(['- UI update',null,'<script>text</script>']),['UI update','<script>text</script>']);
 console.log('PASS update page: local-first load, offline metadata retention, saved keep-setting choice, install blocked after save failure, and revision release notes.');
})().catch(e=>{console.error(e);process.exitCode=1;});

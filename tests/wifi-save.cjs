const fs=require('fs');
async function check(data){ const writes=[];let saved=false,applied=false,error=null;
String.prototype.format=function(...args){let n=0;return this.replace(/%s/g,()=>String(args[n++]));};
const uci={load:async()=>{},sections:(c,t)=>Object.entries(data[c]).filter(([,v])=>v['.type']===t).map(([k,v])=>({...v,'.name':k})),get:(c,s,k)=>data[c]?.[s]?.[k],add:(c,t,n)=>{writes.push(['add',c,n,t]);return n;},set:(c,s,k,v)=>writes.push(['set',c,s,k,v]),unset:(c,s,k)=>writes.push(['unset',c,s,k]),save:async()=>{saved=true;},callApply:async(t,r)=>{if(t!==0||r!==false)throw Error('Wrong apply arguments');applied=true;}};
const ui={changes:{init:async()=>{}},addNotification:()=>{}};
const L={resource:s=>s,Class:{extend:o=>o}};
const helper={setButtonBusy:()=>{},notify:()=>{},ensureNamedSection:()=> 'wifi_defaults',saveAndApplyUnchecked:async u=>{await u.save();await u.callApply(0,false);await ui.changes.init();}};
helper.setButtonBusy=()=>{};helper.notify=(m,type)=>{if(type==='error')error=m;};
const page=new Function('view','rpc','ui','uci','dom','misectel','settings','_','E','L','window',fs.readFileSync(require('path').join(__dirname,'../payload/www/luci-static/resources/view/misectel-wifi/index.js'),'utf8'))({extend:o=>o},{declare:()=>()=>{}},ui,uci,{},helper,{},s=>s,()=>{},L,{setTimeout:()=>{}});
page.radioState=Object.entries(data.wireless).filter(([,v])=>v['.type']==='wifi-device').map(([name,v])=>({name,section:Object.entries(data.wireless).find(([,x])=>x['.type']==='wifi-iface'&&x.device===name&&x.mode==='ap')[0],bandLabel:v.band==='2g'?'2.4 GHz':'5 GHz'}));
const input=value=>({value});
const tune=r=>({channelSelect:input(data.wireless[r.name].channel||'auto'),widthSelect:input(data.wireless[r.name].htmode||''),countryInput:input(data.wireless[r.name].country||'US'),powerSelect:input(data.wireless[r.name].txpower||'')});
page.linkedMode=data.test.shared;
page.separateControls={};for(const [i,r]of page.radioState.entries()){const c=data.test.bands[i];page.separateControls[r.name]={...tune(r),enabledInput:{checked:c.on},ssidInput:input(c.ssid),keyInput:input(c.key),encryptionSelect:input('psk2')};}
const shared=data.test.bands[0];page.linkedControls={enabledInput:{checked:shared.on},ssidInput:input(shared.ssid),keyInput:input(shared.key),encryptionSelect:input('psk2'),tuning:Object.fromEntries(page.radioState.map(r=>[r.name,tune(r)]))};
await page.saveChanges({});return {writes,saved,applied,error};}


const assert=require('node:assert/strict');
(async()=>{
 const fixture={wireless:{radio0:{'.type':'wifi-device',band:'2g',channel:'1',htmode:'EHT20',country:'US',disabled:'1'},radio1:{'.type':'wifi-device',band:'5g',channel:'36',htmode:'EHT80',country:'US',disabled:'1'},ap0:{'.type':'wifi-iface',device:'radio0',mode:'ap'},ap1:{'.type':'wifi-iface',device:'radio1',mode:'ap'}},misectel:{}};
 for(const shared of [true,false])for(const power of [[true,true],[false,false],[true,false],[false,true]]){
  const bands=power.map((on,i)=>({on,ssid:'Test'+i,key:'test-password-'+i}));const r=await check({...fixture,test:{shared,bands}});assert.equal(r.error,null);assert(r.saved&&r.applied);
  for(let i=0;i<2;i++){const target=shared?bands[0]:bands[i];for(const [section,key,value]of [['radio'+i,'disabled',target.on?'0':'1'],['ap'+i,'disabled',target.on?'0':'1'],['ap'+i,'ssid',target.ssid],['ap'+i,'key',target.key]])assert(r.writes.some(w=>w[0]==='set'&&w[1]==='wireless'&&w[2]===section&&w[3]===key&&w[4]===value));}
 }
 const invalid=await check({...fixture,test:{shared:false,bands:[{on:true,ssid:'Valid',key:'valid-password'},{on:true,ssid:'Invalid',key:'bad'}]}});assert(invalid.error);assert.equal(invalid.writes.length,0);assert.equal(invalid.saved,false);
 console.log('Wi-Fi save: shared/separate names, passwords, both radio/AP power flags and atomic validation passed.');
})().catch(e=>{console.error(e);process.exit(1);});

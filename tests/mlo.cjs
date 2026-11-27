const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/view/misectel-wifi/index.js','utf8');
function fixture(){
 const config={radio0:{'.type':'wifi-device',band:'2g',path:'pci/test',radio:'0',htmode:'EHT20',channel:'1',country:'US'},radio1:{'.type':'wifi-device',band:'5g',path:'pci/test',radio:'1',htmode:'EHT80',channel:'36',country:'US'},ap0:{'.type':'wifi-iface',device:'radio0',ssid:'Main',key:'main-secret'},guest:{'.type':'wifi-iface',device:'radio1',ssid:'Guest',key:'guest-secret'}};
 const writes=[];let applied=0,error=null,pending={},supported=true;
 const uci={get:(c,s,k)=>k==null?config[s]?.['.type']:config[s]?.[k],sections:(c,t)=>Object.entries(config).filter(([,v])=>v['.type']===t).map(([k,v])=>({...v,'.name':k})),changes:async()=>pending,add:(c,t,n)=>{writes.push(['add',n]);config[n]={'.type':t};},set:(c,s,k,v)=>{writes.push([s,k,v]);config[s][k]=v;}};
 const helper={ensureArray:v=>Array.isArray(v)?v:[],setButtonBusy(){},notify(m){error=m;},saveAndApplyChecked:async(u,t)=>{assert.equal(u,uci);assert.equal(t,30);applied++;}};
 const page=new Function('view','rpc','ui','uci','dom','misectel','settings','_','E','L','window',source)({extend:o=>o},{declare:()=>async()=>({supported})},{},uci,{},helper,{},s=>s,()=>{}, {},{setTimeout(){}});
 page.radioState=[{name:'radio0',bandKey:'2g',widthChoices:['EHT20']},{name:'radio1',bandKey:'5g',widthChoices:['EHT80']}];
 page.mloData={mlo:{supported:true},phyNames:{radio0:'phy0',radio1:'phy0'},iwinfo:{radio0:{htmodes:['EHT20']},radio1:{htmodes:['EHT80']}}};
 page.mloControls={enabledInput:{checked:true},ssidInput:{value:'Chester-MLO'},keyInput:{value:'test-password'}};
 return {page,config,writes,run:async()=>{await page.saveMlo({});return {applied,error};},pending:v=>pending=v,support:v=>supported=v};
}
(async()=>{
 let f=fixture(),before=JSON.stringify(f.config),r=await f.run();assert.equal(r.error,null);assert.equal(r.applied,1);
 const m=f.config.chester_mlo;assert.deepEqual(m.device,['radio0','radio1']);assert.equal(m.mlo,'1');assert.equal(m.encryption,'sae+gcmp256');assert.equal(m.ieee80211w,'2');assert.equal(m.sae_pwe,'1');assert.equal(m.rnr,'1');assert.equal(m.network,'lan');assert.deepEqual(m.hostapd_bss_options,['wpa_key_mgmt=SAE SAE-EXT-KEY']);
 const {chester_mlo,...unchanged}=f.config;assert.equal(JSON.stringify(unchanged),before);
 for(const mutate of [
  f=>f.config.radio0.disabled='1',f=>f.config.radio0.htmode='HE20',f=>f.config.radio1.channel='auto',f=>f.config.radio0.country='CA',
  f=>f.config.radio1.path='other',f=>f.config.radio1.radio='0',f=>f.page.mloData.phyNames.radio1='phy1',f=>f.support(false),f=>f.page.mloData.iwinfo.radio0.htmodes=['HE20'],
  f=>f.page.mloControls.keyInput.value='short',f=>f.page.mloControls.keyInput.value='é'.repeat(32),
  f=>f.page.mloControls.ssidInput.value='é'.repeat(17),f=>f.page.mloControls.ssidInput.value='Main',
  f=>f.pending({network:[['set','lan','ipaddr','10.0.0.1']]}),
  f=>f.config.chester_mlo={'.type':'wifi-iface',ssid:'Customer'},
  f=>f.config.foreign={'.type':'wifi-iface',mlo:'1'}
 ]){f=fixture();mutate(f);r=await f.run();assert(r.error,'Invalid configuration accepted');assert.equal(f.writes.length,0);assert.equal(r.applied,0);}
 f=fixture();f.page.mloControls.enabledInput.checked=false;r=await f.run();assert.equal(f.writes.length,0);assert.equal(r.applied,0);
 f=fixture();f.config.chester_mlo={'.type':'wifi-iface',chester_managed:'mlo-v1',mlo:'1',disabled:'0',ssid:'Saved',key:'saved-secret',device:['radio0','radio1']};f.page.mloControls.enabledInput.checked=false;r=await f.run();assert.deepEqual(f.writes,[['chester_mlo','disabled','1']]);assert.equal(f.config.chester_mlo.key,'saved-secret');assert.equal(r.applied,1);
 f=fixture();f.config.chester_mlo={'.type':'wifi-iface',mlo:'1',device:['radio0','radio1']};
 const draft=[{radio:{name:'radio0'},c:{enabledInput:{checked:false}},t:{widthSelect:{value:'EHT20'},channelSelect:{value:'1'}},country:'US'}];assert.throws(()=>f.page.validateExistingMlo(draft),/MLO requires/);
 console.log('PASS MLO: separate AP, tested security, settings preservation, capability/credential/radio/conflict validation, checked apply and main-radio guard.');
})().catch(e=>{console.error(e);process.exit(1);});

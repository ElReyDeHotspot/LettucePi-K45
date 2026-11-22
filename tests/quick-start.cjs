const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../payload/www/luci-static/resources/view/misectel-dashboard/setup-wizard.js'),'utf8');
const api=new Function('view','rpc',code)({extend:x=>x},{declare:()=>{}});
const state={sim:'2',apn:'vzwinternet',wan:{exists:true,role:'wan',device:'wan',mode:'lan',proto:'dhcp'},ttlOn:true,ttl:'65',hl:'66',password:'',confirm:'',zone:'America/New_York',wifiOn:false,shared:true,radios:[{name:'radio0',section:'ap0',ssid:'',key:''},{name:'radio1',section:'ap1',ssid:'',key:''}],sharedWifi:{ssid:'',key:'',encryption:'sae-mixed'}};
const ctx={state,data:{chester:{timezones:{'America/New_York':'EST5EDT,M3.2.0,M11.1.0'}}}};
let p=api.payload.call(ctx);assert.equal(p.chester.sim_slot,'2');assert.equal(p.chester.apn,'vzwinternet');assert.equal(p.network.optional_wan_mode,'lan');assert.equal(p.chester.ttl,65);assert.equal(p.chester.hl,66);assert.equal(p.wifi.enabled,false);assert.equal(p.wifi.radios.length,2);assert.equal(p.wizard.skipped_wifi,false);assert.equal(p.wizard.skipped_admin,true);
state.ttl='256';assert.throws(()=>api.payload.call(ctx),/1 to 255/);state.ttl='65';state.password='new password';state.confirm='different';assert.throws(()=>api.payload.call(ctx),/do not match/);state.password=' keep spaces ';state.confirm=state.password;assert.equal(api.payload.call(ctx).admin.password,' keep spaces ');
state.wifiOn=true;assert.throws(()=>api.payload.call(ctx),/Wi-Fi name/);state.sharedWifi={ssid:'Chester Test',key:'test-passphrase',encryption:'sae-mixed'};p=api.payload.call(ctx);assert(p.wifi.radios.every(r=>r.ssid==='Chester Test'&&r.key==='test-passphrase'));
state.shared=false;state.radios.forEach((r,i)=>{r.ssid='Band '+i;r.key='passphrase-'+i;r.encryption='psk2';});p=api.payload.call(ctx);assert.equal(p.wifi.radios[0].ssid,'Band 0');assert.equal(p.wifi.radios[1].ssid,'Band 1');
console.log('Quick Start draft: SIM/APN, WAN, independent TTL/HL, password confirmation, timezone, Wi-Fi disabled/shared/separate passed. No settings applied.');

state.shared=true;
for(const encryption of ['psk2','sae','sae-mixed']){state.sharedWifi.encryption=encryption;state.sharedWifi.key='test-passphrase';p=api.payload.call(ctx);assert(p.wifi.radios.every(r=>r.encryption===encryption));}
state.sharedWifi.encryption='none';state.sharedWifi.key='';p=api.payload.call(ctx);assert(p.wifi.radios.every(r=>r.encryption==='none'&&r.key===''));
state.shared=false;state.radios[0].encryption='none';state.radios[0].key='';state.radios[1].encryption='sae';p=api.payload.call(ctx);assert.equal(p.wifi.radios[0].encryption,'none');assert.equal(p.wifi.radios[0].key,'');assert.equal(p.wifi.radios[1].encryption,'sae');
console.log('Wi-Fi encryption: WPA2, WPA3, mixed and Open retained correctly for shared/separate bands. No settings applied.');
// Applying settings may close the first-run endpoint before its reply arrives.
async function completionCase(reply,statuses){
 let done=false,reads=0;
 const calls={apply_setup_wizard_config:async()=>{if(reply instanceof Error)throw reply;return reply;},get_setup_wizard_context:async()=>{const s=statuses[Math.min(reads++,statuses.length-1)];if(s instanceof Error)throw s;return s;}};
 const a=new Function('view','rpc','window',code)({extend:x=>x},{declare:o=>calls[o.method]},{setTimeout:fn=>fn()});
 const buttons=[{disabled:false}];
 const c={payload:()=>({}),panel:{querySelectorAll:()=>buttons},error:{textContent:''},completeSetup:()=>done=true};
 await a.finish.call(c);return {done,buttons,error:c.error.textContent,reads};
}
(async()=>{
 // RPC declaration names are resolved from the source, without making calls.
 let r=await completionCase({result:true},[]);assert(r.done);
 r=await completionCase(new Error('connection lost'),[{code:403}]);assert(r.done);
 r=await completionCase({code:403,message:'closed'},[{code:403}]);assert(r.done);
 r=await completionCase({result:false,message:'Invalid Wi-Fi'},[{result:true}]);assert(!r.done);assert.equal(r.error,'Invalid Wi-Fi');assert(!r.buttons[0].disabled);
 r=await completionCase(new Error('offline'),[new Error('offline')]);assert(!r.done);assert.equal(r.reads,10);assert(!r.buttons[0].disabled);
 console.log('Quick Start completion: success, completed retry, interrupted reply, validation error and offline recovery passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});

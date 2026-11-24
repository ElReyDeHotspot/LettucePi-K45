const fs=require('fs'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/view/misectel-modem/apn.js','utf8');
let sets=[],notices=[];const uci={set:(...a)=>sets.push(['set',...a]),unset:(...a)=>sets.push(['unset',...a]),load:async()=>{}};
const api=new Function('view','rpc','uci','misectel','_',source)({extend:v=>v},{declare:()=>async()=>({})},uci,{notify:(...a)=>notices.push(a)},s=>s);
api.writeConfigToUci('modem','2',{apn:'vzwinternet',auth:'none',username:'ignored',password:'ignored'});
assert(sets.some(a=>a[3]==='apn2'&&a[4]==='vzwinternet'));assert(!sets.some(a=>a[3]==='apn'));assert(sets.some(a=>a[0]==='unset'&&a[3]==='password2'));
sets=[];api.writeConfigToUci('modem','both',{apn:'fast.t-mobile.com',auth:'pap',username:'user',password:'secret'});assert(sets.some(a=>a[3]==='apn'));assert(sets.some(a=>a[3]==='apn2'));assert(sets.some(a=>a[3]==='password2'&&a[4]==='secret'));
(async()=>{await api.applyConfig.call({},'1',{apn:'bad\nAT+RESET'},null);assert.equal(notices.length,1);console.log('PASS APN: per-SIM isolation, explicit both-SIM writes, disabled-auth credential clearing, invalid APNs rejected before save.');})().catch(e=>{console.error(e);process.exitCode=1;});

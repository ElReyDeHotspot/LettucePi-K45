const fs=require('fs'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/view/misectel-device/index.js','utf8');
function fixture(fail){const calls=[];const uci={get:(config,section,key)=>key==='ipaddr'?'192.168.100.1':'255.255.255.0',unload:key=>calls.push(['unload',key]),load:async key=>calls.push(['load',key])};const rpc={declare:spec=>async(...args)=>{calls.push([spec.method,...args]);return fail?{success:false,error:'Address already leased'}:{success:true};}};const api=new Function('view','uci','misectel','rpc',source)({extend:x=>x},uci,{},rpc);return {calls,api,ctx:{buildStaticLeaseMap:()=>({'AA:BB:CC:DD:EE:FF':{section:'existing'}})}};}
const match=new Function(source.slice(source.indexOf('function matchesDevice('),source.indexOf('return view.extend('))+';return matchesDevice;')();
assert(match({hostname:'Laptop',mac:'AA:BB',ipaddr:'192.168.100.2',ssid:'Chester',connection:'wireless'},'wifi','chester'));
assert(!match({connection:'wired'},'wifi',''));
assert(match({connection:'static',tone:'offline',staticLease:{ip:'192.168.100.50'}},'reserved','100.50'));
(async()=>{
 let t=fixture();await t.api.saveStaticLease.call(t.ctx,'Desk','aa-bb-cc-dd-ee-ff','192.168.100.50');assert.deepEqual(t.calls[0],['address','AA:BB:CC:DD:EE:FF','static','192.168.100.50']);assert.deepEqual(t.calls.slice(1),[['unload','dhcp'],['load','dhcp']]);
 for(const ip of ['', '999.1.1.1','0.0.0.0','127.0.0.1','224.0.0.1','1.2.3','1.2.3.4;reboot','192.168.100.1','192.168.100.0','192.168.100.255','192.168.101.50']){t=fixture();await assert.rejects(()=>t.api.saveStaticLease.call(t.ctx,'Desk','AA:BB:CC:DD:EE:FF',ip));assert.equal(t.calls.length,0);}
 t=fixture();await assert.rejects(()=>t.api.saveStaticLease.call(t.ctx,'Desk','invalid','192.168.100.50'));assert.equal(t.calls.length,0);
 t=fixture();t.ctx.devices=[{mac:'02:00:00:00:00:01',ipaddr:'192.168.100.50',tone:'online'}];await assert.rejects(()=>t.api.saveStaticLease.call(t.ctx,'Desk','AA:BB:CC:DD:EE:FF','192.168.100.50'));assert.equal(t.calls.length,0);
 t=fixture(true);await assert.rejects(()=>t.api.saveStaticLease.call(t.ctx,'Desk','AA:BB:CC:DD:EE:FF','192.168.100.50'),/Address already leased/);assert.equal(t.calls.length,1);
 console.log('PASS Devices: dedicated DHCP RPC, subnet/router/broadcast/conflict validation, explicit server errors, no unrelated settings apply.');
})().catch(e=>{console.error(e);process.exitCode=1;});

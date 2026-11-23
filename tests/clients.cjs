const fs=require('fs'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/view/misectel-device/index.js','utf8');
function fixture(){const calls=[];const uci={add:(...a)=>{calls.push(['add',...a]);return 'new';},set:(...a)=>calls.push(['set',...a]),unset:(...a)=>calls.push(['unset',...a])};const api=new Function('view','uci','misectel',source)({extend:x=>x},uci,{saveAndApplyUnchecked:async()=>calls.push(['apply'])});return {calls,api,ctx:{buildStaticLeaseMap:()=>({'AA:BB:CC:DD:EE:FF':{section:'existing'}})}};}
const match=new Function(source.slice(source.indexOf('function matchesDevice('),source.indexOf('return view.extend('))+';return matchesDevice;')();
assert(match({hostname:'Laptop',mac:'AA:BB',ipaddr:'192.168.100.2',ssid:'Chester',connection:'wireless'},'wifi','chester'));
assert(!match({connection:'wired'},'wifi',''));
assert(match({connection:'static',tone:'offline',staticLease:{ip:'192.168.100.50'}},'reserved','100.50'));
assert(!match({hostname:'Laptop',connection:'wired'},'all','phone'));
(async()=>{
 let t=fixture();await t.api.saveStaticLease.call(t.ctx,'Desk','aa-bb-cc-dd-ee-ff','192.168.100.50');assert(!t.calls.some(c=>c[0]==='add'));assert(t.calls.some(c=>c[0]==='set'&&c[2]==='existing'&&c[3]==='ip'&&c[4]==='192.168.100.50'));assert.deepEqual(t.calls.find(c=>c[3]==='mac')[4],['aa:bb:cc:dd:ee:ff']);assert.equal(t.calls.filter(c=>c[0]==='apply').length,1);
 for(const ip of ['', '999.1.1.1','0.0.0.0','127.0.0.1','224.0.0.1','1.2.3','1.2.3.4;reboot']){t=fixture();await assert.rejects(()=>t.api.saveStaticLease.call(t.ctx,'Desk','AA:BB:CC:DD:EE:FF',ip));assert.equal(t.calls.length,0);}
 t=fixture();await assert.rejects(()=>t.api.saveStaticLease.call(t.ctx,'Desk','invalid','192.168.100.50'));assert.equal(t.calls.length,0);
 console.log('PASS Devices: offline reservations remain searchable; filters isolate connection types; existing reservations are updated; invalid input cannot write DHCP settings.');
})().catch(e=>{console.error(e);process.exitCode=1;});

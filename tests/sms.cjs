const fs=require('fs'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/qmodem/sms.js','utf8');
function service(responses,pdus=['part1']){const calls=[];const rpc={declare:o=>(...args)=>{calls.push({method:o.method,args});return Promise.resolve(responses.shift());}};const api=new Function('rpc','pduParser','L',source)(rpc,{generate:()=>pdus},{Class:{extend:o=>o}});return {api,calls};}
(async()=>{
 let t=service([{error:'Carrier rejected SMS'}]);await assert.rejects(()=>t.api.sendSms('modem','+15555550123','test'),/Carrier rejected/);
 t=service([{success:false}]);await assert.rejects(()=>t.api.sendSms('modem','+15555550123','test'),/operation failed/);
 t=service([{success:true},{success:true}],['part1','part2']);assert.equal((await t.api.sendSms('modem','+15555550123','test')).parts,2);assert.equal(t.calls.length,2);
 t=service([{success:true},{error:'Connection lost'}],['part1','part2']);await assert.rejects(()=>t.api.sendSms('modem','+15555550123','test'),/Only 1 of 2/);
 t=service([{error:'Missing AT port'}]);await assert.rejects(()=>t.api.listSms('modem'),/Missing AT port/);
 console.log('PASS SMS: modem errors surface; false successes rejected; all message parts sent; partial sends reported.');
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('node:fs'),assert=require('node:assert/strict');
const factory=new Function('baseclass',fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/chester-ui/fan-apply.js','utf8'))({extend:x=>x});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 let next=0;const timers=new Map(),calls=[],states=[];
 const queue=factory.create({setTimer:fn=>{timers.set(++next,fn);return next;},clearTimer:id=>timers.delete(id),apply:async s=>{calls.push(s.percent);return {success:true};},onState:s=>states.push(s)});
 queue.request({percent:'20'},200);queue.request({percent:'40'},200);queue.request({percent:'60'},200);assert.equal(calls.length,0);assert.equal(timers.size,1);const timer=[...timers.values()][0];timers.clear();timer();await tick();assert.deepEqual(calls,['60']);assert.equal(states.at(-1),'applied');assert(!queue.busy());
 let resolveFirst;const ordered=[],confirmed=[];let active=0,maxActive=0;
 const serial=factory.create({apply:async s=>{active++;maxActive=Math.max(maxActive,active);ordered.push(s.percent);if(ordered.length===1)await new Promise(resolve=>resolveFirst=resolve);active--;return {success:true};},onApplied:(r,s,current)=>confirmed.push([s.percent,current])});
 const first=serial.request({percent:'20'},0);serial.request({percent:'40'},0);serial.request({percent:'60'},0);assert.deepEqual(ordered,['20']);resolveFirst();await first;assert.deepEqual(ordered,['20','60']);assert.equal(maxActive,1);assert.deepEqual(confirmed,[['20',false],['60',true]]);
 let fail=true;const results=[];const retry=factory.create({apply:async()=>fail?{success:false,error:'Not confirmed'}:{success:true},onState:s=>results.push(s)});await retry.request({percent:'20'},0);assert.equal(results.at(-1),'error');fail=false;await retry.request({percent:'40'},0);assert.equal(results.at(-1),'applied');
 console.log('PASS fan auto-apply: slider coalescing, serialized requests, latest choice wins, stale replies stay identifiable, failed applies support retry.');
})().catch(e=>{console.error(e);process.exitCode=1;});

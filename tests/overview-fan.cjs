const fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/chester-ui/overview-core.js','utf8');
const fn=new Function('baseclass',fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/chester-ui/fan-state.js','utf8'))({extend:x=>x}).selection;
for(const [mode,percent,label] of [['0',40,'Off'],['2',40,'Auto'],['1',20,'Minimum RPM'],['1',40,'Balanced'],['1',60,'Performance'],['1',37,'Manual'],['1',0,'Manual']])assert.equal(fn({available:true,mode,configured_percent:percent,drive_percent:0}),label);
assert.equal(fn({}),'Unavailable');assert.equal(fn(null),'Unavailable');
assert(s.includes('fanStatus:homeFan'));assert(s.includes('callHomeFanStatus()'));
console.log('PASS Overview fan: all six selection labels use current settings, independent of actual stopped output.');

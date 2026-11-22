const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../payload/www/luci-static/resources/view/misectel-dashboard/overview.js'),'utf8');
const start=code.indexOf('function chesterSelectedMode('),end=code.indexOf('function chesterModeButtons(',start);
const selected=new Function(code.slice(start,end)+';return chesterSelectedMode;')();
assert.equal(selected('AUTO','0'),'auto');assert.equal(selected('LTE','2'),'lte');assert.equal(selected('NR5G','1'),'sa');assert.equal(selected('LTE:NR5G','1'),'nsa');assert.equal(selected('NR5G:LTE','2'),'sa');assert.equal(selected('LTE:NR5G','0'),'auto');
console.log('Overview selected-mode parsing: Auto, SA, NSA, LTE and stale disable flags passed.');

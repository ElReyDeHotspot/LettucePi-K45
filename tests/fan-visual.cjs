const fs=require('node:fs'),assert=require('node:assert/strict');const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/chester-ui/fan-visual.js','utf8'),m=new Function('baseclass',source)({extend:x=>x});
assert.equal(m.reading({available:true,drive_percent:0}).duration,0);assert.equal(m.reading({available:true,drive_percent:39}).value,'39%');assert(m.reading({available:true,drive_percent:90}).duration<m.reading({available:true,drive_percent:10}).duration);assert.equal(m.reading({available:false,drive_percent:100}).value,'—');assert.equal(m.reading({available:true,drive_percent:null}).duration,0);assert.equal(m.reading({available:true,drive_percent:Infinity}).value,'—');assert.equal(m.reading({available:true,drive_percent:200}).value,'100%');assert(!source.includes('RPM'));
console.log('PASS fan graphic: live percentage only, zero stops animation, speed follows output, invalid readings stay unavailable.');

assert.match(m.reading({available:true,drive_percent:0,mode:'2'}).detail,/Below Threshold/);assert.match(m.reading({available:true,drive_percent:0,mode:'1'}).detail,/Not Applied/);assert.match(m.reading({available:true,drive_percent:100,boost:true}).detail,/Cooling Protection/);

assert(!source.includes('LIVE COOLING'));assert(!source.includes('Cooling Status'));assert(!source.includes('Live Fan Output'));

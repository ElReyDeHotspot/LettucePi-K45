const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../payload/www/luci-static/resources/chester-ui/temperature.js'),'utf8');
const temp=new Function('baseclass',source)({extend:o=>o});
assert.equal(temp.fromC(70,'F'),158);assert.equal(temp.toC(158,'F'),70);assert.equal(temp.fromC(1,'F'),33.8);assert.equal(temp.fromC(150,'F'),302);assert.equal(temp.toC(100,'F'),38);assert.equal(temp.fromC(68,'F'),154.4);assert.equal(temp.label(70,'C'),'70°C');assert.equal(temp.label(70,'F'),'158°F');
for(let c=1;c<=150;c++)assert.equal(temp.toC(temp.fromC(c,'F'),'F'),c);
console.log('Fan units: Celsius/Fahrenheit conversions, bounds, hysteresis, rounding and all threshold round-trips passed.');

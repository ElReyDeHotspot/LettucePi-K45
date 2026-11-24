const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const s=fs.readFileSync(path.join(__dirname,'../payload/www/luci-static/resources/chester-ui/overview-core.js'),'utf8');
const a=s.indexOf('function formatTemperatureNumber('),b=s.indexOf('function ',s.indexOf('function normalizeTemperatureText(',a)+20);
const normalize=new Function('isEmptyValue',s.slice(a,b)+';return normalizeTemperatureText;')(v=>v==null||v==='');
for(const input of ['52.7C','52.7°C','52.7Â°C'])assert.equal(normalize(input),'52.7°C');
console.log('PASS temperature text: plain, degree and legacy encoded units normalize consistently.');

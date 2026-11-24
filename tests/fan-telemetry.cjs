const fs=require('node:fs'),assert=require('node:assert/strict');
const root=__dirname+'/../payload/www/luci-static/resources/';
const temperature=new Function('baseclass',fs.readFileSync(root+'chester-ui/temperature.js','utf8'))({extend:x=>x});
const replies={'chester.fan.status':{available:true,drive_percent:40,mode:'1'},'misectel.temp_status':{available:true,value:48500},'misectel.modem_temp':{available:true,value:'37°C'}},requested=[];
global.L={resolveDefault:(p,fallback)=>p.catch(()=>fallback)};
const rpc={declare:s=>{const key=s.object+'.'+s.method;return async()=>{requested.push(key);return replies[key]||{};};}};
const page=new Function('view','poll','rpc','settings','temperature','fanVisual','ui','uci','misectel',fs.readFileSync(root+'view/misectel-system/fan.js','utf8'))({extend:x=>x},{},rpc,{},temperature,{},{},{get:()=>'/sys/class/hwmon/hwmon0/temp1_input'},{});
(async()=>{
 const state={fanUnit:'C',temperatureValue:{},modemTemperatureValue:{},activeModeValue:{textContent:'Manual'},fanGraphic:{update(s){assert.equal(s.drive_percent,40);}}};
 await page.refreshTemperature.call(state);assert.equal(state.temperatureValue.textContent,'48.5°C');assert.equal(state.modemTemperatureValue.textContent,'37°C');
 state.fanUnit='F';replies['misectel.modem_temp'].value='98.6°F';await page.refreshTemperature.call(state);assert.equal(state.modemC,37);assert.equal(state.modemTemperatureValue.textContent,temperature.label(37,'F'));assert.equal(state.temperatureValue.textContent,temperature.label(48.5,'F'));
 replies['misectel.temp_status'].value=0;replies['misectel.modem_temp'].value='0°C';await page.refreshTemperature.call(state);assert.equal(state.temperatureValue.textContent,temperature.label(0,'F'));assert.equal(state.modemTemperatureValue.textContent,temperature.label(0,'F'));
 replies['misectel.temp_status']={available:false};replies['misectel.modem_temp']={available:false};await page.refreshTemperature.call(state);assert.equal(state.modemC,0);assert.equal(state.activeModeValue.textContent,'Manual');
 assert(requested.every(x=>['chester.fan.status','misectel.temp_status','misectel.modem_temp'].includes(x)));assert.equal(requested.length,12);
 console.log('PASS fan telemetry: independent CPU/modem readings, Celsius/Fahrenheit, zero values, last-good display and shared cached modem RPC.');
})().catch(e=>{console.error(e);process.exitCode=1;});

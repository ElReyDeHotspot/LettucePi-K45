const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/view/misectel-system/fan.js','utf8');
const writes=[];let applied=0;global.window={setTimeout(){}};global._=s=>s;
const uci={load:async()=>{},get:()=>true,set:(...args)=>writes.push(args)},misectel={setButtonBusy(){},saveAndApplyUnchecked:async()=>{applied++;},notify(){}};
const page=new Function('view','poll','rpc','settings','temperature','ui','uci','misectel','fanVisual',source)({extend:x=>x},{},{declare:()=>()=>{}},{},{},{},uci,misectel,{});
(async()=>{await page.saveSettings.call({validateThreshold:()=>null,modeSelect:{value:'1'},fanSpeed:'20'},{});assert.equal(applied,1);assert(writes.some(w=>w[2]==='fan_mode'&&w[3]==='1'));assert(writes.some(w=>w[2]==='fan_speed_percent'&&w[3]==='20'));assert(writes.every(w=>w[0]==='misectel'));assert.match(source,/this.fanSpeed=value;this.setMode\(FAN_MODE_ALWAYS_ON\)/);assert.match(source,/fv-save-bar/);console.log('PASS fan preset save: Quiet selects Manual, persists 20% with the cooling mode, and applies through the existing fan service.');})().catch(e=>{console.error(e);process.exitCode=1;});

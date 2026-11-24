const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/view/misectel-system/fan.js','utf8');
const writes=[];let applied=0;global.window={setTimeout(){}};global._=s=>s;
const uci={load:async()=>{},get:()=>true,set:(...args)=>writes.push(args)},misectel={setButtonBusy(){},saveAndApplyUnchecked:async()=>{applied++;},notify(){}};
const page=new Function('view','poll','rpc','settings','temperature','ui','uci','misectel','fanVisual',source)({extend:x=>x},{},{declare:()=>()=>{}},{},{},{},uci,misectel,{});
(async()=>{
 await page.saveSettings.call({validateThreshold:()=>null,modeSelect:{value:'1'},fanSpeed:'37'},{});
 assert.equal(applied,1);assert(writes.some(w=>w[2]==='fan_mode'&&w[3]==='1'));assert(writes.some(w=>w[2]==='fan_speed_percent'&&w[3]==='37'));assert(writes.every(w=>w[0]==='misectel'));
 for(const speed of ['19','101','37.5','bad']){const count=writes.length;await page.saveSettings.call({validateThreshold:()=>null,modeSelect:{value:'1'},fanSpeed:speed,speedInput:{focus(){}}},{});assert.equal(writes.length,count);assert.equal(applied,1);}
 const button={getAttribute:()=> '40',setAttribute(k,v){this[k]=v;}},state={markFanDirty(){},speedInput:{style:{setProperty(){}},setAttribute(k,v){this[k]=v;}},speedValue:{},presetChoice:{},presetButtons:[button]};
 page.setFanSpeed.call(state,'37');assert.equal(state.fanSpeed,'37');assert.equal(state.speedValue.textContent,'37%');assert.equal(state.speedInput['aria-valuetext'],'37%');assert.equal(button['aria-pressed'],'false');page.setFanSpeed.call(state,'40');assert.equal(button['aria-pressed'],'true');
 assert.match(source,/this.setFanSpeed\(value\);this.setMode\(FAN_MODE_ALWAYS_ON\)/);assert.match(source,/fv-save-bar/);
 console.log('PASS fan controls: presets select Manual, arbitrary slider output saves at 37%, invalid values write nothing, slider and preset selection stay synchronized.');
})().catch(e=>{console.error(e);process.exitCode=1;});

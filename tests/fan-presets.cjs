const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/view/misectel-system/fan.js','utf8');
const writes=[];let applied=0,reply={success:true,status:{drive_percent:37}};global.window={setTimeout(){}};global._=s=>s;String.prototype.format=function(...args){let i=0;return this.replace(/%s/g,()=>args[i++]);};
const uci={load:async()=>{},get:()=>true,set(){throw new Error('Generic UCI writes must not be used.');}},misectel={setButtonBusy(){},withLongRpcTimeout:fn=>fn(),notify(){}};
const page=new Function('view','poll','rpc','settings','temperature','ui','uci','misectel','fanVisual',source)({extend:x=>x},{},{declare:spec=>async settings=>{if(spec.method==='save'){applied++;writes.push(JSON.parse(settings));return reply;}return {}; }},{},{},{},uci,misectel,{});
(async()=>{
 await page.saveSettings.call({validateThreshold:()=>null,modeSelect:{value:'1'},fanSpeed:'37',thresholdInput:{value:70},fanGraphic:{update(){}}},{});
 assert.equal(applied,1);assert.deepEqual(writes[0],{mode:'1',percent:'37',threshold:'70'});assert(!source.includes('saveAndApplyUnchecked'));
 for(const speed of ['19','101','37.5','bad']){const count=writes.length;await page.saveSettings.call({validateThreshold:()=>null,modeSelect:{value:'1'},fanSpeed:speed,speedInput:{focus(){}}},{});assert.equal(writes.length,count);assert.equal(applied,1);}
 const button={getAttribute:()=> '40',setAttribute(k,v){this[k]=v;}},state={markFanDirty(){},speedInput:{style:{setProperty(){}},setAttribute(k,v){this[k]=v;}},speedValue:{style:{}},presetChoice:{},presetButtons:[button]};
 page.setFanSpeed.call(state,'37');assert.equal(state.fanSpeed,'37');assert.equal(state.speedValue.textContent,'37%');assert.equal(state.speedInput['aria-valuetext'],'37%');assert.equal(button['aria-pressed'],'false');page.setFanSpeed.call(state,'40');assert.equal(button['aria-pressed'],'true');
 assert.match(source,/this.setFanSpeed\(value\);this.setMode\(FAN_MODE_ALWAYS_ON\)/);assert.match(source,/fv-save-bar/);
 const rejected={validateThreshold:()=>null,modeSelect:{value:'1'},fanSpeed:'100',thresholdInput:{value:70},fanGraphic:{update(){throw new Error('Rejected output must not display success.');}}};reply={success:false,error:'Hardware not confirmed'};await page.saveSettings.call(rejected,{});assert.equal(applied,2);
 console.log('PASS fan controls: presets select Manual, arbitrary slider output saves at 37%, invalid values write nothing, slider and preset selection stay synchronized.');
})().catch(e=>{console.error(e);process.exitCode=1;});

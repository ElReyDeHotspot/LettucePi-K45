const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/view/misectel-system/fan.js','utf8');
const writes=[];
const uci={load:async()=>{},get:()=>true,set(){throw new Error('Generic UCI writes must not be used.');}};
const page=new Function('view','poll','rpc','settings','temperature','ui','uci','misectel','fanVisual',source)({extend:x=>x},{},{declare:()=>()=>{}},{},{},{},uci,{},{});
const state=Object.assign(Object.create(page),{validateThreshold:()=>null,modeSelect:{value:'1'},fanSpeed:'37',thresholdInput:{value:70},saveState:{textContent:'',classList:{add(){}}},fanApply:{request(settings,delay){writes.push([settings,delay]);}}});
state.saveSettings();assert.deepEqual(writes[0],[{mode:'1',percent:'37',threshold:'70'},0]);assert(!source.includes('saveAndApplyUnchecked'));assert(!source.includes('window.location.reload'));
for(const speed of ['19','101','37.5','bad']){const count=writes.length;state.fanSpeed=speed;state.scheduleFanApply(0);assert.equal(writes.length,count);}
const button={getAttribute:()=> '40',setAttribute(k,v){this[k]=v;}},display={markFanDirty(){},speedInput:{style:{setProperty(){}},setAttribute(k,v){this[k]=v;}},speedValue:{style:{}},presetChoice:{},presetButtons:[button]};
page.setFanSpeed.call(display,'37');assert.equal(display.fanSpeed,'37');assert.equal(display.speedValue.textContent,'37%');assert.equal(display.speedInput['aria-valuetext'],'37%');assert.equal(button['aria-pressed'],'false');page.setFanSpeed.call(display,'40');assert.equal(button['aria-pressed'],'true');
assert.match(source,/this.setFanSpeed\(value\);this.setMode\(FAN_MODE_ALWAYS_ON\);this.scheduleFanApply\(0\)/);assert.match(source,/input:ev=>\{this.setFanSpeed\(ev.currentTarget.value\);this.setMode\(FAN_MODE_ALWAYS_ON\);this.scheduleFanApply\(200\)/);assert.match(source,/fanGraphic.presets.appendChild\(presetCard\)/);assert.match(source,/fv-save-bar/);
console.log('PASS fan controls: validated snapshots, immediate preset/mode actions, slider selects Manual, presets sit beneath the fan, no page reload.');

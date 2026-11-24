'use strict';'require view';'require poll';'require rpc';'require chester-ui.settings as settings';'require chester-ui.temperature as temperature';'require ui';'require uci';'require misectel.ui as misectel';const callFanTemperature=rpc.declare({object:'misectel',method:'temp_status',params:['node'],expect:{}});const FAN_MODE_DISABLED='0';const FAN_MODE_ALWAYS_ON='1';const FAN_MODE_TEMPERATURE='2';const DEFAULT_THRESHOLD='70';function createSelect(choices,currentValue){return E('select',{'class':'misectel-select'},choices.map((choice)=>E('option',{'value':choice.value,'selected':choice.value===currentValue?'selected':null},[choice.label])));}
function readFanMode(){const mode=String(uci.get('misectel','main','fan_mode')||'').trim();if(mode===FAN_MODE_DISABLED||mode===FAN_MODE_ALWAYS_ON||mode===FAN_MODE_TEMPERATURE)
return mode;const enabled=String(uci.get('misectel','main','fan_enabled')||'').trim().toLowerCase();return(enabled==='0'||enabled==='false'||enabled==='off'||enabled==='disabled')?FAN_MODE_DISABLED:FAN_MODE_ALWAYS_ON;}
function readThreshold(){const value=String(uci.get('misectel','main','fan_temp_threshold')||'').trim();return/^\d+$/.test(value)?value:DEFAULT_THRESHOLD;}
function withInlineHelp(controlNode,helpText){return E('div',{'class':'misectel-stack'},[controlNode,E('div',{'class':'misectel-card__desc'},[helpText])]);}
return view.extend({async load(){misectel.ensureBaseStyle();await uci.load('misectel');},updateTemperatureVisibility(){if(!this.thresholdField)
return;this.thresholdField.hidden=this.modeSelect.value!==FAN_MODE_TEMPERATURE;},validateThreshold(){
 if(this.modeSelect.value!==FAN_MODE_TEMPERATURE)return null;
 const raw=String(this.thresholdDisplayInput.value||'').trim(),value=Number(raw),low=temperature.fromC(1,this.fanUnit),high=temperature.fromC(150,this.fanUnit);
 if(!raw||!Number.isFinite(value)||value<low||value>high)return 'Enter a threshold from '+low+'°'+this.fanUnit+' to '+high+'°'+this.fanUnit+'.';
 this.thresholdInput.value=String(temperature.toC(value,this.fanUnit));return null;
},async saveSettings(button){const validationError=this.validateThreshold();if(validationError){misectel.notify(validationError,'warning');this.thresholdDisplayInput.focus();return;}
misectel.setButtonBusy(button,true);try{await uci.load('misectel');const mainSid=uci.get('misectel','main')?'main':misectel.ensureNamedSection(uci,'misectel','main','main');const mode=this.modeSelect.value;uci.set('misectel',mainSid,'fan_mode',mode);uci.set('misectel',mainSid,'fan_enabled',mode===FAN_MODE_DISABLED?'0':'1');if(mode===FAN_MODE_TEMPERATURE)
uci.set('misectel',mainSid,'fan_temp_threshold',String(parseInt(this.thresholdInput.value,10)));await misectel.saveAndApplyUnchecked(uci);misectel.notify(_('Fan control settings saved'),'info');window.setTimeout(()=>window.location.reload(),300);}
catch(err){misectel.notify(_('Failed to save fan control settings: %s').format(err.message||err),'error');}
finally{misectel.setButtonBusy(button,false);}},setTemperatureUnit(unit){
 this.fanUnit=unit==='F'?'F':'C';try{window.localStorage.setItem('chester-fan-temperature-unit',this.fanUnit);}catch(e){}
 const c=Number(this.thresholdInput.value)||this.savedThreshold;
 this.thresholdDisplayInput.min=temperature.fromC(1,this.fanUnit);this.thresholdDisplayInput.max=temperature.fromC(150,this.fanUnit);this.thresholdDisplayInput.step=this.fanUnit==='F'?'1.8':'1';this.thresholdDisplayInput.value=temperature.fromC(c,this.fanUnit);
 this.thresholdLabel.textContent='Threshold (°'+this.fanUnit+')';this.rangeInput.setAttribute('aria-label','Fan Temperature Threshold');
 this.lowLabel.textContent=temperature.label(1,this.fanUnit);this.highLabel.textContent=temperature.label(150,this.fanUnit);
 this.savedThresholdValue.textContent=temperature.label(this.savedThreshold,this.fanUnit);
 this.temperatureValue.textContent=this.cpuC==null?'—':temperature.label(this.cpuC,this.fanUnit);
 this.hysteresisNote.textContent='Temperature mode checks the CPU every 5 seconds and uses a '+(this.fanUnit==='F'?'3.6°F':'2°C')+' gap to avoid frequent switching.';
 for(const [value,button] of Object.entries(this.unitButtons)){button.classList.toggle('is-active',value===this.fanUnit);button.setAttribute('aria-pressed',value===this.fanUnit?'true':'false');}
 this.syncThreshold();
},async refreshTemperature(){
 const node=uci.get('misectel','main','temp_node');if(!node)return;
 const status=await L.resolveDefault(callFanTemperature(node),{});let value=Number(status.value);if(!status.available||!Number.isFinite(value))return;
 if(Math.abs(value)>1000)value/=1000;this.cpuC=Number(value.toFixed(1));this.temperatureValue.textContent=temperature.label(this.cpuC,this.fanUnit);
},render(){
 const currentMode=readFanMode(),threshold=readThreshold();this.savedThreshold=Number(threshold);this.cpuC=null;try{this.fanUnit=window.localStorage.getItem('chester-fan-temperature-unit')==='F'?'F':'C';}catch(e){this.fanUnit='C';}
 this.modeSelect=createSelect([],currentMode);this.modeSelect.appendChild(E('option',{value:currentMode,selected:true},[currentMode]));
 this.thresholdInput=E('input',{type:'number',value:threshold});this.thresholdDisplayInput=E('input',{type:'number',value:threshold});
 this.rangeInput=E('input',{type:'range',min:1,max:150,step:1,value:threshold,'aria-label':'Fan Temperature Threshold'});
 const help=E('p',{'class':'st-muted'});this.syncThreshold=()=>{const c=Number(this.thresholdInput.value);this.rangeInput.value=String(c);this.rangeInput.setAttribute('aria-valuetext',temperature.label(c,this.fanUnit));help.textContent='The fan turns on at '+temperature.label(c,this.fanUnit)+' and turns off at '+temperature.label(c-2,this.fanUnit)+'.';};
 this.thresholdDisplayInput.addEventListener('input',()=>{const value=Number(this.thresholdDisplayInput.value);if(this.thresholdDisplayInput.value!==''&&Number.isFinite(value)){this.thresholdInput.value=String(temperature.toC(value,this.fanUnit));this.syncThreshold();}});
 this.thresholdDisplayInput.addEventListener('blur',()=>{if(this.validateThreshold()===null)this.thresholdDisplayInput.value=temperature.fromC(Number(this.thresholdInput.value),this.fanUnit);});
 this.rangeInput.addEventListener('input',()=>{this.thresholdInput.value=this.rangeInput.value;this.thresholdDisplayInput.value=temperature.fromC(Number(this.rangeInput.value),this.fanUnit);this.syncThreshold();});
 this.unitButtons={};const units=E('div',{'class':'st-unit-bar'},[E('div',{'class':'st-unit-options',role:'group','aria-label':'Temperature Units'},['C','F'].map(unit=>{const button=settings.button(unit==='C'?'°C Celsius':'°F Fahrenheit',()=>this.setTemperatureUnit(unit),{'class':'st-unit-button','aria-pressed':'false'});this.unitButtons[unit]=button;return button;}))]);
 const modes=[['0','Off','power','Keep the fan switched off.'],['1','Always on','fan','Keep cooling running continuously.'],['2','Temperature','temperature','Let CPU temperature control the fan.']];
 const choices=E('div',{'class':'st-mode-grid',role:'radiogroup','aria-label':'Fan Mode'},modes.map(([value,label,icon,desc])=>E('label',{'class':'st-mode'},[
 E('input',{type:'radio',name:'chester-fan-mode',value,checked:currentMode===value?'checked':null,change:()=>{this.modeSelect.innerHTML='';this.modeSelect.appendChild(E('option',{value,selected:true},[value]));this.updateTemperatureVisibility();}}),settings.icon(icon),E('strong',{},[label]),E('span',{},[desc])
 ])));
 const thresholdField=settings.field('Threshold (°C)',this.thresholdDisplayInput);this.thresholdLabel=thresholdField.querySelector('label');this.lowLabel=E('span');this.highLabel=E('span');this.thresholdField=E('div',{'class':'st-threshold'},[E('div',{'class':'st-threshold-top'},[E('div',{},[E('strong',{},['Turn on At']),E('p',{'class':'st-muted'},['Based on the CPU temperature.'])]),thresholdField]),this.rangeInput,E('div',{'class':'st-range-labels'},[this.lowLabel,this.highLabel]),help]);
 this.temperatureValue=E('strong',{},['—']);const tempStat=settings.stat('CPU Temperature','—','temperature');tempStat.querySelector('strong').replaceWith(this.temperatureValue);
 const thresholdStat=settings.stat('Saved Threshold',threshold+'°C','temperature');this.savedThresholdValue=thresholdStat.querySelector('strong');this.hysteresisNote=E('p',{'class':'st-muted'});const save=settings.button('Save Changes',(ev)=>this.saveSettings(ev.currentTarget));
 const root=settings.sheet([settings.head('Fan Control','Cooling, made simple.','fan'),units,E('div',{'class':'st-summary'},[tempStat,settings.stat('Current Mode',modes.find(m=>m[0]===currentMode)[1],'fan'),thresholdStat]),settings.card('How Should It Cool?','Choose a mode. Changes take effect when you save.',[choices,this.thresholdField,settings.footer(save,'Your current mode stays active until you save.')],'fan'),this.hysteresisNote],'st-fan');
 this.setTemperatureUnit(this.fanUnit);this.updateTemperatureVisibility();this.refreshTemperature();poll.add(()=>this.refreshTemperature(),15);return root;
},handleSave:null,handleSaveApply:null,handleReset:null});
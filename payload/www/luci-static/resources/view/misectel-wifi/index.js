'use strict';'require view';'require rpc';'require ui';'require uci';'require dom';'require chester-ui.settings as settings';'require misectel.ui as misectel';const callWirelessStatus=rpc.declare({object:'network.wireless',method:'status',expect:{}});const callIwinfoInfo=rpc.declare({object:'iwinfo',method:'info',params:['device'],expect:{}});const callIwinfoCountrylist=rpc.declare({object:'iwinfo',method:'countrylist',params:['device'],expect:{}});const callIwinfoFreqlist=rpc.declare({object:'iwinfo',method:'freqlist',params:['device'],expect:{}});const callIwinfoPhyname=rpc.declare({object:'iwinfo',method:'phyname',params:['section'],expect:{}});const ENCRYPTION_CHOICES=[{value:'none',label:_('Open Network')},{value:'psk2',label:'WPA2-PSK'},{value:'sae',label:'WPA3-SAE'},{value:'sae-mixed',label:_('WPA2/WPA3 Mixed')}];const OPEN_ENCRYPTION_VALUES=['none','open'];function isOpenEncryption(value){return OPEN_ENCRYPTION_VALUES.indexOf(String(value||'').toLowerCase())!==-1;}
function normalizeEncryption(value){return isOpenEncryption(value)?'none':misectel.text(value,'psk2');}
function normalizeCountryCode(value){return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,2);}
function wifiModeFamily(htmode){const mode=String(htmode||'').toUpperCase();if(mode.indexOf('EHT')>=0)
return'eht';if(mode.indexOf('HE')>=0)
return'he';if(mode.indexOf('VHT')>=0)
return'vht';if(mode.indexOf('HT')>=0)
return'ht';return'legacy';}
function wifiModeLabel(family){switch(family){case'eht':return'BE';case'he':return'AX';case'vht':return'AC';case'ht':return'N';default:return _('Legacy');}}
function makeModeChoices(widthChoices,currentWidth){const families={};const choices=misectel.ensureArray(widthChoices);const order=['legacy','ht','vht','he','eht'];choices.forEach((mode)=>{const family=wifiModeFamily(mode);if(!families[family])
families[family]=[];if(families[family].indexOf(mode)===-1)
families[family].push(mode);});const currentFamily=wifiModeFamily(currentWidth);if(currentWidth&&!families[currentFamily])
families[currentFamily]=[currentWidth];return order.filter((family)=>families[family]?.length).map((family)=>({value:family,label:wifiModeLabel(family),modes:families[family]}));}
function makeCountryChoices(countryChoices,currentCountry){const results=misectel.ensureArray(countryChoices);const selected=normalizeCountryCode(currentCountry);const choices=results.map((entry)=>{const code=normalizeCountryCode(entry?.code||entry?.iso3166);const country=misectel.text(entry?.country,code||_('Unknown'));return{value:code,label:code?'%s - %s'.format(code,country):country};}).filter((entry)=>!!entry.value);if(selected&&choices.findIndex((entry)=>entry.value===selected)===-1)
choices.unshift({value:selected,label:selected});return choices;}
function firstApSection(radioName,radioData){const configured=uci.sections('wireless','wifi-iface').find((section)=>section.device===radioName&&section.mode==='ap');if(configured)
return configured['.name'];const runtime=misectel.ensureArray(radioData?.interfaces).find((entry)=>entry?.config?.mode==='ap'&&entry.section);return runtime?.section||null;}
function firstApDevice(radioData){const runtime=misectel.ensureArray(radioData?.interfaces).find((entry)=>entry?.config?.mode==='ap'&&entry.ifname);return runtime?.ifname||null;}
function radioBandLabel(radioData){const band=radioData?.config?.band||radioData?.iwinfo?.channel||'';switch(band){case'2g':return _('2.4 GHz');case'5g':return _('5.8 GHz');case'6g':return _('6 GHz');default:return misectel.text(band,_('Unknown Band'));}}
function radioBandKey(radioData){const band=String(radioData?.config?.band||'').toLowerCase();if(band==='2g'||band==='5g'||band==='6g')
return band;return'';}
function normalizeChannelValue(value){const raw=String(value||'').trim().toLowerCase();if(!raw||raw==='auto')
return'auto';return String(parseInt(raw,10)||value);}
function country2gChannels(country){const code=normalizeCountryCode(country);if(code==='JP')
return 14;if(['US','CA','MX','TW','PA','PR','CO','PH'].indexOf(code)>=0)
return 11;return 13;}
function country5gChannels(country){const code=normalizeCountryCode(country);const policies={FCC:[36,40,44,48,149,153,157,161,165],ETSI:[36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140],JP:[36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,144],KR:[36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,144,149,153,157,161],CN:[36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,149,153,157,161,165]};if(['US','CA','MX','TW','PA','PR','CO','PH'].indexOf(code)>=0)
return policies.FCC;if(code==='JP')
return policies.JP;if(code==='KR')
return policies.KR;if(['CN','HK','MO'].indexOf(code)>=0)
return policies.CN;if(code==='00')
return null;return policies.ETSI;}
function filterChannelsByCountry(channelChoices,country,bandKey){const selected=misectel.ensureArray(channelChoices);if(bandKey==='2g'){const maxChannel=country2gChannels(country);return selected.filter((entry)=>entry.value==='auto'||parseInt(entry.value,10)<=maxChannel);}
if(bandKey==='5g'){const allowed=country5gChannels(country);if(!allowed)
return selected;return selected.filter((entry)=>entry.value==='auto'||allowed.indexOf(parseInt(entry.value,10))>=0);}
return selected;}
function makeChannelChoices(freqList,currentChannel,bandKey,country){const seen={};const normalizedCurrent=normalizeChannelValue(currentChannel);const baseChoices=[{value:'auto',label:_('Auto')}];misectel.ensureArray(freqList).forEach((entry)=>{const channel=String(entry?.channel||'').trim();const band=String(entry?.band||'');if(!channel||seen[channel])
return;if(entry?.restricted===true||channel==='0')
return;if(bandKey==='2g'&&band!=='2')
return;if(bandKey==='5g'&&band!=='5')
return;if(bandKey==='6g'&&band!=='6')
return;seen[channel]=true;baseChoices.push({value:channel,label:_('%s (%s MHz)').format(channel,entry?.mhz||'--')});});let choices=filterChannelsByCountry(baseChoices,country,bandKey);if(normalizedCurrent!=='auto'&&choices.findIndex((entry)=>entry.value===normalizedCurrent)===-1)
choices.push({value:normalizedCurrent,label:normalizedCurrent});return choices;}
function makeWidthChoices(radioData){const modes=misectel.ensureArray(radioData?.iwinfo?.htmodes);const current=misectel.text(uci.get('wireless',radioData?.section,'htmode')||radioData?.config?.htmode||'','');if(!modes.length)
return current?[current]:['HT20'];if(current&&modes.indexOf(current)===-1)
modes.unshift(current);return modes;}
return view.extend({async load(){misectel.ensureBaseStyle();await uci.load(['wireless','misectel']);const wireless=await L.resolveDefault(callWirelessStatus(),{});const configuredRadios=uci.sections('wireless','wifi-device').map((section)=>section['.name']);const radioNames=Object.keys(L.isObject(wireless)?wireless:{}).concat(configuredRadios).filter((name,index,list)=>{return list.indexOf(name)===index;}).sort();const iwinfo={};const countryLists={};const freqLists={};const radioDevices={};await Promise.all(radioNames.map(async(radioName)=>{const runtimeRadio=wireless?.[radioName];const phyInfo=await L.resolveDefault(callIwinfoPhyname(radioName),{});const device=firstApDevice(runtimeRadio)||phyInfo?.phyname;if(!device)
return;radioDevices[radioName]=device;iwinfo[radioName]=await L.resolveDefault(callIwinfoInfo(device),{});countryLists[radioName]=misectel.ensureArray((await L.resolveDefault(callIwinfoCountrylist(device),{}))?.results);freqLists[radioName]=misectel.ensureArray((await L.resolveDefault(callIwinfoFreqlist(device),{}))?.results);}));return{wireless,iwinfo,countryLists,freqLists,radioDevices};},buildRadioState(data){const runtimeWireless=L.isObject(data.wireless)?data.wireless:{};const configuredRadios=uci.sections('wireless','wifi-device').map((section)=>section['.name']);const radioNames=Object.keys(runtimeWireless).concat(configuredRadios).filter((name,index,list)=>{return list.indexOf(name)===index;}).sort();return radioNames.map((radioName)=>{const runtimeRadio=runtimeWireless[radioName]||{};const radio=Object.assign({},runtimeRadio,{config:{band:runtimeRadio?.config?.band||uci.get('wireless',radioName,'band')||'',channel:runtimeRadio?.config?.channel||uci.get('wireless',radioName,'channel')||'',htmode:runtimeRadio?.config?.htmode||uci.get('wireless',radioName,'htmode')||'',country:runtimeRadio?.config?.country||uci.get('wireless',radioName,'country')||''},iwinfo:data.iwinfo?.[radioName]||runtimeRadio?.iwinfo||{htmodes:[],country:'',hwmodes:[]}});const ifaceSection=firstApSection(radioName,radio);const widthChoices=makeWidthChoices(Object.assign({},radio,{section:radioName}));const currentWidth=uci.get('wireless',radioName,'htmode')||radio?.config?.htmode||radio?.iwinfo?.htmode||'';const currentCountry=normalizeCountryCode(uci.get('wireless',radioName,'country')||radio?.config?.country||radio?.iwinfo?.country||'');const bandKey=radioBandKey(radio);const currentChannel=normalizeChannelValue(uci.get('wireless',radioName,'channel')||radio?.config?.channel||'');return{name:radioName,bandLabel:radioBandLabel(radio),bandKey:bandKey,device:data.radioDevices?.[radioName]||'',channel:currentChannel,width:misectel.text(currentWidth,''),widthChoices,modeChoices:makeModeChoices(widthChoices,currentWidth),mode:wifiModeFamily(currentWidth),country:currentCountry,countryChoices:makeCountryChoices(data.countryLists?.[radioName],currentCountry),freqChoices:misectel.ensureArray(data.freqLists?.[radioName]),section:ifaceSection,ssid:misectel.text(ifaceSection?uci.get('wireless',ifaceSection,'ssid'):'',''),encryption:normalizeEncryption(ifaceSection?uci.get('wireless',ifaceSection,'encryption'):'psk2'),key:misectel.text(ifaceSection?uci.get('wireless',ifaceSection,'key'):'',''),enabled:(ifaceSection?uci.get('wireless',ifaceSection,'disabled'):'0')!=='1'};}).filter((radio)=>!!radio.section);},createPasswordControl(value,placeholder){const keyInput=E('input',{'class':'misectel-input','type':'password','value':value||'','placeholder':placeholder});const revealInput=E('input',{'type':'checkbox'});const fieldNode=E('div',{'class':'misectel-stack'},[keyInput,E('label',{'class':'misectel-inline-check'},[revealInput,E('span',{},[_('Show Password')])])]);revealInput.addEventListener('change',()=>{keyInput.type=revealInput.checked?'text':'password';});return{fieldNode,keyInput,revealInput};},createCountryInput(radio){const choices=radio.countryChoices?.length?radio.countryChoices:[{value:radio.country||'00',label:radio.country||'00'}];return E('select',{'class':'misectel-select'},choices.map((choice)=>E('option',{'value':choice.value,'selected':choice.value===radio.country?'selected':null},[choice.label])));},createTuningControls(radio){const modeChoices=radio.modeChoices?.length?radio.modeChoices:[{value:wifiModeFamily(radio.width),label:wifiModeLabel(wifiModeFamily(radio.width)),modes:radio.widthChoices?.length?radio.widthChoices:['HT20']}];const modeSelect=E('select',{'class':'misectel-select'},modeChoices.map((choice)=>E('option',{'value':choice.value,'selected':choice.value===radio.mode?'selected':null},[choice.label])));const widthSelect=E('select',{'class':'misectel-select'});const channelSelect=E('select',{'class':'misectel-select'});const countryInput=this.createCountryInput(radio);const syncWidths=(modeValue,preferredWidth)=>{const activeChoice=modeChoices.find((choice)=>choice.value===modeValue)||modeChoices[0];const widths=activeChoice?.modes?.length?activeChoice.modes:[radio.width||'HT20'];const selectedWidth=widths.indexOf(preferredWidth)>=0?preferredWidth:(widths.indexOf(widthSelect.value)>=0?widthSelect.value:widths[0]);dom.content(widthSelect,widths.map((mode)=>E('option',{'value':mode,'selected':mode===selectedWidth?'selected':null},[mode])));widthSelect.value=selectedWidth;modeSelect.value=activeChoice.value;};const syncChannels=(preferredChannel)=>{const nextValue=normalizeChannelValue(preferredChannel||channelSelect.value||radio.channel);const choices=makeChannelChoices(radio.freqChoices,nextValue,radio.bandKey,countryInput.value);const selected=choices.find((choice)=>choice.value===nextValue)?nextValue:'auto';dom.content(channelSelect,choices.map((choice)=>E('option',{'value':choice.value,'selected':choice.value===selected?'selected':null},[choice.label])));channelSelect.value=selected;};modeSelect.addEventListener('change',()=>syncWidths(modeSelect.value,null));countryInput.addEventListener('change',()=>syncChannels(channelSelect.value));syncWidths(radio.mode,radio.width);syncChannels(radio.channel);const power=String(uci.get('wireless',radio.name,'txpower')||''),max=radio.bandKey==='2g'?25:28;const values=Array.from({length:max+1},(_,i)=>String(max-i));if(power&&!values.includes(power))values.unshift(power);const powerSelect=E('select',{},[E('option',{value:'',selected:!power?'selected':null},['Auto (driver default)']),...values.map(v=>E('option',{value:v,selected:v===power?'selected':null},[v+' dBm']))]);return{channelSelect,modeSelect,widthSelect,countryInput,powerSelect};},bindPasswordVisibility(encryptionSelect,passwordField,keyInput,revealInput,placeholder){const syncVisibility=()=>{const open=isOpenEncryption(encryptionSelect.value);if(open){keyInput.value='';keyInput.disabled=true;keyInput.type='password';revealInput.checked=false;passwordField.hidden=true;return;}
keyInput.disabled=false;keyInput.placeholder=placeholder;passwordField.hidden=false;};encryptionSelect.addEventListener('change',syncVisibility);syncVisibility();},createPowerControl(input){input.setAttribute('aria-label',_('Wi-Fi Power'));const state=E('span',{},[input.checked?_('On'):_('Off')]);input.addEventListener('change',()=>dom.content(state,[input.checked?_('On'):_('Off')]));return E('label',{'class':'misectel-inline-check'},[input,state]);},createTuningPanel(radio,controls){return E('details',{'class':'wf-advanced'},[
 E('summary',{},['Advanced radio settings']),
 E('p',{'class':'st-muted'},['Keep your current settings unless you need to adjust coverage or compatibility.']),
 E('div',{'class':'st-fields'},[
 settings.field('Channel',controls.channelSelect),settings.field('Channel width',controls.widthSelect),
 settings.field('Wi-Fi standard',controls.modeSelect),settings.field('Country / region',controls.countryInput),settings.field('Transmit power',controls.powerSelect,'The driver enforces regulatory limits.')
 ])]);},
createNetworkFields(radios,shared){
 const radio=radios[0],tuning={};radios.forEach(r=>tuning[r.name]=this.createTuningControls(r));
 const enabledInput=E('input',{type:'checkbox',checked:radio.enabled?'checked':null,'aria-label':shared?'Wi-Fi Power':radio.bandLabel+' Wi-Fi Power'});
 const ssidInput=E('input',{type:'text',value:radio.ssid||'',maxlength:32,placeholder:'Enter Wi-Fi name'});
 const encryptionSelect=E('select',{},ENCRYPTION_CHOICES.map(c=>E('option',{value:c.value,selected:c.value===radio.encryption?'selected':null},[c.label])));
 const password=this.createPasswordControl(radio.key,'At least 8 characters');password.keyInput.setAttribute('aria-label',shared?'Wi-Fi password':radio.bandLabel+' Wi-Fi password');
 const passwordField=settings.field('Wi-Fi password',password.fieldNode,'Used when connecting a phone, computer or other device.');
 this.bindPasswordVisibility(encryptionSelect,passwordField,password.keyInput,password.revealInput,'At least 8 characters');
 const state=E('strong',{'class':'wf-state'},[enabledInput.checked?'On':'Off']);
 enabledInput.addEventListener('change',()=>dom.content(state,[enabledInput.checked?'On':'Off']));
 const node=settings.card(shared?'Your Wi-Fi network':radio.bandLabel+' network',shared?'One name and password for 2.4 GHz and 5 GHz.':'A separate name and password for this band.',[
 E('div',{'class':'wf-power'},[settings.toggle('Wi-Fi Power',enabledInput,shared?'Turn both bands on or off.':'Turn this band on or off.'),state]),
 E('div',{'class':'st-fields wf-basics'},[settings.field('Wi-Fi name',ssidInput,'This is the name devices see in their Wi-Fi list.'),passwordField]),
 E('details',{'class':'wf-advanced'},[E('summary',{},['Security settings']),settings.field('Security',encryptionSelect,'WPA2 works with most devices. An open network has no password.')]),
 ...radios.map(r=>E('div',{'class':'wf-radio'},[E('h4',{},[r.bandLabel.replace('5.8','5')]),this.createTuningPanel(r,tuning[r.name])]))
 ],'router');
 return {node,controls:shared?{enabledInput,ssidInput,encryptionSelect,keyInput:password.keyInput,tuning}:Object.assign({enabledInput,ssidInput,encryptionSelect,keyInput:password.keyInput},tuning[radio.name])};
},
renderLinkedSection(radios){return this.createNetworkFields(radios,true);},
renderSeparateSection(radios){const controls={};return {node:E('div',{'class':'wf-networks'},radios.map(r=>{const result=this.createNetworkFields([r],false);controls[r.name]=result.controls;return result.node;})),controls};},
async saveChanges(button){misectel.setButtonBusy(button,true);try{await uci.load(['wireless','misectel']);if(!this.radioState.length)
throw new Error(_('No manageable AP wireless interfaces were found'));const linked=this.radioState.length>1&&this.linkedMode===true;const misectelSection=misectel.ensureNamedSection(uci,'misectel','wifi','wifi_defaults');uci.set('misectel',misectelSection,'linked_bands',linked?'1':'0');if(linked){const controls=this.linkedControls;const enabled=controls.enabledInput.checked;const ssid=controls.ssidInput.value.trim();const encryption=controls.encryptionSelect.value;const key=controls.keyInput.value;if(!ssid)
throw new Error(_('SSID is required'));if(!isOpenEncryption(encryption)&&key.length<8)
throw new Error(_('Encrypted Wi-Fi passwords must be at least 8 characters long'));this.radioState.forEach((radio)=>{if(!radio.section)
return;const tune=controls.tuning[radio.name];const country=normalizeCountryCode(tune.countryInput.value);if(tune.powerSelect.value)uci.set('wireless',radio.name,'txpower',tune.powerSelect.value);else uci.unset('wireless',radio.name,'txpower');uci.set('wireless',radio.section,'disabled',enabled?'0':'1');uci.set('wireless',radio.section,'ssid',ssid);uci.set('wireless',radio.section,'encryption',encryption);if(isOpenEncryption(encryption))
uci.unset('wireless',radio.section,'key');else
uci.set('wireless',radio.section,'key',key);uci.set('wireless',radio.name,'channel',normalizeChannelValue(tune.channelSelect.value));uci.set('wireless',radio.name,'htmode',tune.widthSelect.value);if(country)
uci.set('wireless',radio.name,'country',country);else
uci.unset('wireless',radio.name,'country');});}
else{this.radioState.forEach((radio)=>{if(!radio.section)
return;const controls=this.separateControls[radio.name];const encryption=controls.encryptionSelect.value;const country=normalizeCountryCode(controls.countryInput.value);if(controls.powerSelect.value)uci.set('wireless',radio.name,'txpower',controls.powerSelect.value);else uci.unset('wireless',radio.name,'txpower');if(!controls.ssidInput.value.trim())
throw new Error(_('SSID is required for %s').format(radio.bandLabel));if(!isOpenEncryption(encryption)&&controls.keyInput.value.length<8)
throw new Error(_('Password for %s must be at least 8 characters long').format(radio.bandLabel));uci.set('wireless',radio.section,'disabled',controls.enabledInput.checked?'0':'1');uci.set('wireless',radio.section,'ssid',controls.ssidInput.value.trim());uci.set('wireless',radio.section,'encryption',encryption);if(isOpenEncryption(encryption))
uci.unset('wireless',radio.section,'key');else
uci.set('wireless',radio.section,'key',controls.keyInput.value);uci.set('wireless',radio.name,'channel',normalizeChannelValue(controls.channelSelect.value));uci.set('wireless',radio.name,'htmode',controls.widthSelect.value);if(country)
uci.set('wireless',radio.name,'country',country);else
uci.unset('wireless',radio.name,'country');});}
await misectel.saveAndApplyUnchecked(uci);window.setTimeout(()=>window.location.reload(),300);}
catch(err){misectel.notify(_('Failed to save Wi-Fi settings: %s').format(err.message||err),'error');}
finally{misectel.setButtonBusy(button,false);}},switchMode(linked){this.linkedMode=linked;if(this.linkedToggle)
this.linkedToggle.checked=linked;if(this.linkedModeText)
dom.content(this.linkedModeText,[linked?_('Shared'):_('Separate')]);dom.content(this.modeBody,linked?this.linkedNode:this.separateNode);},render(data){
 this.radioState=this.buildRadioState(data);this.linkedMode=this.radioState.length>1&&uci.get('misectel','wifi_defaults','linked_bands')!=='0';
 if(!this.radioState.length)return settings.sheet([settings.head('Wi-Fi','No configurable wireless network is available.','router')],'st-wifi');
 const separate=this.renderSeparateSection(this.radioState),linked=this.radioState.length>1?this.renderLinkedSection(this.radioState):null;
 this.separateControls=separate.controls;this.linkedControls=linked?.controls;this.separateNode=separate.node;this.linkedNode=linked?.node;
 this.modeBody=E('div');this.linkedToggle=this.radioState.length>1?E('input',{type:'checkbox',checked:this.linkedMode?'checked':null,'aria-label':'Use one name and password'}):null;
 this.linkedModeText=E('span',{'class':'wf-state'},[this.linkedMode?'Shared':'Separate']);
 if(this.linkedToggle)this.linkedToggle.addEventListener('change',()=>this.switchMode(this.linkedToggle.checked));
 const save=settings.button('Save & Apply',ui.createHandlerFn(this,ev=>this.saveChanges(ev.currentTarget)));
 const page=settings.sheet([
 settings.head('Wi-Fi','Your network. Simple to connect. Easy to manage.','router'),
 this.linkedToggle?settings.card('Network setup','Choose how devices connect to your two Wi-Fi bands.',[
 E('div',{'class':'wf-power'},[settings.toggle('Use one name and password',this.linkedToggle,'Recommended: both bands share the same Wi-Fi name and password.'),this.linkedModeText])
 ]):'',this.modeBody,
 settings.footer(save,'Changes take effect after you save. Wi-Fi devices may briefly disconnect.')
 ],'st-wifi');
 this.switchMode(!!linked&&this.linkedMode);return page;
},handleSave:null,handleSaveApply:null,handleReset:null});
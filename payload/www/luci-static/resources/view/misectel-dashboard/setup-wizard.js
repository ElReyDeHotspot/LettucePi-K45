'use strict';
'require view';
'require rpc';
'require dom';
const WIFI_ENCRYPTIONS=[['sae-mixed','WPA2/WPA3 Personal'],['psk2','WPA2 Personal'],['sae','WPA3 Personal'],['none','Open — no password']];
function openWifi(value){return value==='none'||value==='open';}
function wifiSecurityLabel(value){return WIFI_ENCRYPTIONS.find(([v])=>v===value)?.[1]||value;}
const STEPS=['SIM Selection','APN Selection','WAN Port','TTL/HL','Root Password','Timezone','Wi-Fi','Review'];
const context=rpc.declare({object:'misectel_setup_wizard',method:'get_setup_wizard_context',expect:{}});
const network=rpc.declare({object:'misectel_setup_wizard',method:'get_setup_wizard_network_context',expect:{}});
const wireless=rpc.declare({object:'misectel_setup_wizard',method:'get_setup_wizard_wifi_context',expect:{}});
const apply=rpc.declare({object:'misectel_setup_wizard',method:'apply_setup_wizard_config',params:['config_json'],expect:{}});
function timezoneRegion(zone){return zone?(zone.includes('/')?zone.split('/')[0]:'Other'):'';}
function validIpv4(value){const parts=String(value||'').split('.');return parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255);}
function validNumber(value){return /^[1-9]\d{0,2}$/.test(String(value))&&Number(value)<=255;}
function validateDraft(s,step){
 if(step===0&&!['1','2'].includes(s.sim))return 'Choose SIM 1 or SIM 2.';
 if(step===1&&s.apn&&!/^[A-Za-z0-9][A-Za-z0-9.-]{0,99}$/.test(s.apn))return 'Enter a valid APN, such as fast.t-mobile.com.';
 if(step===2&&s.wan.mode==='wan'&&s.wan.proto==='static'&&(!validIpv4(s.wan.ipaddr)||!validIpv4(s.wan.netmask)||(s.wan.gateway&&!validIpv4(s.wan.gateway))))return 'Enter a valid static IPv4 address, netmask and gateway.';
 if(step===3&&(!validNumber(s.ttl)||!validNumber(s.hl)))return 'TTL and HL must be whole numbers from 1 to 255.';
 if(step===4&&s.password&&(s.password.length<5||/[\r\n]/.test(s.password)))return 'Use at least 5 characters, without line breaks.';
 if(step===4&&s.password!==s.confirm)return 'The two passwords do not match.';
 if(step===5&&s.zoneRegion&&!s.zone)return 'Choose a city or timezone in this region.';
 if(step===6&&s.wifiOn)for(const r of s.radios){const w=s.shared?s.sharedWifi:r;if(!w.ssid.trim()||w.ssid.length>32)return 'Enter a Wi-Fi name with 1–32 characters.';if(!WIFI_ENCRYPTIONS.some(([v])=>v===w.encryption))return 'Choose a Wi-Fi encryption type.';if(!openWifi(w.encryption)&&(w.key.length<8||w.key.length>63))return 'Use a Wi-Fi password with 8–63 characters.';}
 return '';
}
return view.extend({
 async load(){return Object.assign({},...await Promise.all([context(),network(),wireless()]));},
 render(data){
  if(data.code===403||data.completed){window.location.replace(L.url('admin','dashboard','overview'));return E('div');}
  document.body.classList.add('chester-quick-start');this.data=data;const c=data.chester||{},radios=(data.wifi?.radios||[]).map(r=>({name:r.name,section:r.section,label:r.band_label,ssid:r.ssid||'',key:r.key||'',encryption:r.encryption||'sae-mixed'}));
  this.state={step:0,sim:c.sim_slot==='2'?'2':'1',apn:'',wan:{role:data.wan?.role||'',device:data.wan?.device||'',exists:!!data.wan?.exists,mode:data.wan?.optional_wan_mode==='lan'?'lan':'wan',proto:data.wan?.proto||'dhcp',username:data.wan?.username||'',password:data.wan?.password||'',ipaddr:data.wan?.ipaddr||'',netmask:data.wan?.netmask||'',gateway:data.wan?.gateway||'',dns:data.wan?.dns||''},ttlOn:c.ttl_enabled===true,ttl:String(c.ttl||64),hl:String(c.hl||64),password:'',confirm:'',zone:c.timezones?.[c.zonename]?c.zonename:'',zoneRegion:c.timezones?.[c.zonename]?timezoneRegion(c.zonename):'',wifiOn:radios.some((r,i)=>data.wifi.radios[i].enabled!==false),shared:data.wifi?.linked_bands!==false,radios,sharedWifi:{ssid:radios[0]?.ssid||'Chester K45P',key:radios[0]?.key||'',encryption:radios[0]?.encryption||'sae-mixed'}};
  this.panel=E('div',{'class':'cw-panel'});this.progress=E('div',{'class':'cw-progress'});this.error=E('p',{'class':'cw-error',role:'alert'});this.root=E('main',{'class':'cw-shell'},[E('link',{rel:'stylesheet',href:L.resource('chester-ui/quick-start.css')+'?v=20261122-6'}),E('header',{'class':'cw-brand'},[E('img',{src:'/luci-static/misectel/green-leaf.svg',alt:''}),E('div',{},[E('strong',{},['Chester K45P']),E('span',{},['Quick Start'])])]),this.progress,this.panel]);this.show();return this.root;
 },
 field(label,input,help){const id='cw-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-');input.id=id;return E('div',{'class':'cw-field'},[E('label',{'for':id},[label]),input,help?E('small',{},[help]):null].filter(Boolean));},
 input(object,key,label,type='text',help){const input=E('input',{type,value:object[key]||'',autocomplete:type==='password'?'new-password':'off',input:ev=>{object[key]=ev.target.value;}});return this.field(label,input,help);},
 select(object,key,label,choices){return this.field(label,E('select',{change:ev=>{object[key]=ev.target.value;}},choices.map(([v,t])=>E('option',{value:v,selected:String(object[key])===v?'selected':null},[t]))));},
 toggle(label,on,change){const id='cw-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-');return E('label',{'class':'cw-switch','for':id},[E('span',{},[label]),E('input',{id,type:'checkbox',checked:on?'checked':null,change:ev=>change(ev.target.checked)})]);},
 choice(value,title,copy){const s=this.state;return E('button',{type:'button','class':'cw-choice'+(s.sim===value?' is-selected':''),'aria-pressed':s.sim===value?'true':'false',click:()=>{s.sim=value;this.show();}},[E('span',{'class':'cw-sim-icon','aria-hidden':'true'},[value]),E('strong',{},[title]),E('small',{},[copy]),E('span',{'class':'cw-choice-check','aria-hidden':'true'},[s.sim===value?'✓':''])]);},
 body(){const s=this.state,c=this.data.chester||{};
  switch(s.step){
   case 0:return [E('p',{'class':'cw-lead'},['Choose the SIM you want to use. You can change it later in Chester Mods.']),E('div',{'class':'cw-choices'},[this.choice('1','SIM 1','Use the card in slot 1'),this.choice('2','SIM 2','Use the card in slot 2')]),E('p',{'class':'cw-hint'},['Manual selection keeps your chosen SIM, even when it has no data connection.'])];
   case 1:{const preset=E('select',{change:ev=>{if(ev.target.value!=='custom'){s.apn=ev.target.value;this.show();}}},[['','Automatic / Carrier Default'],...(c.apn_presets||[]).map(p=>[p.apn,p.operator+' · '+p.apn]),['custom','Custom APN']].map(([v,t])=>E('option',{value:v,selected:(s.apn===v||v==='custom'&&s.apn&&!(c.apn_presets||[]).some(p=>p.apn===s.apn))?'selected':null},[t])));return [E('p',{'class':'cw-lead'},['Set the data profile for SIM '+s.sim+'.']),this.field('Carrier Profile',preset),this.input(s,'apn','APN','text','Leave blank for the carrier default.')];}
   case 2:{const mode=this.select(s.wan,'mode','Use the 2.5Gbps Socket As',[['wan','WAN — Internet from another modem'],['lan','LAN — Connect a local device']]);mode.querySelector('select').addEventListener('change',()=>this.show());const proto=this.select(s.wan,'proto','Internet Connection',[['dhcp','Automatic (DHCP)'],['pppoe','PPPoE'],['static','Static IPv4']]);proto.querySelector('select').addEventListener('change',()=>this.show());return [E('p',{'class':'cw-lead'},['The other three Ethernet ports stay available for local devices.']),mode,...(s.wan.mode==='wan'?[proto,...(s.wan.proto==='pppoe'?[this.input(s.wan,'username','PPPoE Username'),this.input(s.wan,'password','PPPoE Password','password')]:s.wan.proto==='static'?['ipaddr','netmask','gateway','dns'].map((k,i)=>this.input(s.wan,k,['IPv4 address','Netmask','Gateway','DNS servers'][i])):[])]:[E('p',{'class':'cw-hint'},['Use cellular for Internet while this socket serves your local network.'])])];}
   case 3:return [E('p',{'class':'cw-lead'},['Set IPv4 TTL and IPv6 Hop Limit for traffic leaving your local network.']),this.toggle('Enable TTL/HL',s.ttlOn,on=>{s.ttlOn=on;this.show();}),...(s.ttlOn?[E('div',{'class':'cw-columns'},[this.input(s,'ttl','IPv4 TTL','number'),this.input(s,'hl','IPv6 Hop Limit','number')])]:[E('p',{'class':'cw-hint'},['Normal network values will be used.'])])];
   case 4:return [E('p',{'class':'cw-lead'},['The root and admin logins share this password.']),this.input(s,'password','New Root Password','password','Leave blank to keep the current password.'),this.input(s,'confirm','Confirm Password','password')];
   case 5:{
    const groups={};for(const zone of Object.keys(c.timezones||{}).sort()){const region=timezoneRegion(zone);(groups[region]||(groups[region]=[])).push(zone);}
    const regionField=this.select(s,'zoneRegion','Region',[['','Keep current timezone'],...Object.keys(groups).sort().map(r=>[r,r==='Etc'?'UTC / fixed offsets':r])]);
    regionField.querySelector('select').addEventListener('change',()=>{s.zone='';this.show();});
    const cityField=this.select(s,'zone','City / Timezone',[['',s.zoneRegion?'Choose a city or timezone':'Select a region first'],...(groups[s.zoneRegion]||[]).map(z=>[z,(z.includes('/')?z.slice(z.indexOf('/')+1):z).replace(/_/g,' ').replace(/\//g,' / ')])]);
    cityField.querySelector('select').disabled=!s.zoneRegion;
    return [E('p',{'class':'cw-lead'},['Choose your region, then the city closest to you that uses the same local time.']),regionField,cityField];
   }
   case 6:{
    const controls=[E('p',{'class':'cw-lead'},['Choose a name, encryption and password, or turn Wi-Fi off and use Ethernet.']),this.toggle('Enable Wi-Fi',s.wifiOn,on=>{s.wifiOn=on;this.show();})];
    if(!s.wifiOn)return [...controls,E('p',{'class':'cw-hint'},['Wi-Fi will turn off after Apply. Connect by Ethernet to manage the router.'])];
    if(!s.radios.length)return [...controls,E('p',{},['No wireless radios are available yet.'])];
    if(s.radios.length>1)controls.push(this.toggle('One Name for Both Bands',s.shared,on=>{s.shared=on;this.show();}));
    for(const w of s.shared?[s.sharedWifi]:s.radios)controls.push(this.wifiGroup(w,s.shared?'':(w.label||w.name)));
    return controls;
   }
   default:{const rows=[['SIM','SIM '+s.sim+' · Manual'],['APN',s.apn||'Automatic / carrier default'],['2.5Gbps socket',s.wan.mode.toUpperCase()+(s.wan.mode==='wan'?' · '+s.wan.proto.toUpperCase():'')],['TTL/HL',s.ttlOn?s.ttl+' / '+s.hl:'Off'],['Root password',s.password?'New password set':'Keep current password'],['Timezone',s.zone||'Keep current timezone'],['Wi-Fi',s.wifiOn?(s.shared?s.sharedWifi.ssid:s.radios.map(r=>r.ssid).join(' / ')):'Disabled'],...(s.wifiOn?[['Wi-Fi encryption',s.shared?wifiSecurityLabel(s.sharedWifi.encryption):s.radios.map(r=>(r.label||r.name)+': '+wifiSecurityLabel(r.encryption)).join(' / ')]]:[])];return [E('p',{'class':'cw-lead'},['Check your choices. Nothing changes until you apply.']),E('dl',{'class':'cw-review'},rows.map(([k,v])=>E('div',{},[E('dt',{},[k]),E('dd',{},[v])])) )];}
  }
 },
 wifiGroup(w,band){
  if(w.encryption==='open')w.encryption='none';
  const security=this.select(w,'encryption',band?band+' Encryption':'Encryption',WIFI_ENCRYPTIONS);
  security.querySelector('select').addEventListener('change',()=>this.show());
  return E('section',{'class':'cw-wifi-group'},[
   band?E('h3',{},[band]):null,
   this.input(w,'ssid',band?band+' Wi-Fi Name':'Wi-Fi Name'),security,
   openWifi(w.encryption)?E('p',{'class':'cw-hint'},['This Wi-Fi network will be open. Anyone within range can connect without a password.']):this.input(w,'key',band?band+' Wi-Fi Password':'Wi-Fi Password','password','8–63 characters.')
  ].filter(Boolean));
 },
 payload(){const s=this.state;for(let i=0;i<7;i++){const error=validateDraft(s,i);if(error)throw new Error(error);}return {wizard:{skipped_network:!s.wan.exists,skipped_wifi:!s.radios.length,skipped_admin:!s.password},network:{wan_role:s.wan.role,wan_device:s.wan.device,optional_wan_mode:s.wan.mode,proto:s.wan.proto,username:s.wan.username,password:s.wan.password,ipaddr:s.wan.ipaddr,netmask:s.wan.netmask,gateway:s.wan.gateway,dns:s.wan.dns},wifi:{enabled:s.wifiOn,linked_bands:s.shared,radios:s.radios.map(r=>{const w=s.shared?s.sharedWifi:r;return {name:r.name,section:r.section,ssid:w.ssid,encryption:openWifi(w.encryption)?'none':w.encryption,key:openWifi(w.encryption)?'':w.key};})},admin:{skipped:!s.password,password:s.password},chester:{sim_slot:s.sim,apn:s.apn,auth:'none',username:'',password:'',zonename:s.zone,timezone:s.zone?(this.data.chester?.timezones?.[s.zone]||''):'',ttl_enabled:s.ttlOn,ttl:Number(s.ttl),hl:Number(s.hl)}};},
 show(){const s=this.state;dom.content(this.progress,[E('span',{},['Step '+(s.step+1)+' of '+STEPS.length]),E('strong',{},[STEPS[s.step]]),E('div',{'class':'cw-progress-track'},[E('i',{'style':'width:'+((s.step+1)/STEPS.length*100)+'%'})])]);this.error.textContent='';const go=()=>{const error=validateDraft(s,s.step);if(error){this.error.textContent=error;return;}s.step++;this.show();};const form=E('form',{submit:ev=>{ev.preventDefault();if(s.step<7)go();}},[E('h1',{},[STEPS[s.step]]),...this.body(),this.error,E('footer',{'class':'cw-actions'},[s.step?E('button',{type:'button','class':'cw-back',click:()=>{s.step--;this.show();}},['Back']):E('span'),E('button',{type:s.step<7?'submit':'button','class':'cw-next',click:s.step===7?()=>this.finish():null},[s.step===7?'Apply Settings':'Continue'])])]);dom.content(this.panel,[form]);},
 completeSetup(message){
  dom.content(this.panel,[E('h1',{},['You’re Ready']),E('p',{'class':'cw-lead'},[message||'Your settings were saved. The connection may reconnect as they take effect.']),E('a',{'class':'cw-next',href:L.url('admin','dashboard','overview')},['Open Overview'])]);this.state.password='';this.state.confirm='';
 },
 async finish(){
  let payload;try{payload=this.payload();}catch(e){this.error.textContent=e.message;return;}
  const buttons=this.panel.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
  try{
   const result=await apply(JSON.stringify(payload));
   if(result.result===true){this.completeSetup();return;}
   if(result.code===403){const status=await context();if(status.code===403){this.completeSetup('Setup is complete. Open Overview to check your settings.');return;}}
   throw new Error(result.message||'Settings could not be saved.');
  }catch(e){
   // A network reload can interrupt the reply or cause an RPC retry after the
   // backend has completed setup. Confirm the closed first-run state first.
   for(let i=0;i<10;i++){
    try{const status=await context();if(status.code===403){this.completeSetup('Setup is complete. Open Overview to check your settings.');return;}if(status.result===true)break;}catch(ignore){}
    await new Promise(resolve=>window.setTimeout(resolve,1000));
   }
   this.error.textContent=e.message||'The connection changed. Reconnect and check whether setup completed.';buttons.forEach(b=>b.disabled=false);
  }
 },
 handleSave:null,handleSaveApply:null,handleReset:null
});

'use strict';'require baseclass';'require rpc';'require uci';'require dom';'require misectel.clients as clients';'require chester-ui.devices as deviceIcons';'require chester-ui.settings as kit';
const saveProfile=rpc.declare({object:'chester.clients',method:'save',params:['mac','name','icon']}),setDeviceAddress=rpc.declare({object:'chester.clients',method:'address',params:['mac','mode','ip']});
const MAC_RE=/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
function normalizeMac(value){const text=String(value||'').trim().replace(/-/g,':').toUpperCase(),compact=text.replace(/:/g,'');return /^[0-9A-F]{12}$/.test(compact)?compact.match(/../g).join(':'):text;}
function validIPv4(value){const parts=String(value).split('.');return parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255)&&Number(parts[0])>0&&Number(parts[0])!==127&&Number(parts[0])<224;}
function validateReservedIPv4(value,lanAddress,netmask){
 if(!validIPv4(value))throw new Error('Enter a valid IPv4 address.');
 const raw=Array.isArray(lanAddress)?lanAddress[0]:lanAddress,parts=String(raw||'').split('/'),router=parts[0];if(!validIPv4(router))throw new Error('Could not read the LAN subnet. Reload this page before reserving an address.');
 const numeric=ip=>ip.split('.').reduce((n,p)=>(n*256+Number(p))>>>0,0),bits=parts[1]!=null?Number(parts[1]):null,mask=bits!=null&&bits>=0&&bits<=32?(bits===0?0:(0xffffffff<<(32-bits))>>>0):String(netmask||'').split('.').length===4&&String(netmask).split('.').every(v=>/^\d{1,3}$/.test(v)&&Number(v)<=255)?numeric(netmask):0xffffff00;
 const address=numeric(value),host=numeric(router),network=(host&mask)>>>0,broadcast=(network|(~mask))>>>0;
 if((address&mask)!==(host&mask))throw new Error('Choose an address inside this device’s LAN subnet.');
 if(address===host||address===network||address===broadcast)throw new Error('That address belongs to the router, network or broadcast. Choose another address.');
}
function deviceName(device){return device.displayName||(device.hostname&&device.hostname!=='--'?device.hostname:'Unnamed Device');}

const methods={
 buildStaticLeaseMap(){return clients.buildStaticLeaseMap();},
 async saveStaticLease(name,mac,ipaddr){
  mac=normalizeMac(mac);if(!MAC_RE.test(mac))throw new Error('Enter a valid MAC address.');validateReservedIPv4(ipaddr,uci.get('network','lan','ipaddr'),uci.get('network','lan','netmask'));
  const duplicates=this.buildStaticLeaseMap();if(Object.keys(duplicates).some(key=>key!==mac&&duplicates[key].ip===ipaddr))throw new Error('That IP address is already reserved for another device.');
  if((this.devices||[]).some(d=>normalizeMac(d.mac)!==mac&&d.ipaddr===ipaddr&&d.tone==='online'))throw new Error('Another connected device is already using that address.');
  const result=await setDeviceAddress(mac,'static',ipaddr);if(!result.success)throw new Error(result.error||'Could not save the IP reservation.');uci.unload('dhcp');await uci.load('dhcp');
 },
 closeEditor(){dom.content(this.editorNode,[]);this.editorNode.classList.remove('is-customizing');},
 openProfile(device){
  this.closeEditor();this.editorNode.classList.add('is-customizing');const profile=this.profiles[device.mac.toUpperCase()]||{},name=E('input',{type:'text',value:profile.name||'',maxlength:64,placeholder:device.hostname==='--'?'Device name':device.hostname,autocomplete:'off'});
  let selected=profile.icon||'auto',category=Object.keys(deviceIcons.categories).find(k=>deviceIcons.categories[k].includes(selected))||'General';
  const grid=E('div',{'class':'cd-icon-grid',role:'group','aria-label':'Device Icon'}),error=E('p',{'class':'cd-inline-error',role:'alert',hidden:true}),categorySelect=E('select',{'aria-label':'Icon Category'},Object.keys(deviceIcons.categories).map(key=>E('option',{value:key,selected:key===category?'selected':null},[key]))),heading=E('div',{'class':'cd-icon-heading'}),preview=E('div',{'class':'cd-profile-preview'}),previewName=E('strong',{'class':'cd-preview-name'},[profile.name||deviceName(device)]),previewIcon=E('div',{'class':'cd-preview-icon'});
  dom.content(preview,[previewIcon,E('div',{'class':'cd-preview-identity'},[previewName,E('span',{'class':'cd-preview-mac'},[device.mac])])]);name.addEventListener('input',()=>{previewName.textContent=name.value.trim()||device.hostname||'Unnamed Device';});
  const search=E('input',{type:'search',placeholder:'Search all device icons','aria-label':'Find a Device Icon'});
  const draw=()=>{const query=search.value.trim().toLowerCase(),ids=query?Object.keys(deviceIcons.catalog).filter(id=>deviceIcons.catalog[id][0].toLowerCase().includes(query)):deviceIcons.categories[category];
   heading.textContent=query?ids.length+' Matching Icons':category;dom.content(previewIcon,[deviceIcons.icon(selected,device.connection)]);dom.content(grid,ids.length?ids.map(id=>E('button',{type:'button','class':'cd-icon-choice','aria-pressed':id===selected?'true':'false',click:()=>{selected=id;draw();}},[deviceIcons.icon(id,device.connection),E('span',{'class':'cd-icon-label'},[deviceIcons.catalog[id][0]]),id===selected?E('span',{'class':'cd-icon-check','aria-hidden':'true'},['\u2713']):''])):[E('p',{'class':'st-muted'},['No icons found. Try another search.'])]);
   categorySelect.value=category;
  };search.addEventListener('input',draw);categorySelect.addEventListener('change',()=>{category=categorySelect.value;search.value='';draw();});draw();
  const assignment=E('select',{'aria-label':'IP Assignment'},[E('option',{value:'auto',selected:device.staticLease?null:'selected'},['Automatic (DHCP)']),E('option',{value:'static',selected:device.staticLease?'selected':null},['Static IP (Reservation)'])]),address=E('input',{type:'text',value:device.staticLease?.ip||(validIPv4(device.ipaddr)?device.ipaddr:''),placeholder:'192.168.100.50',inputmode:'decimal','aria-label':'Device IPv4 Address',spellcheck:'false'});
  const addressHelp=E('p',{'class':'cd-address-help st-muted'}),setAddressMode=()=>{address.disabled=assignment.value==='auto';addressHelp.textContent=assignment.value==='static'?'The router reserves this IP for the device. Reconnect it after saving to renew its address.':'The router assigns an address automatically. Devices with a manually configured IP must be changed on the device.';};assignment.addEventListener('change',setAddressMode);setAddressMode();
  const save=kit.button('Save Device',async()=>{save.disabled=true;error.hidden=true;try{if(assignment.value==='static'){validateReservedIPv4(address.value.trim(),uci.get('network','lan','ipaddr'),uci.get('network','lan','netmask'));const occupied=this.buildStaticLeaseMap();if(Object.keys(occupied).some(mac=>mac!==device.mac&&occupied[mac].ip===address.value.trim()))throw new Error('That IP address is already reserved for another device.');}const result=await saveProfile(device.mac,name.value.trim(),selected);if(!result.success)throw new Error(result.error||'Could not save device.');this.profiles=result.devices||{};
   if(assignment.value==='static'&&address.value.trim()!==device.staticLease?.ip){try{await this.saveStaticLease(device.staticLease?.name||'',device.mac,address.value.trim());}catch(e){throw new Error('Name and icon saved. IP reservation: '+(e.message||String(e)));}}
   else if(assignment.value==='auto'&&device.staticLease?.section){try{const result=await setDeviceAddress(device.mac,'auto','');if(!result.success)throw new Error(result.error||'Could not remove the reservation.');uci.unload('dhcp');await uci.load('dhcp');}catch(e){throw new Error('Name and icon saved. Automatic address: '+(e.message||String(e)));}}
   this.applyProfiles();this.closeEditor();this.notify('Device settings saved.');await this.refresh(true);}catch(e){error.textContent=e.message||String(e);error.hidden=false;}finally{save.disabled=false;}});
  const card=E('section',{'class':'st-card cd-profile-card'},[E('div',{'class':'cd-profile-title'},[E('h3',{},['Customize Device']),E('p',{},['Make this device easy to recognize.'])]),preview,kit.field('Device Name',name,'Leave blank to use the reported hostname.'),E('div',{'class':'cd-profile-controls cd-address-settings'},[kit.field('IP Assignment',assignment),kit.field('IPv4 Address',address)]),addressHelp,E('div',{'class':'cd-profile-divider'}),E('div',{'class':'cd-profile-controls'},[kit.field('Category',categorySelect),kit.field('Find an Icon',search)]),heading,grid,error,E('div',{'class':'cd-editor-actions cd-profile-footer'},[kit.button('Cancel',()=>this.closeEditor(),{'class':'st-button secondary'}),save])]);dom.content(this.editorNode,[card]);card.scrollIntoView({behavior:'smooth',block:'start'});name.focus({preventScroll:true});
 },

 applyProfiles(){for(const d of this.devices){const p=this.profiles[d.mac.toUpperCase()]||{};d.displayName=p.name||'';d.deviceIcon=p.icon||'auto';}},
 notify(text,error){this.context.notify(text,error);},
 async refresh(){await this.context.onSaved(this.profiles);}
};
return baseclass.extend({create(context){return Object.assign(Object.create(methods),{context,profiles:context.profiles||{},devices:context.devices||[],editorNode:context.editorNode});}});

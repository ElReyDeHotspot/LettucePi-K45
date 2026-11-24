'use strict';
'require view';
'require poll';
'require rpc';
'require chester-ui.devices as deviceIcons';
'require uci';
'require dom';
'require misectel.ui as misectel';
'require misectel.clients as clients';
'require chester-ui.settings as kit';
const getProfiles=rpc.declare({object:'chester.clients',method:'list'});
const saveProfile=rpc.declare({object:'chester.clients',method:'save',params:['mac','name','icon']});
const setDeviceAddress=rpc.declare({object:'chester.clients',method:'address',params:['mac','mode','ip']});
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
function present(value){return value!=null&&value!==''&&value!=='--'?String(value):'Not available';}
function matchesDevice(device,filter,query){
 if(filter==='wifi'&&device.connection!=='wireless')return false;
 if(filter==='ethernet'&&device.connection!=='wired')return false;
 if(filter==='reserved'&&!device.staticLease)return false;
 const text=[device.displayName,device.hostname,device.mac,device.ipaddr,device.ssid,device.band,device.interface,device.staticLease?.ip].join(' ').toLowerCase();return !query||text.includes(query.toLowerCase().trim());
}
return view.extend({
 async load(){misectel.ensureBaseStyle();await uci.load(['dhcp','misectel','network']);this.profiles=(await getProfiles()).devices||{};},
 buildStaticLeaseMap(){return clients.buildStaticLeaseMap();},
 async saveStaticLease(name,mac,ipaddr){
  mac=normalizeMac(mac);if(!MAC_RE.test(mac))throw new Error('Enter a valid MAC address.');validateReservedIPv4(ipaddr,uci.get('network','lan','ipaddr'),uci.get('network','lan','netmask'));
  const duplicates=this.buildStaticLeaseMap();if(Object.keys(duplicates).some(key=>key!==mac&&duplicates[key].ip===ipaddr))throw new Error('That IP address is already reserved for another device.');
  if((this.devices||[]).some(d=>normalizeMac(d.mac)!==mac&&d.ipaddr===ipaddr&&d.tone==='online'))throw new Error('Another connected device is already using that address.');
  const result=await setDeviceAddress(mac,'static',ipaddr);if(!result.success)throw new Error(result.error||'Could not save the IP reservation.');uci.unload('dhcp');await uci.load('dhcp');
 },
 notify(text,error){this.feedback.textContent=text;this.feedback.className='cd-feedback'+(error?' is-error':'');this.feedback.hidden=false;},
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
  const assignment=E('select',{'aria-label':'IP Assignment'},[E('option',{value:'auto',selected:device.staticLease?null:'selected'},['Automatic (DHCP)']),E('option',{value:'static',selected:device.staticLease?'selected':null},['Static IP (reservation)'])]),address=E('input',{type:'text',value:device.staticLease?.ip||(validIPv4(device.ipaddr)?device.ipaddr:''),placeholder:'192.168.100.50',inputmode:'decimal','aria-label':'Device IPv4 Address',spellcheck:'false'});
  const addressHelp=E('p',{'class':'cd-address-help st-muted'}),setAddressMode=()=>{address.disabled=assignment.value==='auto';addressHelp.textContent=assignment.value==='static'?'The router reserves this IP for the device. Reconnect it after saving to renew its address.':'The router assigns an address automatically. Devices with a manually configured IP must be changed on the device.';};assignment.addEventListener('change',setAddressMode);setAddressMode();
  const save=kit.button('Save Device',async()=>{save.disabled=true;error.hidden=true;try{if(assignment.value==='static'){validateReservedIPv4(address.value.trim(),uci.get('network','lan','ipaddr'),uci.get('network','lan','netmask'));const occupied=this.buildStaticLeaseMap();if(Object.keys(occupied).some(mac=>mac!==device.mac&&occupied[mac].ip===address.value.trim()))throw new Error('That IP address is already reserved for another device.');}const result=await saveProfile(device.mac,name.value.trim(),selected);if(!result.success)throw new Error(result.error||'Could not save device.');this.profiles=result.devices||{};
   if(assignment.value==='static'&&address.value.trim()!==device.staticLease?.ip){try{await this.saveStaticLease(device.staticLease?.name||'',device.mac,address.value.trim());}catch(e){throw new Error('Name and icon saved. IP reservation: '+(e.message||String(e)));}}
   else if(assignment.value==='auto'&&device.staticLease?.section){try{const result=await setDeviceAddress(device.mac,'auto','');if(!result.success)throw new Error(result.error||'Could not remove the reservation.');uci.unload('dhcp');await uci.load('dhcp');}catch(e){throw new Error('Name and icon saved. Automatic address: '+(e.message||String(e)));}}
   this.applyProfiles();this.closeEditor();this.notify('Device settings saved.');await this.refresh(true);}catch(e){error.textContent=e.message||String(e);error.hidden=false;}finally{save.disabled=false;}});
  const card=E('section',{'class':'st-card cd-profile-card'},[E('div',{'class':'cd-profile-title'},[E('h3',{},['Customize Device']),E('p',{},['Make this device easy to recognize.'])]),preview,kit.field('Device Name',name,'Leave blank to use the reported hostname.'),E('div',{'class':'cd-profile-controls cd-address-settings'},[kit.field('IP Assignment',assignment),kit.field('IPv4 Address',address)]),addressHelp,E('div',{'class':'cd-profile-divider'}),E('div',{'class':'cd-profile-controls'},[kit.field('Category',categorySelect),kit.field('Find an Icon',search)]),heading,grid,error,E('div',{'class':'cd-editor-actions cd-profile-footer'},[kit.button('Cancel',()=>this.closeEditor(),{'class':'st-button secondary'}),save])]);dom.content(this.editorNode,[card]);card.scrollIntoView({behavior:'smooth',block:'start'});name.focus({preventScroll:true});
 },
 applyProfiles(){for(const d of this.devices){const p=this.profiles[d.mac.toUpperCase()]||{};d.displayName=p.name||'';d.deviceIcon=p.icon||'auto';}},
 openEditor(device){
  this.closeEditor();const name=E('input',{type:'text',value:device&&device.hostname!=='--'?device.hostname||'':'',autocomplete:'off'}),mac=E('input',{type:'text',value:device?.mac||'',readonly:device?'readonly':null,placeholder:'AA:BB:CC:DD:EE:FF',spellcheck:'false'}),ip=E('input',{type:'text',value:device?.staticLease?.ip||device?.ipaddr&&device.ipaddr!=='--'&&device.ipaddr||'',placeholder:'192.168.100.50',inputmode:'decimal',spellcheck:'false'});
  const error=E('p',{'class':'cd-inline-error',role:'alert',hidden:true});
  const save=kit.button('Save Reservation',async()=>{save.disabled=true;error.hidden=true;try{await this.saveStaticLease(name.value.trim(),mac.value,ip.value.trim());if(name.value.trim()){const result=await saveProfile(normalizeMac(mac.value),name.value.trim(),this.profiles[normalizeMac(mac.value)]?.icon||'auto');if(!result.success)throw new Error(result.error);this.profiles=result.devices||{};}this.notify('IP reservation saved. The device may need to reconnect to use its reserved address.');this.closeEditor();window.setTimeout(()=>window.location.reload(),300);}catch(e){error.textContent=e.message||String(e);error.hidden=false;}finally{save.disabled=false;}});
  const card=kit.card(device?.staticLease?'Edit IP Reservation':'Reserve an IP Address','Give a device the same LAN address each time it connects.',[
   E('div',{'class':'st-fields'},[kit.field('Device Name',name,'Optional. Use a name you recognize.'),kit.field('MAC Address',mac)]),kit.field('Reserved IPv4 Address',ip,'This reservation applies to your LAN.'),error,E('div',{'class':'cd-editor-actions'},[kit.button('Cancel',()=>this.closeEditor(),{'class':'st-button secondary'}),save])
  ],'lock');dom.content(this.editorNode,[card]);card.scrollIntoView({behavior:'smooth',block:'start'});name.focus({preventScroll:true});
 },
 removeReservation(device){
  if(!device.staticLease?.section)return;this.closeEditor();
  const error=E('p',{'class':'cd-inline-error',role:'alert',hidden:true});
  const remove=kit.button('Remove Reservation',async()=>{remove.disabled=true;try{const result=await setDeviceAddress(device.mac,'auto','');if(!result.success)throw new Error(result.error||'Could not remove the reservation.');uci.unload('dhcp');await uci.load('dhcp');this.notify('IP reservation removed.');this.closeEditor();window.setTimeout(()=>window.location.reload(),300);}catch(e){error.textContent=e.message||String(e);error.hidden=false;}finally{remove.disabled=false;}},{'class':'st-button danger'});
  const card=kit.card('Remove IP Reservation?','The device can still connect and receive an automatic address.',[E('p',{'class':'cd-reservation-name'},[deviceName(device)+' · '+(device.staticLease.ip||device.ipaddr)]),error,E('div',{'class':'cd-editor-actions'},[kit.button('Keep Reservation',()=>this.closeEditor(),{'class':'st-button secondary'}),remove])],'lock');dom.content(this.editorNode,[card]);card.scrollIntoView({behavior:'smooth',block:'start'});
 },
 detail(label,value){return E('div',{'class':'cd-detail'},[E('span',{},[label]),E('strong',{},[present(value)])]);},
 row(device){
  const online=device.tone==='online',wifi=device.connection==='wireless',wired=device.connection==='wired',connection=wifi?present(device.band):wired?'Ethernet':'Saved device',sub=wifi?present(device.ssid):present(device.interface);
  const reserve=kit.button(device.staticLease?'Edit Reservation':'Reserve IP',()=>this.openEditor(device),{'class':'st-button secondary','aria-label':(device.staticLease?'Edit Reservation for ':'Reserve IP for ')+deviceName(device)});
  const details=E('details',{'class':'cd-device-details','data-mac':device.mac,open:this.expanded[device.mac]?'open':null},[
   E('summary',{},['Device Details']),E('div',{'class':'cd-detail-grid'},[
    this.detail('Reported Hostname',device.hostname),this.detail('MAC Address',device.mac),this.detail('Interface',device.interface),this.detail('Lease Remaining',device.dhcpLease?.time),this.detail('Network State',device.state),
    ...(wifi?[this.detail('Wi-Fi Network',device.ssid),this.detail('Signal',device.signal),this.detail('Receive Link Rate',device.rxRate),this.detail('Transmit Link Rate',device.txRate)]:[]),
    this.detail('IP Reservation',device.staticLease?.ip||'Automatic (DHCP)')
   ]),device.staticLease?kit.button('Remove Reservation',()=>this.removeReservation(device),{'class':'cd-remove','aria-label':'Remove Reservation for '+deviceName(device)}):''
  ]);
  details.addEventListener('toggle',()=>{if(details.isConnected)this.expanded[device.mac]=details.open;});
  return E('article',{'class':'cd-device'+(!online?' is-offline':'')},[
   E('div',{'class':'cd-device-top'},[
    E('div',{'class':'cd-identity'},[E('span',{'class':'cd-avatar'},[deviceIcons.icon(device.deviceIcon,device.connection)]),E('div',{},[E('strong',{'class':'cd-device-name'},[deviceName(device)]),E('span',{'class':'cd-mac'},[device.mac])])]),
    E('div',{'class':'cd-address'},[E('span',{},['IPv4 address']),E('strong',{},[present(device.ipaddr)]),device.staticLease?E('small',{'class':'cd-reserved'},['Reserved · '+(device.staticLease.ip||'LAN')]):E('small',{},['Automatic address'])]),
    E('div',{'class':'cd-connection'},[E('strong',{},[connection]),E('span',{},[sub]),wifi?E('small',{},[present(device.signal)]):'']),
    E('span',{'class':'cd-status'+(online?' is-online':'')},[E('i',{'aria-hidden':'true'}),online?'Online':'Offline']),
    E('div',{'class':'cd-row-actions'},[kit.button('Edit Device',()=>this.openProfile(device),{'class':'st-button secondary','aria-label':'Edit '+deviceName(device)}),reserve])
   ]),details
  ]);
 },
 renderList(force){
  if(!force&&this.listNode.contains(document.activeElement))return;
  const shown=this.devices.filter(d=>matchesDevice(d,this.filter,this.query)),reserved=this.devices.filter(d=>d.staticLease).length;
  this.countNode.textContent=shown.length+' '+(shown.length===1?'Device':'Devices')+' · '+reserved+' '+(reserved===1?'IP reservation':'IP reservations');
  dom.content(this.listNode,shown.length?shown.map(d=>this.row(d)):[E('div',{'class':'cd-empty'},[kit.icon('network'),E('strong',{},[this.devices.length?'No Matching Devices':'No Devices Found']),E('span',{},[this.devices.length?'Try another search or connection filter.':'Connected devices and saved IP reservations will appear here.'])])]);
  for(const button of this.filterButtons){const active=button.getAttribute('data-filter')===this.filter;button.setAttribute('aria-pressed',active?'true':'false');button.classList.toggle('is-active',active);}
 },
 async refresh(manual){
  if(this.refreshing)return;this.refreshing=true;this.refreshButton.disabled=true;
  try{const data=await clients.fetchRuntimeData();this.devices=clients.buildDevices(data,{staticLeases:this.buildStaticLeaseMap()});this.applyProfiles();
   dom.content(this.metrics,[kit.stat('Online Devices',String(this.devices.filter(d=>d.tone==='online').length),'network'),kit.stat('Wi-Fi',String(this.devices.filter(d=>d.connection==='wireless'&&d.tone==='online').length),'router'),kit.stat('Ethernet',String(this.devices.filter(d=>d.connection==='wired'&&d.tone==='online').length),'port')]);
   this.wiredScope.textContent='Wired interfaces: '+(data.wiredInterfaces||[]).join(', ');this.updated.textContent='Updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});this.renderList(!!manual);
  }catch(e){this.notify(this.devices.length?'Could not refresh Devices. The last available information is shown.':'Could not load Devices. Try Refresh.',true);}finally{this.refreshing=false;this.refreshButton.disabled=false;}
 },
 render(){
  this.devices=[];this.expanded={};this.query='';this.filter='all';this.metrics=E('div',{'class':'st-summary'},[kit.stat('Online Devices','—','network'),kit.stat('Wi-Fi','—','router'),kit.stat('Ethernet','—','port')]);this.editorNode=E('div',{'class':'cd-editor'});this.listNode=E('div',{'class':'cd-list'},[E('p',{'class':'st-muted'},['Loading Devices…'])]);this.feedback=E('div',{'class':'cd-feedback',role:'status','aria-live':'polite',hidden:true});this.updated=E('span',{},['Refreshes every 5 seconds']);this.wiredScope=E('span');this.countNode=E('span',{'class':'cd-count'});
  const search=E('input',{type:'search',placeholder:'Search name, IP or MAC address','aria-label':'Search Devices',autocomplete:'off'});search.addEventListener('input',()=>{this.query=search.value;this.renderList(true);});
  this.filterButtons=[['all','All Devices'],['wifi','Wi-Fi'],['ethernet','Ethernet'],['reserved','Reserved IPs']].map(([value,label])=>E('button',{type:'button','class':'cd-filter'+(value==='all'?' is-active':''),'data-filter':value,'aria-pressed':value==='all'?'true':'false',click:()=>{this.filter=value;this.renderList(true);}},[label]));
  this.refreshButton=kit.button('Refresh',()=>this.refresh(true),{'class':'st-button secondary'});
  const page=kit.sheet([
   E('link',{rel:'stylesheet',href:L.resource('chester-ui/clients.css')+'?v=6'}),kit.head('Connected Devices','A clear view of everything on your network.','network'),this.metrics,this.feedback,
   E('div',{'class':'cd-toolbar'},[search,E('div',{'class':'cd-toolbar-actions'},[this.refreshButton,kit.button('Add IP Reservation',()=>this.openEditor())])]),this.editorNode,
   kit.card('Your Devices','Online clients and saved IP reservations, together.',[E('div',{'class':'cd-list-toolbar'},[E('div',{'class':'cd-filters','aria-label':'Device Filters'},this.filterButtons),this.countNode]),this.listNode,E('div',{'class':'cd-list-footer'},[this.updated,this.wiredScope])],'network')
  ],'st-clients');this.refresh();poll.add(()=>this.refresh(false),5);return page;
 },handleSave:null,handleSaveApply:null,handleReset:null
});

'use strict';'require view';'require rpc';'require ui';'require uci';'require dom';'require poll';'require chester-ui.settings as settings';'require misectel.ui as misectel';'require misectel.modem as modemHelper';const callMigrateQmodem=rpc.declare({object:'misectel.interface',method:'migrate_qmodem',expect:{}});const callInterfaceConfig=rpc.declare({object:'misectel.interface',method:'get_config',expect:{}});const callInterfaceStatus=rpc.declare({object:'misectel.interface',method:'get_status',expect:{}});const callInterfaceCapabilities=rpc.declare({object:'misectel.interface',method:'capabilities',expect:{}});const callSetQmodem=rpc.declare({object:'misectel.interface',method:'set_qmodem',params:['instance','config','revision','force'],expect:{}});const callConfirm=rpc.declare({object:'misectel.interface',method:'confirm_config',params:['token'],expect:{}});const callActivate=rpc.declare({object:'misectel.interface',method:'activate_qmodem',params:['token'],expect:{}});const callRollback=rpc.declare({object:'misectel.interface',method:'rollback_config',params:['token'],expect:{}});function buildSelect(current,modems){return E('select',{'class':'misectel-select'},(modems||[]).map((modem)=>E('option',{'value':modem.id,'selected':modem.id===current?'selected':null},[modemHelper.modemLabel(modem)])));}
function normalizeList(value){if(Array.isArray(value))
return value.filter(Boolean);return value?[value]:[];}
function delay(ms){return new Promise((resolve)=>window.setTimeout(resolve,ms));}
async function recoverPendingSave(instance,enabled,ports,wifiSection,managementCidr,revision,timeout){const deadline=Date.now()+Math.max(5,timeout||90)*1000;const requestedPorts=[...ports].sort().join('\n');while(Date.now()<deadline){try{const response=await callInterfaceConfig();const config=response?.config||{};const assignment=(config.assignments||[]).find((item)=>item.provider==='qmodem_passthrough'&&item.instance===instance);if(response?.pending_token&&Number(config.global?.revision)===revision+1&&assignment&&modemHelper.boolValue(assignment.enabled,false)===enabled&&normalizeList(assignment.desired_port).sort().join('\n')===requestedPorts&&normalizeList(assignment.desired_wifi).join('\n')===(wifiSection||'')&&String(assignment.management_cidr||'')===managementCidr){return{result:true,pending_token:response.pending_token,confirm_timeout:timeout||90,service_restart_queued:true};}
if(!response?.pending_token)
return null;}
catch(err){}
await delay(1000);}
return null;}
function portLabel(device){return /^lan[123]$/.test(device)?'LAN '+device.slice(3):device==='wan'?'WAN':device;}
function buildBridgePortChecks(current,devices,ownership,ownerId){
 const selected=normalizeList(current),choices=[],metadata={};
 for(const item of devices||[]){if(item?.type&&item.type!=='port')continue;const device=typeof item==='string'?item:item.device;if(device&&!choices.includes(device)){choices.push(device);metadata[device]=typeof item==='string'?{}:item;}}
 for(const device of selected)if(!choices.includes(device))choices.push(device);choices.sort((a,b)=>(/^lan[123]$/.test(a)?-Number(a.slice(3)):a==='wan'?99:100)-(/^lan[123]$/.test(b)?-Number(b.slice(3)):b==='wan'?99:100));
 const inputs=choices.map(device=>{const owner=ownership?.[device],uplink=metadata[device]?.role==='wan'||metadata[device]?.assignable===false,blocked=uplink||(owner&&`${owner.provider}:${owner.instance}`!==ownerId);return E('input',{type:'radio',name:'pt-port-'+ownerId,value:device,disabled:blocked?'disabled':null,checked:selected[0]===device?'checked':null,'aria-label':portLabel(device),'data-owner':uplink?'uplink':blocked?'assigned':''});});
 return {inputs,node:E('div',{'class':'pt-ports'},inputs.map((input,i)=>E('label',{'class':'pt-port'+(input.disabled?' is-unavailable':'')},[input,settings.icon('port'),E('strong',{},[portLabel(choices[i])]),E('span',{},[input.getAttribute('data-owner')==='uplink'?'Internet uplink':input.disabled?'Used by another network':choices[i]==='wan'?'2.5 Gbps':'1 Gbps']),E('i',{'class':'pt-check','aria-hidden':'true'},['✓'])])))};
}
function buildWifiSelect(current,devices,ownership,ownerId){const choices=(devices||[]).filter((item)=>item.type==='wifi');if(current&&!choices.some((item)=>item.section===current))
choices.push({id:`wifi:${current}`,section:current,missing:true});return E('select',{'class':'misectel-select'},[E('option',{value:'',selected:!current?'selected':null},[_('No Wi-Fi AP')]),...choices.map((item)=>{const owner=ownership?.[item.id];const blocked=owner&&`${owner.provider}:${owner.instance}`!==ownerId;let label=item.missing?_('%s (unavailable AP)').format(item.section):'%s (%s)'.format(item.ssid||'Wi-Fi',item.radio);if(!item.missing&&!item.enabled)label+=' - '+_('Wi-Fi disabled');if(blocked)label+=' - '+_('Used by %s').format(`${owner.provider}:${owner.instance}`);return E('option',{value:item.section,selected:item.section===current?'selected':null,disabled:blocked&&item.section!==current?'disabled':null},[label]);})]);}
function ipv4ToInt(address){const octets=String(address||'').split('.');if(octets.length!==4||octets.some((octet)=>!/^\d+$/.test(octet)||Number(octet)>255))
return null;return octets.reduce((value,octet)=>value*256+Number(octet),0);}
function intToIpv4(value){if(!Number.isInteger(value)||value<0||value>0xffffffff)
return null;return[24,16,8,0].map((shift)=>Math.floor(value/(2**shift))%256).join('.');}
function netmaskToPrefix(netmask){const value=ipv4ToInt(netmask);if(value==null)
return null;const bits=value.toString(2).padStart(32,'0');return/^1*0*$/.test(bits)?bits.indexOf('0')<0?32:bits.indexOf('0'):null;}
function parseCidr(value){const match=String(value||'').trim().match(/^([^/]+)\/(\d{1,2})$/);if(!match)
return null;const address=ipv4ToInt(match[1]);const prefix=Number(match[2]);if(address==null||prefix<1||prefix>31)
return null;const blockSize=2**(32-prefix);const network=Math.floor(address/blockSize)*blockSize;if(prefix<=30&&(address===network||address===network+blockSize-1))
return null;return{address:match[1],prefix};}
function defaultManagementCidr(){const configured=String(uci.get('network','lan','ipaddr')||'');const parts=configured.split('/');const lanAddress=ipv4ToInt(parts[0]);let prefix=parts.length>1?Number(parts[1]):netmaskToPrefix(uci.get('network','lan','netmask'));if(lanAddress!=null){prefix=Number.isInteger(prefix)&&prefix>=1?Math.min(prefix,31):24;const blockSize=2**(32-prefix);const network=Math.floor(lanAddress/blockSize)*blockSize;const candidates=[lanAddress,lanAddress+1,lanAddress-1];const nextNetwork=network+blockSize;const targetNetwork=nextNetwork<=0xffffffff?nextNetwork:network-blockSize;for(const candidate of candidates){const address=intToIpv4(targetNetwork+candidate-network);if(candidate>=network&&candidate<network+blockSize&&address&&parseCidr(`${address}/${prefix}`))
return`${address}/${prefix}`;}}
return'192.168.100.1/31';}
return view.extend({async load(){misectel.ensureBaseStyle();await Promise.all([uci.load('qmodem'),uci.load('network')]);await L.resolveDefault(callMigrateQmodem(),null);const[managerConfig,managerStatus,capabilities]=await Promise.all([callInterfaceConfig(),callInterfaceStatus(),callInterfaceCapabilities()]);return{modems:modemHelper.getModemSections(),lanDevices:(capabilities?.interfaces||capabilities?.ports||[]).filter((item)=>!item.type||item.type==='port'),wifiDevices:(capabilities?.interfaces||[]).filter((item)=>item.type==='wifi'),managerConfig,managerStatus,capabilities};},notify(message,tone){if(!this.feedbackNode)return;this.feedbackNode.textContent=message;this.feedbackNode.className='pt-feedback'+(tone==='error'?' is-error':tone==='warning'?' is-warning':'');this.feedbackNode.hidden=false;this.feedbackNode.scrollIntoView({behavior:'smooth',block:'nearest'});},syncControls(){const pending=!!this.managerConfig?.pending_token;if(this.applyButton)this.applyButton.disabled=pending;if(this.forceButton)this.forceButton.disabled=pending;if(this.modemSelector)this.modemSelector.disabled=pending;if(!this.form)return;for(const control of [this.form.bridgeMode,this.form.bridgeWifi,this.form.managementIp])control.disabled=pending;for(const input of this.form.bridgePorts.inputs)input.disabled=pending||!!input.getAttribute('data-owner');},assignment(modemId){return(this.managerConfig?.config?.assignments||[]).find((item)=>item.provider==='qmodem_passthrough'&&item.instance===modemId)||null;},renderConnectionState(){
 const assignment=this.assignment(this.selectedModemId),enabled=modemHelper.boolValue(assignment?.enabled,false),pending=!!this.managerConfig?.pending_token;
 const status=(this.managerStatus?.qmodem||[]).find(item=>item.instance===this.selectedModemId);
 return E('div',{'class':'st-summary pt-summary'},[
  settings.stat('Current Mode',pending?'Pending change':enabled?'IP Passthrough':'Router mode','router'),
  settings.stat('Cellular Handoff',pending?'Awaiting confirmation':enabled?(status?.endpoint_attached?'Modem attached':'Waiting for modem'):'Normal routing','network'),
  settings.stat('Cellular IPv4',status?.cellular_ipv4||'Waiting for address','network')
 ]);
},renderCard(modem){
 const assignment=this.assignment(modem.id),bridgeMode=E('input',{type:'checkbox',checked:modemHelper.boolValue(assignment?.enabled??uci.get('qmodem',modem.id,'en_bridge'),false)?'checked':null});
 const bridgePorts=buildBridgePortChecks(assignment?.desired_port??uci.get('qmodem',modem.id,'bridge_port'),this.lanDevices,this.managerStatus?.ownership,`qmodem_passthrough:${modem.id}`);
 const bridgeWifi=buildWifiSelect(normalizeList(assignment?.desired_wifi)[0]||'',this.wifiDevices,this.managerStatus?.ownership,`qmodem_passthrough:${modem.id}`);
 const managementIp=E('input',{type:'text',value:assignment?.management_cidr||uci.get('qmodem',modem.id,'bridge_management_ip')||defaultManagementCidr(),placeholder:'192.168.101.1/24',inputmode:'text',autocomplete:'off'});
 this.form={modemId:modem.id,bridgeMode,bridgePorts,bridgeWifi,managementIp};
 const selected=E('strong',{},['Choose a Port']);
 this.mapAddress=E('span');this.mapHandoff=E('p',{'class':'pt-address-note',role:'status'});
 const sync=()=>{const ports=bridgePorts.inputs.filter(i=>i.checked).map(i=>portLabel(i.value));selected.textContent=ports.join(', ')||(bridgeWifi.value?'Wi-Fi AP':'Choose a port');};
 bridgePorts.inputs.forEach(input=>input.addEventListener('change',()=>{if(input.checked){bridgePorts.inputs.forEach(other=>{if(other!==input)other.checked=false;});bridgeWifi.value='';}sync();}));bridgeWifi.addEventListener('change',()=>{if(bridgeWifi.value)bridgePorts.inputs.forEach(input=>{input.checked=false;});sync();});sync();this.refreshMap();
 const path=E('div',{'class':'pt-path'},[
  E('div',{},[settings.icon('network'),E('strong',{},['Cellular']),this.mapAddress]),E('i',{'class':'pt-arrow','aria-hidden':'true'},['→']),
  E('div',{},[settings.icon('port'),selected,E('span',{},['Dedicated handoff'])]),E('i',{'class':'pt-arrow','aria-hidden':'true'},['→']),
  E('div',{},[settings.icon('router'),E('strong',{},['Your Router']),E('span',{},['One downstream client'])])
 ]);
 return E('div',{},[
  settings.card('Your router. Your connection.','Pass the cellular address to a router or firewall connected behind your Chester.',[path,this.mapHandoff,settings.toggle('Enable IP Passthrough',bridgeMode,'Changes take effect after Apply safely and confirmation.')],'network'),
  settings.card('Choose the Handoff Port','Select a dedicated Ethernet port. It will leave the normal LAN while passthrough is on.',[bridgePorts.node,this.lanDevices.some(p=>p.device==='wan'&&(p.role==='wan'||p.assignable===false))?E('p',{'class':'pt-wan-note'},['WAN is currently your Ethernet internet uplink. ',E('a',{href:L.url('admin','network','failover'),target:'_blank',rel:'noopener'},['Switch it to LAN mode in Failover']),', then refresh this page to use it for passthrough.']):'',E('p',{'class':'st-muted pt-note'},['Connect one downstream router and set its internet / WAN connection to Automatic (DHCP). Other LAN ports stay available for normal management.'])],'port'),
  settings.card('Keep Management Within Reach','Use an unselected LAN port or your normal Wi-Fi to manage Chester.',[
   settings.field('Passthrough Management Address',managementIp,'On a passthrough port, this address requires a static client address in the same subnet. It is separate from the address your carrier assigns.'),
   E('details',{'class':'st-advanced pt-wifi'},[E('summary',{},['Optional Wi-Fi Handoff']),settings.field('Wi-Fi Access Point',bridgeWifi,'Use one access point instead of an Ethernet port. Keep another management connection available. A disabled access point stays disabled.')])
  ],'lock')
 ]);
},async save(button,force=false){return misectel.withLongRpcTimeout(()=>this.saveAssignment(button,force));},async saveAssignment(button,force=false){if(this.feedbackNode)this.feedbackNode.hidden=true;misectel.setButtonBusy(button,true);let prepared=false;let writeAttempted=false;try{if(force&&!this.managerConfig?.force_save_supported)
throw new Error(_('The interface manager must be upgraded before applying these settings.'));if(!this.capabilities?.qmodem_passthrough?.lan_first)
throw new Error(_('The interface manager must be upgraded before applying these settings.'));if(this.managerConfig?.pending_token)
throw new Error(_('Confirm or revert the pending configuration first.'));const selectedPorts=this.form.bridgePorts.inputs.filter((input)=>input.checked).map((input)=>input.value);const selectedWifi=this.form.bridgeWifi.value;if(selectedPorts.length+(selectedWifi?1:0)>1)throw new Error(_('Select only one Ethernet port or Wi-Fi access point for passthrough.'));if(selectedWifi&&!this.capabilities?.provider_interface_types?.qmodem_passthrough?.includes('wifi'))
throw new Error(_('The interface manager must be upgraded before assigning a Wi-Fi AP.'));const managementCidr=this.form.managementIp.value.trim();if(!parseCidr(managementCidr))
throw new Error(_('Enter a valid static IPv4 CIDR. The prefix must be between /1 and /31, and the address cannot be a network or broadcast address.'));const enabled=this.form.bridgeMode.checked;if(enabled&&!selectedPorts.length&&!selectedWifi)throw new Error(_('Select an Ethernet port or Wi-Fi access point for passthrough.'));const revision=Number(this.managerConfig?.config?.global?.revision||0);let result;try{writeAttempted=true;result=await callSetQmodem(this.form.modemId,{enabled:enabled?'1':'0',desired_port:selectedPorts,desired_wifi:selectedWifi?[selectedWifi]:[],management_cidr:managementCidr},revision,force);}
catch(err){if(force)throw err;result=await recoverPendingSave(this.form.modemId,enabled,selectedPorts,selectedWifi,managementCidr,revision,90);if(!result)
throw err;}
if(!result?.result){writeAttempted=false;throw new Error((result?.errors||[_('Interface assignment failed')]).join('; '));}
prepared=true;const activated=force?{result:true}:await callActivate(result.pending_token);if(!activated?.result)
throw new Error(_('The LAN change could not be started. Check the pending configuration.'));await this.refreshTransaction();if(this.managerConfig?.pending_token)this.transactionNode.scrollIntoView({behavior:'smooth',block:'start'});}
catch(err){await L.resolveDefault(this.refreshTransaction(),null);if(force&&writeAttempted)
this.notify(_('Force save could not be verified. If accepted by the device, the configuration will not roll back. Reconnect and check the current settings. Details: %s').format(err.message||err),'warning');else if(prepared)
this.notify(_('Connection interrupted during the LAN change. Reconnect to the management address to keep the settings; otherwise they will be reverted automatically.'),'warning');else
this.notify(_('Failed to save bridge mode settings: %s').format(err.message||err),'error');}
finally{misectel.setButtonBusy(button,false);this.syncControls();}},refreshMap(){
 const status=(this.managerStatus?.qmodem||[]).find(item=>item.instance===this.selectedModemId),assignment=this.assignment(this.selectedModemId);
 const address=status?.cellular_ipv4;
 if(this.mapAddress)this.mapAddress.textContent=address||'Waiting for address';
 if(this.mapHandoff){
  const active=!this.managerConfig?.pending_token&&modemHelper.boolValue(assignment?.enabled,false)&&status?.endpoint_attached&&status?.passthrough_active&&address;
  const ports=normalizeList(assignment?.desired_port),wifi=normalizeList(assignment?.desired_wifi);
  this.mapHandoff.textContent=active?address+' → '+(ports.length?portLabel(ports[0]):wifi.length?'Wi-Fi AP':'Handoff')+' · Passthrough active':this.managerConfig?.pending_token?'Handoff awaiting confirmation':modemHelper.boolValue(assignment?.enabled,false)?'Waiting for cellular handoff':'Cellular address stays with Chester in router mode';
 }
},async refreshTransaction(){const previousToken=this.managerConfig?.pending_token;const[config,status]=await Promise.all([callInterfaceConfig(),callInterfaceStatus()]);this.managerConfig=config;this.managerStatus=status;this.refreshMap();if(this.statusNode)dom.content(this.statusNode,[this.renderConnectionState()]);if(this.transactionNode)
dom.content(this.transactionNode,this.renderTransaction());if(previousToken&&!config.pending_token&&this.cardNode&&this.modems?.length)
dom.content(this.cardNode,[this.renderCard(this.modems.find((item)=>item.id===this.selectedModemId))]);this.syncControls();},async confirmPending(){const state=this.managerConfig?.transaction;if(!state?.ready||state.remaining<=0)return;try{const result=await callConfirm(state.token);if(!result?.result)throw new Error((result?.errors||[_('The interface assignment could not be confirmed.')]).join('; '));this.notify(_('Settings kept. The cellular connection is restarting; renew DHCP on your downstream router.'),'info');if(result.service_restart_queued===false)
this.notify(_('The settings are saved, but the modem service could not be restarted.'),'warning');}
catch(err){this.notify(_('Confirmation could not be verified. Refresh the page to check the current state.'),'warning');}
await L.resolveDefault(this.refreshTransaction(),null);},async cancelPending(){const token=this.managerConfig?.transaction?.token;if(!token)return;const result=await L.resolveDefault(callRollback(token),null);if(!result?.result)
this.notify(_('The interface rollback could not be confirmed. Reload the page and check the current configuration before retrying.'),'warning');await L.resolveDefault(this.refreshTransaction(),null);},renderTransaction(){
 const state=this.managerConfig?.transaction;
 if(state?.force)return[settings.card('Applying without Rollback','The advanced apply is in progress. Keep your management connection available.',[],'clock')];
 if(!state){
  const outcome=this.managerConfig?.force_result;
  if(outcome&&outcome.instance===this.selectedModemId&&outcome.revision===Number(this.managerConfig?.config?.global?.revision)&&!outcome.result)return[settings.card('Apply Needs Attention',outcome.error||'The settings were saved, but the network change did not finish.',[],'shield')];
  const status=(this.managerStatus?.qmodem||[]).find(item=>item.instance===this.selectedModemId);
  return status?.requires_apply?[settings.card('Finish Setting Up Passthrough','Apply safely and confirm the port assignment to activate these existing settings.',[],'network')]:[];
 }
 const enabled=modemHelper.boolValue(this.assignment(state.instance)?.enabled,false),address=parseCidr(this.assignment(state.instance)?.management_cidr||'')?.address;
 const keep=settings.button(enabled?'Keep Settings & Connect':'Keep Router Mode',()=>this.confirmPending());keep.disabled=!state.ready||state.remaining<=0;
 return [settings.card('Check Access, Then Keep Settings','This is a temporary network change until you confirm it.',[
  E('div',{'class':'pt-confirm'},[E('div',{'class':'pt-countdown',role:'timer','aria-label':state.remaining+' Seconds Remaining'},[E('strong',{},[String(state.remaining)]),E('span',{},['seconds'])]),E('div',{},[
   E('strong',{},[state.ready?'Port Changes Are Ready':'Applying Port Changes…']),
   E('p',{'class':'st-muted'},[enabled?'Keep this page open through another LAN port or normal Wi-Fi. Confirming starts the modem in passthrough mode.':'The selected ports are returning to normal LAN service. Confirm to restart normal cellular routing.'])
  ])]),
  address&&enabled?E('p',{'class':'pt-address-note'},['Static-IP management on the passthrough port: ',E('a',{href:'http://'+address+window.location.pathname,target:'_blank',rel:'noopener'},[address])]):'',
  E('div',{'class':'pt-confirm-actions'},[settings.button('Revert Changes',()=>this.cancelPending(),{'class':'st-button secondary'}),keep]),
  E('p',{'class':'st-muted pt-note'},['If you lose access or do not confirm, the previous settings return automatically. Reconnect the cable or renew DHCP after switching modes.'])
 ],'shield')];
},render(data){
 this.modems=data.modems||[];this.lanDevices=data.lanDevices||[];this.wifiDevices=data.wifiDevices||[];this.managerConfig=data.managerConfig||{};this.managerStatus=data.managerStatus||{};this.capabilities=data.capabilities||{};
 this.selectedModemId=modemHelper.ensureSelected(this.selectedModemId,this.modems);this.cardNode=E('div');this.statusNode=E('div');this.transactionNode=E('div',{'class':'pt-transaction'});this.feedbackNode=E('div',{'class':'pt-feedback',role:'status','aria-live':'polite',hidden:true});
 poll.add(()=>this.refreshTransaction().catch(()=>{}),2);
 if(!this.modems.length)return settings.sheet([settings.head('IP Passthrough','A direct connection to your own router.','network'),settings.card('No Modem Detected','Connect a modem before configuring passthrough.',[],'router')],'st-passthrough');
 const selector=buildSelect(this.selectedModemId,this.modems);this.modemSelector=selector;
 const redraw=()=>{dom.content(this.cardNode,[this.renderCard(this.modems.find(m=>m.id===this.selectedModemId))]);dom.content(this.statusNode,[this.renderConnectionState()]);dom.content(this.transactionNode,this.renderTransaction());};
 selector.addEventListener('change',()=>{this.selectedModemId=selector.value;redraw();});redraw();
 const save=settings.button('Apply Safely',ui.createHandlerFn(this,ev=>this.save(ev.currentTarget)));this.applyButton=save;const force=settings.button('Apply without Rollback',ui.createHandlerFn(this,ev=>this.save(ev.currentTarget,true)),{'class':'st-button secondary'});this.forceButton=force;
 const advanced=E('details',{'class':'st-card pt-advanced'},[E('summary',{},['Advanced Apply']),E('p',{'class':'st-muted'},['Apply without automatic rollback only when you have a separate management connection. Incorrect settings can leave the router unreachable.']),force]);this.syncControls();
 return settings.sheet([
  E('link',{rel:'stylesheet',href:L.resource('chester-ui/passthrough.css')+'?v=20261122-4'}),
  settings.head('IP Passthrough','A direct connection to your own router.','network'),this.statusNode,this.feedbackNode,
  this.modems.length>1?settings.card('Current Modem',null,[settings.field('Select Modem',selector)],'router'):null,
  this.transactionNode,this.cardNode,settings.footer(save,'Apply → check management access → keep settings.'),advanced
 ].filter(Boolean),'st-passthrough');
},handleSave:null,handleSaveApply:null,handleReset:null});
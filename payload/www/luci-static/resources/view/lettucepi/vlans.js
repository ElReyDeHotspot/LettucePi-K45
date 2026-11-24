'use strict';
'require view';
'require ui';
'require uci';
'require rpc';
'require dom';
'require chester-ui.settings as settings';
'require chester-ui.vlans as vlans';

const dump=rpc.declare({object:'network.interface',method:'dump',expect:{interface:[]}});
const configs=['network','dhcp','firewall'];
const list=v=>Array.isArray(v)?v:v?[v]:[];
function configSnapshot(){return JSON.stringify(configs.map(c=>uci.sections(c)));}
function select(options,value,change){return E('select',{change:ev=>change(ev.target.value)},options.map(([v,label])=>E('option',{value:String(v),selected:String(v)===String(value)?'selected':null},[label])));}
function networkName(model,id){return Number(id)===1?'Main LAN':model.networks.find(n=>Number(n.id)===Number(id))?.name||'Unknown network';}

return view.extend({
 async load(){await Promise.all(configs.map(c=>uci.load(c)));return L.resolveDefault(dump(),[]);},
 readModel(interfaces){
  const bridge=uci.sections('network','device').find(d=>d.type==='bridge'&&d.name==='br-lan'),managed=[];
  for(const config of configs)for(const s of uci.sections(config))if(s.chester_vlan==='1')managed.push({config,sid:s['.name']});
  const networkSections=uci.sections('network','interface'),wanZone=uci.sections('firewall','zone').find(z=>list(z.network).some(n=>n==='wan'||n==='pcie0'))?.name;
  const model={bridge:bridge?.name||'br-lan',bridgeSid:bridge?.['.name'],wanZone,managed,wasManaged:managed.some(m=>m.config==='network'),reserved:[],networks:[],ports:[],blocked:''};
  if(!bridge||!list(bridge.ports).length)model.blocked='This page needs the router’s br-lan Ethernet bridge.';
  const unmanaged=uci.sections('network','bridge-vlan').filter(v=>v.device===model.bridge&&v.chester_vlan!=='1');
  if(unmanaged.length)model.blocked='Existing custom VLANs are already configured. Use Advanced Network settings to edit those without overwriting them.';
  const lanDevice=uci.get('network','lan','device');
  if(lanDevice!==model.bridge&&!(model.wasManaged&&lanDevice===model.bridge+'.1'))model.blocked='The Main LAN uses a custom device. Use Advanced Network settings for this configuration.';
  for(const s of networkSections.filter(n=>n.chester_vlan==='1')){
   const id=Number(String(s.device||'').split('.').pop()),mask=vlans.ipNumber(s.netmask||'255.255.255.0'),prefix=mask===null?24:mask.toString(2).split('1').length-1;
   const zone=uci.sections('firewall','zone').find(z=>list(z.network).includes(s['.name']));
   model.networks.push({id,name:s.chester_name||s['.name'],cidr:list(s.ipaddr)[0]+'/'+prefix,dhcp:uci.get('dhcp',s['.name'],'ignore')!=='1',internet:uci.sections('firewall','forwarding').some(f=>f.src===zone?.name&&f.dest===wanZone)});
  }
  for(const iface of interfaces||[]){
   if(networkSections.some(n=>n['.name']===iface.interface&&n.chester_vlan==='1'))continue;
   for(const addr of iface['ipv4-address']||[]){const c=vlans.cidr(addr.address+'/'+addr.mask);if(c)model.reserved.push(c);}
  }
  // Include static networks even while their interface is down.
  for(const s of networkSections.filter(n=>n.chester_vlan!=='1'&&n.proto==='static')){
   const mask=vlans.ipNumber(s.netmask||'255.255.255.0'),prefix=mask===null?24:mask.toString(2).split('1').length-1;
   for(const addr of list(s.ipaddr)){const c=vlans.cidr(addr.includes('/')?addr:addr+'/'+prefix);if(c)model.reserved.push(c);}
  }
  const memberships=uci.sections('network','bridge-vlan').filter(v=>v.device===model.bridge);
  model.ports=list(bridge?.ports).slice().sort((a,b)=>(/^lan[123]$/.test(a)?-Number(a.slice(3)):a==='wan'?99:100)-(/^lan[123]$/.test(b)?-Number(b.slice(3)):b==='wan'?99:100)).map(name=>{let native=1,tagged=[];for(const v of memberships)for(const member of list(v.ports)){const [port,flags='']=member.split(':');if(port!==name)continue;if(flags.includes('t'))tagged.push(Number(v.vlan));else native=Number(v.vlan);}return {name,native,tagged};});
  return model;
 },
 markDirty(){this.review.hidden=true;this.applyButton.disabled=JSON.stringify(this.model)===this.original||!!this.model.blocked;this.changeNote.textContent=this.applyButton.disabled?'No changes to apply.':'Changes are staged on this page. Your network is unchanged.';},
 message(text,error){this.messageNode.textContent=text;this.messageNode.className='st-message'+(error?' error':'');},
 renderNetworks(){
  return [E('div',{'class':'vl-network-row'},[E('div',{},[E('strong',{},['Main LAN']),E('small',{},[this.model.wasManaged?'Your current router network · VLAN 1':'Your current router network · Untagged'])]),E('span',{'class':'vl-tag'},['Management'])]),...this.model.networks.map(n=>E('div',{'class':'vl-network-row'},[
   E('div',{},[E('strong',{},[n.name]),E('small',{},['VLAN '+n.id+' · '+n.cidr+' · '+(n.dhcp?'DHCP on':'DHCP off')])]),E('div',{'class':'vl-row-actions'},[settings.button('Edit',()=>this.openCreator(n),{'class':'st-button secondary'}),E('button',{type:'button','class':'st-button secondary',click:()=>{this.model.networks=this.model.networks.filter(x=>x!==n);for(const p of this.model.ports){if(Number(p.native)===Number(n.id))p.native=1;p.tagged=p.tagged.filter(id=>Number(id)!==Number(n.id));}this.redraw();}},['Remove'])])
  ]))];
 },
 renderPorts(){
  const choices=[[1,'Main LAN'],...this.model.networks.map(n=>[n.id,n.name])];
  const ports=this.model.ports.map(p=>settings.card(p.name.toUpperCase(),'Choose what devices on this socket can reach.',[
   settings.field('Default network',select(choices,p.native,value=>{p.native=Number(value);p.tagged=p.tagged.filter(id=>Number(id)!==p.native);this.redraw();}),'For ordinary computers and other untagged devices.'),
   E('details',{'class':'st-advanced'},[E('summary',{},['Carry multiple networks']),E('p',{'class':'st-muted'},['For a managed switch or access point. Select the additional tagged networks it should receive.']),
    ...choices.filter(([id])=>Number(id)!==Number(p.native)).map(([id,name])=>{const check=E('input',{type:'checkbox',checked:p.tagged.includes(Number(id))?'checked':null,change:ev=>{p.tagged=ev.target.checked?[...p.tagged,Number(id)]:p.tagged.filter(x=>x!==Number(id));this.markDirty();}});return settings.toggle(name,check,'Tagged VLAN '+id);})
   ])
  ],'port'));
  if(!this.model.ports.some(p=>p.name==='wan'))ports.push(settings.card('WAN','Reserved for your Internet connection.',[E('p',{'class':'st-muted'},['To use this socket for a VLAN, first switch it to LAN in Failover.']),E('a',{'class':'st-button secondary',href:L.url('admin','network','failover')},['Open Failover'])],'port'));
  return ports;
 },
 redraw(){dom.content(this.networkList,this.renderNetworks());dom.content(this.portList,this.renderPorts());this.markDirty();},
 openCreator(network){
  this.editingId=network?.id||null;this.nameInput.value=network?.name||'';let id=20;while(this.model.networks.some(n=>Number(n.id)===id))id+=10;
  this.idInput.value=network?.id||id;this.idInput.disabled=!!network;this.gatewayInput.value=network?.cidr||('192.168.'+(id<255?id:20)+'.1/24');this.dhcpInput.checked=network?network.dhcp:true;this.internetInput.checked=network?network.internet:true;this.addButton.textContent=network?'Save draft':'Add to draft';this.creator.hidden=false;
 },
 addNetwork(){
  const n={name:this.nameInput.value.trim(),id:Number(this.idInput.value),cidr:this.gatewayInput.value.trim(),dhcp:this.dhcpInput.checked,internet:this.internetInput.checked};
  const temporary={...this.model,networks:[...this.model.networks.filter(x=>x.id!==this.editingId),n]};
  const errors=vlans.validate(temporary).filter(e=>!e.endsWith('assign at least one port before applying.'));
  if(errors.length){this.message(errors.join(' '),true);return;}
  const reserved=['network','dhcp'].some(c=>uci.get(c,'cv'+n.id))||uci.sections('firewall').some(s=>s['.name'].startsWith('cv'+n.id+'_')&&s.chester_vlan!=='1');
  if(reserved&&!this.editingId){this.message('That VLAN ID conflicts with an existing configuration. Choose another ID.',true);return;}
  if(this.editingId)this.model.networks=this.model.networks.map(x=>x.id===this.editingId?n:x);else this.model.networks.push(n);this.editingId=null;this.creator.hidden=true;this.message('Network added to your draft. Assign it to a port below.');this.redraw();
 },
 async reviewChanges(){
  this.message('');const errors=vlans.validate(this.model);if(errors.length){this.message(errors.join(' '),true);return;}
  this.plan=vlans.plan(this.model);dom.content(this.reviewBody,[E('p',{'class':'st-muted'},['These changes will restart networking. If this browser cannot reconnect, OpenWrt will roll back automatically.']),E('ul',{},this.model.ports.map(p=>E('li',{},[p.name.toUpperCase()+': '+networkName(this.model,p.native)+(p.tagged.length?' + tagged '+p.tagged.map(id=>networkName(this.model,id)).join(', '):'')]))),E('p',{'class':'st-muted'},['New VLANs have their own IPv4 subnet, are separated from Main LAN, and cannot administer the router. Devices in the same VLAN can communicate with each other.'])]);this.review.hidden=false;
 },
 async applyChanges(button){
  button.disabled=true;
  try{
   const pending=await uci.changes();if(Object.values(pending||{}).some(v=>v.length))throw new Error('Finish or discard other pending router changes first, then reload this page.');
   for(const c of configs)uci.unload(c);await Promise.all(configs.map(c=>uci.load(c)));
   if(configSnapshot()!==this.baseline)throw new Error('Router settings changed while this page was open. Reload the page before applying your VLAN draft.');
   const live=await L.resolveDefault(dump(),[]),current=this.readModel(live),checked={...this.model,reserved:current.reserved,blocked:current.blocked,wanZone:current.wanZone};
   const ops=vlans.plan(checked); // Validate again using current uplink subnets.
   for(const op of ops)if(op.action==='add'&&uci.get(op.config,op.sid)&&!current.managed.some(m=>m.config===op.config&&m.sid===op.sid))throw new Error('A configuration section named '+op.sid+' already exists. Choose a different VLAN ID.');
   for(const op of ops){if(op.action==='remove')uci.remove(op.config,op.sid);else if(op.action==='add')uci.add(op.config,op.type,op.sid);else uci.set(op.config,op.sid,op.key,op.value);}
   await uci.save();await ui.changes.init();ui.changes.apply(true);
  }catch(e){this.message(e.message||String(e),true);}finally{button.disabled=false;}
 },
 render(interfaces){
  this.model=this.readModel(interfaces);this.original=JSON.stringify(this.model);this.baseline=configSnapshot();
  this.networkList=E('div');this.portList=E('div',{'class':'vl-port-grid'});this.messageNode=E('div',{'class':'st-message',role:'status','aria-live':'polite'});
  this.nameInput=E('input',{type:'text',maxlength:32,placeholder:'Guest'});this.idInput=E('input',{type:'number',min:2,max:4094,value:20});this.gatewayInput=E('input',{type:'text',value:'192.168.20.1/24'});this.dhcpInput=E('input',{type:'checkbox',checked:true});this.internetInput=E('input',{type:'checkbox',checked:true});
  this.addButton=settings.button('Add to draft',()=>this.addNetwork());this.creator=E('div',{'class':'vl-creator',hidden:true},[E('div',{'class':'st-fields'},[settings.field('Network name',this.nameInput,'For example Guest, Office or Cameras.'),settings.field('VLAN ID',this.idInput,'A unique number from 2 to 4094.'),settings.field('Gateway & subnet',this.gatewayInput,'Example: 192.168.20.1/24. Use the first usable address.')]),settings.toggle('Assign IP addresses automatically',this.dhcpInput,'DHCP makes connecting ordinary devices easier.'),settings.toggle('Internet access',this.internetInput,'Allow this network to use the router’s Internet uplinks.'),settings.footer(this.addButton,'Nothing is applied yet.')]);
  this.applyButton=settings.button('Review changes',()=>this.reviewChanges(),{disabled:true});this.changeNote=E('span',{'class':'st-muted'},['No changes to apply.']);this.reviewBody=E('div');
  this.review=E('section',{'class':'st-card',hidden:true},[E('h3',{},['Ready to apply?']),this.reviewBody,settings.footer(settings.button('Apply with rollback',(ev)=>this.applyChanges(ev.currentTarget)),'Keep a Main LAN port available to manage the router.')]);
  const networks=settings.card('Your networks','Separate guest devices, office equipment or cameras into their own networks.',[this.networkList,settings.footer(settings.button('Create network',()=>this.openCreator(),{disabled:this.model.blocked?'disabled':null})),this.creator],'network');
  const root=settings.sheet([settings.head('VLANs','Separate networks. Simple connections.','network'),E('div',{'class':'st-note'},['Start with Create network, then assign a port. Ordinary devices use its Default network. A managed switch or access point can carry additional tagged networks.']),this.model.blocked?E('div',{'class':'st-note warning'},[this.model.blocked,' ',E('a',{href:L.url('admin','developer','network-network')},['Advanced Network settings'])]):'',networks,settings.card('Port assignments','One default network per port. Add tagged networks only when the connected device supports VLANs.',[this.portList],'port'),this.messageNode,E('div',{'class':'st-footer'},[this.changeNote,E('div',{'class':'vl-row-actions'},[settings.button('Discard draft',()=>{this.model=JSON.parse(this.original);this.creator.hidden=true;this.editingId=null;this.message('Draft discarded.');this.redraw();},{'class':'st-button secondary'}),this.applyButton])]),this.review,E('p',{'class':'st-muted'},['This page configures wired IPv4 VLANs. Wi-Fi network assignments are managed separately.'])],'st-vlans');
  this.redraw();return root;
 },handleSave:null,handleSaveApply:null,handleReset:null
});

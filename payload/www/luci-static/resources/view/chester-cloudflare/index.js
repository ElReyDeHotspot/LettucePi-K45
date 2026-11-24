'use strict';
'require view';
'require chester-ui.dns-presets as dnsPresets';
'require rpc';
'require poll';
'require dom';
'require chester-ui.settings as kit';
'require misectel.ui as helpers';
const status=rpc.declare({object:'chester.cloudflare',method:'status',expect:{}});
const save=rpc.declare({object:'chester.cloudflare',method:'save',params:['settings'],expect:{}});
const register=rpc.declare({object:'chester.cloudflare',method:'register',params:['accepted'],expect:{}});
const linkPlus=rpc.declare({object:'chester.cloudflare',method:'link_plus',params:['license','accepted'],expect:{}});
const testDNS=rpc.declare({object:'chester.cloudflare',method:'test_dns',expect:{}});
const testWARP=rpc.declare({object:'chester.cloudflare',method:'test_warp',expect:{}});
function select(value,options){return E('select',{},options.map(([v,label])=>E('option',{value:v,selected:value===v?'selected':null},[label])));}
function lines(value){return value.split(/[\s,]+/).map(s=>s.trim()).filter(Boolean);}
return view.extend({
 load(){return status();},
 message(text,error){this.feedback.textContent=text;this.feedback.className='cf-feedback'+(error?' is-error':'');this.feedback.hidden=false;},
 async action(button,fn,success){button.disabled=true;try{const result=await fn();if(!result.success)throw new Error(result.error||result.tunnel?.error||'The connection test did not pass.');this.message(typeof success==='function'?success(result):success);await this.update();}catch(e){this.message(e.message||String(e),true);}finally{button.disabled=false;}},
 async update(){const data=await status();this.data=data;dom.content(this.metrics,this.stats(data));this.registerButton.disabled=data.registered;this.registerButton.textContent=data.registered?'Free WARP Registered':'Register Free WARP';this.terms.hidden=data.registered||data.plus_registered;if(this.plusStatus)this.plusStatus.textContent=data.plus_registered?'WARP+ Subscription Linked':data.plus_pending?'Saved Key · Confirmation Needed':'No WARP+ Subscription Linked';if(this.plusLinkButton&&!this.linking)this.plusLinkButton.textContent=data.plus_pending?'Retry WARP+ Link':data.plus_registered?'Update WARP+ Subscription':'Link WARP+ Subscription';},
 stats(d){return [kit.stat('DNS',({system:'Automatic',cloudflare:'Cloudflare · Encrypted',malware:'Malware protection',family:'Family protection',manual:'Manual servers'})[d.settings?.dns]||'Automatic','shield'),kit.stat('WARP',!d.settings?.warp?'Off':d.tunnel?.ready?(d.tunnel.warp==='plus'?'Connected · WARP+':'Connected · Free WARP'):d.settings?.block?'Connecting · Internet blocked':'Connecting · Direct internet','network'),kit.stat('Tunnel IP',d.tunnel?.ready?d.tunnel.ip:'Not connected','router')];},
 render(data){
 this.data=data;const s=data.settings||{};
 this.feedback=E('div',{'class':'cf-feedback',role:'status','aria-live':'polite',hidden:true});this.metrics=E('div',{'class':'st-summary'},this.stats(data));
 const mode=select(s.dns||'system',[['system','Automatic · Use Existing DNS'],['cloudflare','Cloudflare · Standard'],['malware','Cloudflare · Block Malware'],['family','Cloudflare · Block Malware and Adult Content'],['manual','Manual DNS Servers']]);
 const ipv4=E('textarea',{rows:2,placeholder:'1.1.1.1\n1.0.0.1',spellcheck:'false'},[(s.ipv4||[]).join('\n')]);
 const ipv6=E('textarea',{rows:2,placeholder:'2606:4700:4700::1111\n2606:4700:4700::1001',spellcheck:'false'},[(s.ipv6||[]).join('\n')]);
 const presetNote=E('p',{'class':'st-muted cf-preset-note',role:'status','aria-live':'polite'}),presetButtons=[];
 const syncPresets=()=>{const id=dnsPresets.selected(ipv4.value,ipv6.value);presetButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-preset')===id)));};
 dnsPresets.presets.forEach(p=>presetButtons.push(E('button',{type:'button','class':'cf-dns-preset','data-preset':p.id,'aria-pressed':'false',click:()=>{dnsPresets.fill(p.id,ipv4,ipv6);syncPresets();presetNote.textContent=p.name+' addresses filled in. Save & Apply to use them.';}},[E('strong',{},[p.name]),E('small',{},[p.detail])])));
 const editDNS=()=>{syncPresets();presetNote.textContent='';};ipv4.addEventListener('input',editDNS);ipv6.addEventListener('input',editDNS);syncPresets();
 const manual=E('div',{'class':'cf-manual-dns'},[E('div',{'class':'cf-dns-shortcuts'},[E('h4',{},['DNS Shortcuts']),E('div',{'class':'cf-dns-presets',role:'group','aria-label':'DNS Shortcuts'},presetButtons),presetNote]),E('div',{'class':'st-fields'},[kit.field('IPv4 DNS Servers',ipv4,'One address per line. IPv4 and IPv6 can be used together.'),kit.field('IPv6 DNS Servers',ipv6,'Requires a working IPv6 internet connection.')])]);const syncDNS=()=>{manual.hidden=mode.value!=='manual';};mode.addEventListener('change',syncDNS);syncDNS();
 const enabled=E('input',{type:'checkbox',checked:s.warp?'checked':null});
 let chosenPlan=s.tier==='plus'?'plus':'free';
 const license=E('input',{type:'password',autocomplete:'new-password',spellcheck:'false',autocapitalize:'off',placeholder:'XXXXXXXX-XXXXXXXX-XXXXXXXX',maxlength:26});
 this.plusStatus=E('strong',{},[data.plus_registered?'WARP+ Subscription Linked':data.plus_pending?'Saved Key · Confirmation Needed':'No WARP+ Subscription Linked']);
 const linkButton=kit.button(data.plus_pending?'Retry WARP+ Link':'Link WARP+ Subscription',ev=>this.action(ev.currentTarget,async()=>{
  if(!(this.data.registered||this.data.plus_registered||accepted.checked))throw new Error('Review and accept the Cloudflare terms first.');
  const key=license.value.trim();if(!/^[A-Za-z0-9]{8}-[A-Za-z0-9]{8}-[A-Za-z0-9]{8}$/.test(key)&&!(key===''&&this.data.plus_pending))throw new Error('Enter the WARP+ license key from the 1.1.1.1 app.');
  this.linking=true;ev.currentTarget.textContent='Linking Subscription…';
  try{return await helpers.withLongRpcTimeout(()=>linkPlus(key,'1'));}finally{license.value='';this.linking=false;}
 },'WARP+ subscription confirmed. Save & Apply to use the selected plan.').finally(()=>this.update().catch(()=>{})));this.plusLinkButton=linkButton;
 const plusPanel=E('div',{'class':'cf-plus-panel'},[this.plusStatus,kit.field('WARP+ License Key',license,'In the 1.1.1.1 app: Settings → Account → Key. Leave blank to retry a saved link. The key is never displayed again.'),linkButton,E('p',{'class':'st-muted'},['Use an existing WARP+ subscription. Switching to Free WARP does not cancel your subscription.'])]);
 const freePanel=E('p',{'class':'st-muted cf-free-panel'},['Free WARP includes an encrypted tunnel. No paid subscription is required.']);
 let planButtons=[];
 const syncPlan=()=>{if(this.registerButton)this.registerButton.hidden=chosenPlan!=='free';plusPanel.hidden=chosenPlan!=='plus';freePanel.hidden=chosenPlan!=='free';planButtons.forEach(b=>{const active=b.getAttribute('data-plan')===chosenPlan;b.classList.toggle('is-active',active);b.setAttribute('aria-checked',active?'true':'false');});};
 planButtons=[['free','Free WARP','No subscription'],['plus','WARP+','Use your subscription']].map(([value,title,detail])=>E('button',{type:'button',role:'radio','data-plan':value,'aria-label':title,'aria-checked':chosenPlan===value?'true':'false','class':'cf-plan-button',click:()=>{chosenPlan=value;syncPlan();}},[kit.icon(value==='plus'?'plus':'shield'),E('span',{},[E('strong',{},[title]),E('small',{},[detail])]) ]));
 const plans=E('div',{'class':'cf-plans',role:'radiogroup','aria-label':'WARP Plan'},planButtons);syncPlan();
 const scope=select(s.scope||'all',[['all','All Devices on the Main LAN'],['selected','Selected Device IPs / Subnets']]);
 const clients=E('textarea',{rows:3,placeholder:'192.168.100.50\n192.168.100.128/28',spellcheck:'false'},[(s.clients||[]).join('\n')]);const clientField=kit.field('Device Addresses',clients,'One IPv4 / IPv6 address or CIDR per line. Reserve device addresses in DHCP first.');const syncScope=()=>{clientField.hidden=scope.value!=='selected';};scope.addEventListener('change',syncScope);syncScope();
 const outage=select(s.block?'block':'direct',[['direct','Keep Internet Working · Use the Normal Connection'],['block','Block Internet · Wait for WARP to Reconnect']]);
 const accepted=E('input',{type:'checkbox'});this.terms=E('div',{'class':'cf-terms',hidden:data.registered||data.plus_registered},[E('label',{},[accepted,E('span',{},['I accept the ',E('a',{href:'https://www.cloudflare.com/application/terms/',target:'_blank',rel:'noopener'},['Cloudflare application terms']),' and want to register this router.'])])]);
 this.registerButton=kit.button(data.registered?'Free WARP Registered':'Register Free WARP',ev=>{if(!accepted.checked){this.message('Review and accept the Cloudflare terms to register this router.',true);return;}return this.action(ev.currentTarget,()=>register('1'),'This router has its own free WARP registration.');});this.registerButton.disabled=data.registered;syncPlan();
 const apply=kit.button('Save & Apply',ev=>this.action(ev.currentTarget,()=>save(JSON.stringify({dns:mode.value,ipv4:lines(ipv4.value),ipv6:lines(ipv6.value),warp:enabled.checked,tier:chosenPlan,scope:scope.value,clients:lines(clients.value),block:outage.value==='block'})),'Settings applied. WARP can take a few seconds to connect.'));
 const dnsButton=kit.button('Test DNS',ev=>this.action(ev.currentTarget,testDNS,r=>'DNS is working · '+r.latency_ms+' ms'),{'class':'st-button secondary'});
 const warpButton=kit.button('Test WARP',ev=>this.action(ev.currentTarget,testWARP,r=>'Cloudflare verified '+(r.tunnel.warp==='plus'?'WARP+':'Free WARP')+' · '+r.tunnel.ip+(r.tunnel.ipv6?' · IPv4 + IPv6':' · IPv4')) ,{'class':'st-button secondary'});
 poll.add(()=>this.update().catch(()=>{}),5);
 return kit.sheet([
  E('link',{rel:'stylesheet',href:L.resource('chester-ui/cloudflare.css')+'?v=20261124-3'}),
  kit.head('DNS Setup','Private DNS. Your choice of connection.','shield'),this.metrics,
  kit.card('DNS','Choose how your devices look up websites. Local device names keep working.',[kit.field('DNS Provider',mode,'Cloudflare presets use encrypted HTTPS. Manual servers use standard DNS.'),manual,E('div',{'class':'cf-actions'},[dnsButton])],'shield'),
  kit.card('WARP','Choose Free WARP or link your WARP+ subscription.',[plans,freePanel,this.terms,plusPanel,kit.toggle('Enable WARP',enabled,'Applies to devices routed through the main LAN. Local management and Tailscale stay reachable.'),E('div',{'class':'st-fields'},[kit.field('Protect',scope),kit.field('If WARP Disconnects',outage)]),clientField,E('div',{'class':'cf-actions'},[this.registerButton,warpButton]),E('p',{'class':'st-muted'},['Each router registers separately. IP Passthrough clients must configure WARP on their downstream router.'])],'network'),
  E('div',{'class':'cf-save-bar'},[apply,this.feedback])
 ],'st-cloudflare');
 },handleSave:null,handleSaveApply:null,handleReset:null
});

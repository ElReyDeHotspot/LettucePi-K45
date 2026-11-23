'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require chester-ui.settings as kit';
const status=rpc.declare({object:'chester.cloudflare',method:'status',expect:{}});
const save=rpc.declare({object:'chester.cloudflare',method:'save',params:['settings'],expect:{}});
const register=rpc.declare({object:'chester.cloudflare',method:'register',params:['accepted'],expect:{}});
const testDNS=rpc.declare({object:'chester.cloudflare',method:'test_dns',expect:{}});
const testWARP=rpc.declare({object:'chester.cloudflare',method:'test_warp',expect:{}});
function select(value,options){return E('select',{},options.map(([v,label])=>E('option',{value:v,selected:value===v?'selected':null},[label])));}
function lines(value){return value.split(/[\s,]+/).map(s=>s.trim()).filter(Boolean);}
return view.extend({
 load(){return status();},
 message(text,error){this.feedback.textContent=text;this.feedback.className='cf-feedback'+(error?' is-error':'');this.feedback.hidden=false;},
 async action(button,fn,success){button.disabled=true;try{const result=await fn();if(!result.success)throw new Error(result.error||result.tunnel?.error||'The connection test did not pass.');this.message(typeof success==='function'?success(result):success);await this.update();}catch(e){this.message(e.message||String(e),true);}finally{button.disabled=false;}},
 async update(){const data=await status();this.data=data;dom.content(this.metrics,this.stats(data));this.registerButton.disabled=data.registered;this.registerButton.textContent=data.registered?'Router registered':'Register this router';this.terms.hidden=data.registered;},
 stats(d){return [kit.stat('DNS',({system:'Automatic',cloudflare:'Cloudflare · Encrypted',malware:'Malware protection',family:'Family protection',manual:'Manual servers'})[d.settings?.dns]||'Automatic','shield'),kit.stat('WARP',!d.settings?.warp?'Off':d.tunnel?.ready?'Connected':d.settings?.block?'Connecting · Internet blocked':'Connecting · Direct internet','network'),kit.stat('Tunnel IP',d.tunnel?.ready?d.tunnel.ip:'Not connected','router')];},
 render(data){
 this.data=data;const s=data.settings||{};
 this.feedback=E('div',{'class':'cf-feedback',role:'status','aria-live':'polite',hidden:true});this.metrics=E('div',{'class':'st-summary'},this.stats(data));
 const mode=select(s.dns||'system',[['system','Automatic · Use existing DNS'],['cloudflare','Cloudflare · Standard'],['malware','Cloudflare · Block malware'],['family','Cloudflare · Block malware and adult content'],['manual','Manual DNS servers']]);
 const ipv4=E('textarea',{rows:2,placeholder:'1.1.1.1\n1.0.0.1',spellcheck:'false'},[(s.ipv4||[]).join('\n')]);
 const ipv6=E('textarea',{rows:2,placeholder:'2606:4700:4700::1111\n2606:4700:4700::1001',spellcheck:'false'},[(s.ipv6||[]).join('\n')]);
 const manual=E('div',{'class':'st-fields'},[kit.field('IPv4 DNS servers',ipv4,'One address per line. IPv4 and IPv6 can be used together.'),kit.field('IPv6 DNS servers',ipv6,'Requires a working IPv6 internet connection.')]);const syncDNS=()=>{manual.hidden=mode.value!=='manual';};mode.addEventListener('change',syncDNS);syncDNS();
 const enabled=E('input',{type:'checkbox',checked:s.warp?'checked':null});
 const scope=select(s.scope||'all',[['all','All devices on the main LAN'],['selected','Selected device IPs / subnets']]);
 const clients=E('textarea',{rows:3,placeholder:'192.168.100.50\n192.168.100.128/28',spellcheck:'false'},[(s.clients||[]).join('\n')]);const clientField=kit.field('Device addresses',clients,'One IPv4 / IPv6 address or CIDR per line. Reserve device addresses in DHCP first.');const syncScope=()=>{clientField.hidden=scope.value!=='selected';};scope.addEventListener('change',syncScope);syncScope();
 const outage=select(s.block?'block':'direct',[['direct','Keep internet working · Use the normal connection'],['block','Block internet · Wait for WARP to reconnect']]);
 const accepted=E('input',{type:'checkbox'});this.terms=E('div',{'class':'cf-terms',hidden:data.registered},[E('label',{},[accepted,E('span',{},['I accept the ',E('a',{href:'https://www.cloudflare.com/application/terms/',target:'_blank',rel:'noopener'},['Cloudflare application terms']),' and want to register this router.'])])]);
 this.registerButton=kit.button(data.registered?'Router registered':'Register this router',ev=>{if(!accepted.checked){this.message('Review and accept the Cloudflare terms to register this router.',true);return;}return this.action(ev.currentTarget,()=>register('1'),'This router has its own WARP registration.');});this.registerButton.disabled=data.registered;
 const apply=kit.button('Save & Apply',ev=>this.action(ev.currentTarget,()=>save(JSON.stringify({dns:mode.value,ipv4:lines(ipv4.value),ipv6:lines(ipv6.value),warp:enabled.checked,scope:scope.value,clients:lines(clients.value),block:outage.value==='block'})),'Settings applied. WARP can take a few seconds to connect.'));
 const dnsButton=kit.button('Test DNS',ev=>this.action(ev.currentTarget,testDNS,r=>'DNS is working · '+r.latency_ms+' ms'),{'class':'st-button secondary'});
 const warpButton=kit.button('Test WARP',ev=>this.action(ev.currentTarget,testWARP,r=>'Cloudflare verified WARP · '+r.tunnel.ip+(r.tunnel.ipv6?' · IPv4 + IPv6':' · IPv4')) ,{'class':'st-button secondary'});
 poll.add(()=>this.update().catch(()=>{}),5);
 return kit.sheet([
  E('link',{rel:'stylesheet',href:L.resource('chester-ui/cloudflare.css')+'?v=1'}),
  kit.head('Cloudflare','Private DNS. Your choice of connection.','shield'),this.metrics,this.feedback,
  kit.card('DNS','Choose how your devices look up websites. Local device names keep working.',[kit.field('DNS provider',mode,'Cloudflare presets use encrypted HTTPS. Manual servers use standard DNS.'),manual,E('div',{'class':'cf-actions'},[dnsButton])],'shield'),
  kit.card('WARP','An optional encrypted connection through Cloudflare.',[kit.toggle('Enable WARP',enabled,'Applies to devices routed through the main LAN. Local management and Tailscale stay reachable.'),E('div',{'class':'st-fields'},[kit.field('Protect',scope),kit.field('If WARP disconnects',outage)]),clientField,this.terms,E('div',{'class':'cf-actions'},[this.registerButton,warpButton]),E('p',{'class':'st-muted'},['Each router registers separately. IP Passthrough clients must configure WARP on their downstream router.'])],'network'),
  kit.footer(apply,'Changes apply immediately. No reboot needed.')
 ],'st-cloudflare');
 },handleSave:null,handleSaveApply:null,handleReset:null
});

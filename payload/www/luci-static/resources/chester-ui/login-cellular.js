(function(){
'use strict';
if(!document.body.classList.contains('node-main-login'))return;
const _=x=>x;
function chesterSplitCa(value){
	return String(value==null?'':value).split('/').map(function(x){return x.trim();}).filter(function(x){return x!=='';});
}
function chesterCarriersFromEntries(entries,mode){
	if(!Array.isArray(entries))return [];
	var groups={},order=[];
	for(var i=0;i<entries.length;i++){
		var e=entries[i]||{};
		var key=String(e.key||'').toLowerCase().replace(/[^a-z0-9]/g,'');
		var tag=String(e.extra_info||e.extraInfo||'').toUpperCase();
		var val=String(e.value==null?'':e.value).trim();
		if(!val||val==='-')continue;
		var slot=null;
		if(key==='band'||key==='bandca')slot='band';
		else if(key==='arfcn'||key==='earfcn'||key==='nrarfcn'||key==='arfcnca'||key==='earfcnca')slot='arfcn';
		else if(key==='physicalcellid'||key==='pci'||key==='pcid'||key==='physicalcellidca')slot='pci';
		else if(key==='dlbandwidth'||key==='dlbandwidthca')slot='bw';
		if(!slot)continue;
		/* the (CA) rows restate the secondary carrier that the slash-separated
		   rows already carry, so they are only used when nothing else did */
		var isCa=/ca$/.test(key)||/^CA-/.test(tag);
		var name=isCa?(tag||'CA'):(tag||'PRIMARY');
		if(!groups[name]){groups[name]={};order.push(name);}
		if(groups[name][slot]==null)groups[name][slot]=val;
	}
	var out=[],seen={};
	for(var g=0;g<order.length;g++){
		var name=order[g],grp=groups[name];
		var bands=chesterSplitCa(grp.band),arfcns=chesterSplitCa(grp.arfcn),
		    pcis=chesterSplitCa(grp.pci),bws=chesterSplitCa(grp.bw);
		var count=Math.max(bands.length,arfcns.length,pcis.length,bws.length);
		if(!count)continue;
		var nr=/NR/.test(name)||(name==='PRIMARY'&&/NR5G|(^|[^A-Z])NR([^A-Z]|$)/i.test(String(mode||''))&&!/LTE/i.test(String(mode||'')));
		for(var c=0;c<count;c++){
			var band=bands[c]||bands[0]||'';
			var parts=[];
			if(band)parts.push((nr?'N':'B')+band.replace(/^[NB]/i,''));
			var arfcn=arfcns[c]||arfcns[0];if(arfcn)parts.push(arfcn);
			var pci=pcis[c]||pcis[0];if(pci)parts.push(pci);
			var bw=bws[c]||bws[0];if(bw)parts.push(bw.replace(/\s*MHZ$/i,'')+'MHz');
			if(!parts.length)continue;
			var line=parts.join(' ');
			if(seen[line])continue;
			seen[line]=1;
			out.push({label:out.length?_('CA'):_('Band'),value:line,band:band?((nr?'N':'B')+band.replace(/^[NB]/i,'')):'',arfcn:arfcn||'',pci:pci||'',bw:bw?(bw.replace(/\s*MHZ$/i,'')+'MHz'):''});
		}
	}
	return out;
}


function chesterNetworkLabel(snapshot){
	var mode=String((snapshot&&snapshot.netMode)||'');
	var type=String((snapshot&&snapshot.networkType)||'');
	if(/EN-?DC|NSA/i.test(mode)||/EN-?DC|NSA/i.test(type))return 'NR5G NSA';
	if(/SA/i.test(mode)&&/NR5G|(^|[^A-Z])NR([^A-Z]|$)/i.test(mode))return 'NR5G SA';
	if(/NR5G/i.test(type)&&!/LTE/i.test(type))return 'NR5G SA';
	if(/LTE/i.test(type)&&!/NR5G/i.test(type))return 'LTE';
	return '';
}


/* The Carrier field often arrives as a bare PLMN (MCC+MNC) rather than a name
   -- 310260 is T-Mobile. Mapped for the US networks these ship on; anything
   unrecognised is passed through untouched rather than guessed at, so a new
   or foreign PLMN still shows its digits instead of the wrong operator. */
const CHESTER_PLMN={
'310260':'T-Mobile','310160':'T-Mobile','310200':'T-Mobile','310210':'T-Mobile',
'310220':'T-Mobile','310230':'T-Mobile','310240':'T-Mobile','310250':'T-Mobile',
'310270':'T-Mobile','310300':'T-Mobile','310310':'T-Mobile','310490':'T-Mobile',
'310530':'T-Mobile','310580':'T-Mobile','310660':'T-Mobile','310800':'T-Mobile',
'311490':'T-Mobile','312530':'T-Mobile','316010':'T-Mobile',
'310410':'AT&T','310150':'AT&T','310170':'AT&T','310380':'AT&T','310560':'AT&T',
'310680':'AT&T','310070':'AT&T','311180':'AT&T',
'313100':'FirstNet','313110':'FirstNet','313120':'FirstNet','313130':'FirstNet',
'311480':'Verizon','310004':'Verizon','310010':'Verizon','310012':'Verizon',
'310013':'Verizon','311280':'Verizon','311110':'Verizon',
'313340':'DISH','311870':'Boost','312250':'Cricket'};
function chesterCarrierName(value){
	var raw=String(value==null?'':value).trim();
	if(!raw)return raw;
	var digits=raw.replace(/[^0-9]/g,'');
	if(digits.length>=5&&digits.length<=6&&digits===raw.replace(/\s/g,''))
		return CHESTER_PLMN[digits]||raw;
	return raw;
}



const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const content=document.querySelector('#maincontent');if(!content||content.querySelector('.login-cellular'))return;
for(const [selector,text,id] of [['input[type=text]','Username','chester-login-username'],['input[type=password]','Password','chester-login-password']]){const input=content.querySelector(selector);if(!input)continue;if(!input.id)input.id=id;const field=input.closest('.cbi-value');if(field&&!field.querySelector('.login-visible-label')){const label=make('label','login-visible-label',text);label.htmlFor=input.id;field.insertBefore(label,field.firstChild);}}

const password=content.querySelector('input[type=password]'),username=content.querySelector('input[type=text]'),form=password?.form;
if(password&&form){
 const row=make('div','login-remember'),checkbox=document.createElement('input'),label=make('label','','Remember');checkbox.type='checkbox';checkbox.id='chester-remember-password';label.htmlFor=checkbox.id;checkbox.title='Use this browser’s saved-password manager';try{checkbox.checked=window.localStorage.getItem('chester-remember-password')==='1';}catch(e){}
 const sync=()=>{form.autocomplete=checkbox.checked?'on':'off';password.autocomplete=checkbox.checked?'current-password':'off';if(username)username.autocomplete='username';try{window.localStorage.setItem('chester-remember-password',checkbox.checked?'1':'0');}catch(e){}};
 checkbox.addEventListener('change',sync);sync();row.append(checkbox,label);
 const forgot=make('button','login-forgot','Forgot password?');forgot.type='button';forgot.setAttribute('aria-haspopup','dialog');
 const dialog=make('dialog','login-reset-help');dialog.setAttribute('aria-labelledby','chester-reset-help-title');
 const title=make('h2','','Reset with the physical button');title.id='chester-reset-help-title';
 const notice=make('p','login-reset-warning','A factory reset erases all saved settings, including your password, Wi-Fi and cellular configuration.');
 const steps=make('ol','');for(const text of ['Keep the router powered on and wait until it has finished starting.','Press and hold the physical Reset button for at least 5 seconds, then release it.','Leave the power connected while the router resets and reboots.','Reconnect, open 192.168.100.1, and complete Quick Start. The default login is root with password admin.'])steps.append(make('li','',text));
 const close=make('button','login-reset-close','Got it');close.type='button';close.addEventListener('click',()=>dialog.close());
 dialog.append(title,notice,steps,make('p','login-reset-note','This button only shows instructions. The reset must be performed on the router itself.'),close);document.body.append(dialog);
 dialog.addEventListener('close',()=>forgot.focus());forgot.addEventListener('click',()=>{dialog.showModal();close.focus();});
 row.append(forgot);password.closest('.cbi-value')?.after(row);
 const help=make('p','login-remember-help','Your browser may ask to save the password after you sign in.');label.title=help.textContent;
}
const panel=make('section','chester-home login-cellular');panel.setAttribute('aria-label','Cellular status');
const card=make('div','ch-card');card.append(make('h3','','Cellular'));const body=make('div','login-cellular-body');body.append(make('p','ch-muted','Reading cellular status…'));card.append(body);panel.append(card);const loginCard=content.querySelector(':scope > .container');if(loginCard)loginCard.prepend(panel);else content.prepend(panel);
const age=make('p','login-cellular-age');card.append(age);
function render(data){
 if(!data.available){body.replaceChildren(make('p','ch-muted','Cellular information is not available yet.'));age.textContent='Updates automatically.';return;}
 const entries=data.entries||[],value=key=>{const e=entries.find(e=>String(e.key).toLowerCase()===key&&/^NR/i.test(e.extra_info||''))||entries.find(e=>String(e.key).toLowerCase()===key);return e?String(e.value):'—';};
 const rawMode=data.network_mode||'',mode=chesterNetworkLabel({netMode:rawMode,networkType:rawMode}).replace('NR5G','5G')||rawMode||'Unknown';
 const carrier=make('div','ch-carrier');carrier.append(make('strong','',chesterCarrierName(data.carrier)||'Cellular'),make('span','ch-network-badge',mode));
 const metrics=make('div','ch-radio-grid');for(const [key,unit] of [['RSRP','dBm'],['RSRQ','dB'],['SINR','dB']]){const metric=make('div','ch-radio-metric'),val=value(key.toLowerCase());metric.append(make('span','',key),make('strong','',val==='—'?val:val+' '+unit));metrics.append(metric);}
 const rsrp=Number(value('rsrp')),quality=Number.isFinite(rsrp)?rsrp>=-90?'Excellent':rsrp>=-100?'Good':rsrp>=-110?'Fair':'Weak':'Unknown';const signal=make('div','ch-radio-metric ch-quality '+(/Excellent|Good/.test(quality)?'is-good':'is-fair'));signal.append(make('span','','Signal'),make('strong','',quality));metrics.append(signal);
 const bands=chesterCarriersFromEntries(entries,rawMode),section=make('section','ch-band-section');section.append(make('h4','','Connected Bands'));const grid=make('div','ch-band-grid');
 for(let i=0;i<Math.max(4,bands.length);i++){const c=bands[i]||{},column=make('section','ch-band-column');column.append(make('strong','ch-band-head',i?'SCC'+i:'PCC'));for(const [label,v] of [['Band',c.band],['ARFCN',c.arfcn],['PCI',c.pci],['BW',c.bw]]){const row=make('div','ch-band-row');row.append(make('span','',label),make('strong','',v||'—'));column.append(row);}grid.append(column);}section.append(grid);
 const bandLine=make('div','login-band-summary');bandLine.append(make('span','','Bands'));
 for(const band of bands){const chip=make('strong','',band.band||'—');bandLine.append(chip);}
 if(!bands.length)bandLine.append(make('strong','','—'));
 const details=make('details','login-cellular-details'),summary=make('summary','','Connection details');details.open=!!body.querySelector('details[open]');details.append(summary,section);
 body.replaceChildren(carrier,metrics,bandLine,details);
 age.textContent=data.age==null?'Last reported status':data.age<45?'Updated just now':'Last reported '+Math.max(1,Math.floor(data.age/60))+' min ago';
}
let busy=false;async function refresh(){if(busy||document.hidden)return;busy=true;try{const response=await fetch('/cgi-bin/chester-cellular',{cache:'no-store',credentials:'omit'});if(response.ok)render(await response.json());}catch(e){age.textContent='Waiting for cellular status…';}finally{busy=false;}}
refresh();window.setInterval(refresh,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();

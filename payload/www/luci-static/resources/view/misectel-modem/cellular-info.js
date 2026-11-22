'use strict';'require view';'require rpc';'require chester-ui.settings as settings';'require poll';'require dom';'require misectel.ui as misectel';'require misectel.modem as modemHelper';function chesterSplitCa(value){
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




function ciKey(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function ciDisplay(value,unit){
 const text=String(value==null?'':value).trim();if(!text||/^(-+|n\/a|unknown)$/i.test(text))return '—';
 if(!unit)return text;
 return text.split('/').map(v=>v.trim().replace(/\s*(dBm|dB|MHz)$/i,'')+' '+unit).join(' / ');
}
function ciReading(value){const text=value||'—',match=text.match(/\s(dBm|dB)$/);return [match?text.slice(0,-match[0].length):text,E('small',{'class':'ci-reading-unit'},[match?match[1]:''])];}
function ciRadioPanels(entries){
 const panels=[],byName={},common=[];let current='';
 for(const entry of entries||[]){
  const key=ciKey(entry.key),tag=String(entry.extra_info||entry.extraInfo||'').toUpperCase();
  if(key==='networkmode'||key==='networktype'){common.push(entry);continue;}
  const marker=/^(LTE|NR5G(?:[- _]?(?:SA|NSA))?|WCDMA|GSM)$/i.test(String(entry.key||''))&&String(entry.value||'')===String(entry.key||'');
  if(marker)current=/^NR/i.test(entry.key)?'5G':/^LTE/i.test(entry.key)?'LTE':String(entry.key);
  const name=/NR|5G/.test(tag)?'5G':/LTE/.test(tag)?'LTE':current;
  if(!name){common.push(entry);continue;}
  if(!byName[name]){byName[name]={name,entries:[],marker:''};panels.push(byName[name]);}
  if(marker)byName[name].marker=String(entry.value);else byName[name].entries.push(entry);
 }
 return {panels,common};
}
function ciFieldKey(entry){const k=ciKey(entry.key);return /^(earfcn|nrarfcn|arfcn)$/.test(k)?'channel':/^(physicalcellid|pci|pcid)$/.test(k)?'pci':k;}
function ciFieldLabel(key,entry,name){
 const names={channel:name==='LTE'?'Channel · EARFCN':'Channel · ARFCN',pci:'PCI',mcc:'MCC',mnc:'MNC',tac:'Tracking area · TAC',cellid:'Cell ID',band:'Band',ulbandwidth:'Upload bandwidth',dlbandwidth:'Download bandwidth',duplexmode:'Duplex mode',cqi:'CQI',txpower:'TX power',srxlev:'Receive level · Srxlev'};
 return names[key]||modemHelper.resolveEntryLabel(entry||{key});
}
function ciEntryValue(entry){
 const key=ciFieldKey(entry);return ciDisplay(modemHelper.resolveEntryValue(entry),/bandwidth/.test(key)?'MHz':key==='rsrp'||key==='rssi'?'dBm':key==='rsrq'||key==='sinr'?'dB':'');
}
function ciBars(value){
 const n=Number(String(value||'').split('/')[0].trim());const count=Number.isFinite(n)&&n<0?Math.max(0,Math.min(5,Math.ceil((n+125)/9))):0;
 return E('span',{'class':'ci-signal-bars','aria-hidden':'true'},Array.from({length:5},(_,i)=>E('i',{'class':i<count?'is-lit':'',style:'height:'+(8+i*4)+'px'})));
}
const callInterfaceDump=rpc.declare({object:'network.interface',method:'dump',expect:{interface:[]}});
const REFRESH_INTERVAL=5;
return view.extend({
 load(){misectel.ensureBaseStyle();return modemHelper.loadModems();},
 createSelector(modems){
  this.modems=modems||[];this.selectedModemId=modemHelper.ensureSelected(this.selectedModemId,this.modems);
  this.selectorNode=E('div');this.contentNode=E('div',{'class':'ci-content'});this.loadingNode=E('div',{'class':'misectel-loading'},['Reading cellular information…']);
  return settings.sheet([E('link',{rel:'stylesheet',href:L.resource('chester-ui/cellular-info.css')+'?v=20261122-2'}),settings.head('Cellular Info','Your connection, in detail.','network'),this.selectorNode,this.contentNode,this.loadingNode],'st-cellular-info');
 },
 renderSelector(){
  if(this.modems.length<=1){dom.content(this.selectorNode,[]);return;}
  const select=E('select',{},this.modems.map(m=>E('option',{value:m.id,selected:m.id===this.selectedModemId?'selected':null},[m.title||modemHelper.modemLabel(m)])));
  select.addEventListener('change',ev=>{this.selectedModemId=ev.currentTarget.value;if(this.latestSnapshot)this.updateView(this.latestSnapshot);});
  dom.content(this.selectorNode,[settings.card('Current modem',null,[settings.field('Select modem',select)],'router')]);
 },
 renderGroup(title,items){
  const rows=(items||[]).filter(item=>item&&item.label);if(!rows.length)return null;
  return settings.card(title,null,[E('dl',{'class':'ci-fields'},rows.map(item=>E('div',{'class':'ci-info-row'},[E('dt',{},[item.label==='Connection Status'?'Modem-reported connection':item.label]),E('dd',{'class':item.warning?'is-warning':''},[misectel.text(item.value)])])))],/SIM/i.test(title)?'port':/Network/i.test(title)?'network':'router');
 },
 async fetchSnapshot(){
  const modems=await modemHelper.loadModems(),interfaces=await L.resolveDefault(callInterfaceDump(),[]);
  return {modems:await Promise.all(modems.map(async m=>{
   const bundle=await modemHelper.fetchInfoBundle(m.id),groups=modemHelper.groupEntries(bundle);
   const entries=[bundle.baseInfo,bundle.simInfo,bundle.networkInfo,bundle.cellInfo,bundle.info].flatMap(x=>modemHelper.flattenEntries(x));
   const iface=interfaces.find(i=>i.interface===m.alias||i.interface===m.network),addressed=iface&&((iface['ipv4-address']||[]).length||(iface['ipv6-address']||[]).length);
   const connected=iface?iface.up===true&&!!addressed:String(bundle.connectStatus?.connection_status||'').toLowerCase()==='yes';
   const dialing=iface?iface.pending===true:String(bundle.dialStatus?.running||'').toLowerCase()==='true';
   return {id:m.id,title:modemHelper.modemLabel(m),network:modemHelper.findEntry(entries,['networktype','network_mode','network_type']),isp:modemHelper.findEntry(entries,['isp','operator']),cellEntries:modemHelper.flattenEntries(bundle.cellInfo),netMode:modemHelper.findEntry(entries,['network_mode']),connectState:connected?'Connected':dialing?'Dialing':'Disconnected',groups};
  }))};
 },
 renderRadioDetails(modem,rows,mode){
  const data=ciRadioPanels(modem.cellEntries),metricKeys=['rsrp','rsrq','sinr','rssi'];
  const keys=[],example={};
  for(const panel of data.panels)for(const entry of panel.entries){const key=ciFieldKey(entry);if(!metricKeys.includes(key)&&!keys.includes(key)){keys.push(key);example[key]=entry;}}
  const order=['mcc','mnc','tac','cellid','pci','channel','band','ulbandwidth','dlbandwidth','duplexmode','cqi','txpower','srxlev'];
  keys.sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi);});
  const panels=data.panels.map(panel=>{
   const values=key=>panel.entries.filter(e=>ciFieldKey(e)===key).map(ciEntryValue).join(' · ');
   const rsrp=panel.entries.find(e=>ciFieldKey(e)==='rsrp')?.value;
   return E('section',{'class':'ci-serving-panel'},[
    E('div',{'class':'ci-serving-head'},[E('div',{},[E('h4',{},[panel.name==='5G'?mode&&/^5G/.test(mode)?mode:'5G':panel.name]),E('span',{},[panel.marker||'Serving cell'])]),ciBars(rsrp)]),
    E('div',{'class':'ci-signal-grid'},metricKeys.map(key=>E('div',{'class':'ci-signal-metric'},[E('span',{},[key.toUpperCase()]),E('strong',{},ciReading(values(key)||'—'))]))),
    E('dl',{'class':'ci-cell-fields'},keys.map(key=>E('div',{},[E('dt',{},[ciFieldLabel(key,example[key],panel.name)]),E('dd',{},[values(key)||'—'])])))
   ]);
  });
  const used=new Set((modem.cellEntries||[]).map(e=>modemHelper.resolveEntryLabel(e)+'\0'+String(modemHelper.resolveEntryValue(e))));
  const additional=rows.filter(row=>!used.has(row.label+'\0'+String(row.value)));
  return settings.card('Cell Info','LTE and 5G readings, organized by radio.',[
   data.common.length?E('dl',{'class':'ci-common-fields'},data.common.map(e=>E('div',{},[E('dt',{},[modemHelper.resolveEntryLabel(e)]),E('dd',{},[ciEntryValue(e)])]))):'',
   E('div',{'class':'ci-serving-grid'},panels),
   additional.length?E('section',{'class':'ci-additional'},[E('h4',{},['Additional modem readings']),E('dl',{'class':'ci-cell-fields'},additional.map(row=>E('div',{},[E('dt',{},[row.label]),E('dd',{},[misectel.text(row.value)])])))]):'',
   E('p',{'class':'st-muted ci-footnote'},['Live readings refresh every 5 seconds. — means the modem did not report a value.'])
  ],'network');
 },
 updateView(snapshot){
  this.latestSnapshot=snapshot;this.modems=snapshot.modems||[];this.selectedModemId=modemHelper.ensureSelected(this.selectedModemId,this.modems);this.renderSelector();
  if(!this.modems.length){dom.content(this.contentNode,[misectel.createEmptyState('No modem detected')]);this.loadingNode.style.display='none';return;}
  const modem=this.modems.find(m=>m.id===this.selectedModemId),fields=modem.cellEntries||[];
  const get=key=>fields.find(e=>ciKey(e.key)===ciKey(key)&&/^NR/i.test(e.extra_info||''))?.value||modemHelper.findEntry(fields,[key]);
  const mode=chesterNetworkLabel({netMode:modem.netMode,networkType:modem.network}).replace('NR5G','5G')||modem.network;
  const bands=chesterCarriersFromEntries(fields,modem.netMode||modem.network);
  const radio=settings.card('Cellular',null,[
   E('div',{'class':'ci-carrier'},[E('strong',{},[chesterCarrierName(modem.isp)]),E('span',{'class':'ci-mode'},[mode]),E('span',{'class':'ci-state'+(modem.connectState==='Connected'?' is-connected':'')},[modem.connectState])]),
   E('div',{'class':'ci-summary-signals'},['RSRP','RSRQ','SINR'].map((key,i)=>E('div',{},[E('span',{},[key]),E('strong',{},ciReading(ciDisplay(get(key),i===0?'dBm':'dB')))]))),
   E('div',{'class':'ci-bands-title'},['Connected Bands']),
   E('div',{'class':'ci-carriers'},Array.from({length:Math.max(4,bands.length)},(_,i)=>{const b=bands[i]||{};return E('section',{'class':'ci-carrier-band'},[E('div',{'class':'ci-carrier-role'},[i?'SCC'+i:'PCC']),E('strong',{'class':'ci-band-number'},[b.band||'—']),E('dl',{},[['Channel',b.arfcn],['PCI',b.pci],['Bandwidth',b.bw]].map(([label,value])=>E('div',{},[E('dt',{},[label]),E('dd',{},[value||'—'])])))]);}))
  ],'network');
  const groupKeys=modemHelper.fieldGroups.concat(Object.keys(modem.groups||{}).filter(k=>!modemHelper.fieldGroups.includes(k)));
  const cellKeys=groupKeys.filter(k=>/^cell(info|information)$/.test(ciKey(k)));
  const rows=cellKeys.flatMap(k=>modem.groups[k]||[]);
  const sections=groupKeys.filter(k=>!cellKeys.includes(k)).map(k=>this.renderGroup(modemHelper.resolveGroupTitle(k),modem.groups[k])).filter(Boolean);
  dom.content(this.contentNode,[radio,this.renderRadioDetails(modem,rows,mode),E('div',{'class':'ci-groups'},sections)]);this.loadingNode.style.display='none';
 },
 render(modems){const shell=this.createSelector(modems);this.renderSelector();return this.fetchSnapshot().then(snapshot=>{this.updateView(snapshot);poll.add(()=>this.fetchSnapshot().then(next=>this.updateView(next)).catch(()=>{}),REFRESH_INTERVAL);return shell;}).catch(()=>{this.loadingNode.style.display='none';dom.content(this.contentNode,[misectel.createEmptyState('Failed to load cellular information','Please try again later.')]);return shell;});},
 handleSave:null,handleSaveApply:null,handleReset:null
});

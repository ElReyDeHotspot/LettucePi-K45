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



const callInterfaceDump=rpc.declare({object:'network.interface',method:'dump',expect:{interface:[]}});const REFRESH_INTERVAL=5;return view.extend({load(){misectel.ensureBaseStyle();return modemHelper.loadModems();},createSelector(modems){this.modems=modems||[];this.selectedModemId=modemHelper.ensureSelected(this.selectedModemId,this.modems);this.selectorNode=E('div');this.contentNode=E('div',{'class':'misectel-stack'});this.loadingNode=E('div',{'class':'misectel-loading'},[_('Reading cellular information...')]);return settings.sheet([settings.head('Cellular Info','Your connection, in detail.','network'),this.selectorNode,this.contentNode,this.loadingNode],'st-cellular-info');},renderSelector(){if(this.modems.length<=1){dom.content(this.selectorNode,[]);return;}
const select=E('select',{'class':'misectel-select'},this.modems.map((modem)=>E('option',{'value':modem.id,'selected':modem.id===this.selectedModemId?'selected':null},[modemHelper.modemLabel(modem)])));select.addEventListener('change',(ev)=>{this.selectedModemId=ev.currentTarget.value;if(this.latestSnapshot)
this.updateView(this.latestSnapshot);});dom.content(this.selectorNode,[misectel.createCard(_('Current Modem'),_('Switch between multiple modems here.'),[misectel.createField(_('Select Modem'),E('div',{'class':'misectel-select-wrap'},[select]))])]);},renderGroup(title,items){const rows=(Array.isArray(items)?items:[]).filter((item)=>item&&item.label);if(!rows.length)
return null;return settings.card(title,null,[E('dl',{'class':'ci-fields'},rows.flatMap(item=>[E('dt',{},[item.label==='Connection Status'?'Modem-reported connection':item.label]),E('dd',{'class':item.warning?'is-warning':''},[misectel.text(item.value)])]))]);},async fetchSnapshot(){const modems=await modemHelper.loadModems();const interfaces=await L.resolveDefault(callInterfaceDump(),[]);const list=await Promise.all(modems.map(async(modem)=>{const bundle=await modemHelper.fetchInfoBundle(modem.id);const groups=modemHelper.groupEntries(bundle);const entries=[].concat(modemHelper.flattenEntries(bundle.baseInfo)).concat(modemHelper.flattenEntries(bundle.simInfo)).concat(modemHelper.flattenEntries(bundle.networkInfo)).concat(modemHelper.flattenEntries(bundle.cellInfo)).concat(modemHelper.flattenEntries(bundle.info));const iface=interfaces.find(i=>i.interface===modem.alias||i.interface===modem.network);const addressed=iface&&((iface['ipv4-address']||[]).length||(iface['ipv6-address']||[]).length);const connected=iface?iface.up===true&&!!addressed:String(bundle.connectStatus?.connection_status||'').toLowerCase()==='yes';const dialing=iface?iface.pending===true:String(bundle.dialStatus?.running||'').toLowerCase()==='true';return{id:modem.id,title:modemHelper.modemLabel(modem),model:modemHelper.findEntry(entries,['name','model']),network:modemHelper.findEntry(entries,['networktype','network_mode','network_type']),imei:modemHelper.findEntry(entries,['imei']),iccid:modemHelper.findEntry(entries,['iccid']),isp:modemHelper.findEntry(entries,['isp','operator']),cellEntries:modemHelper.flattenEntries(bundle.cellInfo),netMode:modemHelper.findEntry(entries,['network_mode']),connectState:connected?_('Connected'):dialing?_('Dialing'):_('Disconnected'),groups};}));return{modems:list};},updateView(snapshot){this.latestSnapshot=snapshot;this.modems=snapshot.modems||[];this.selectedModemId=modemHelper.ensureSelected(this.selectedModemId,this.modems);this.renderSelector();if(!this.modems.length){dom.content(this.contentNode,[misectel.createEmptyState(_('No modem detected'))]);this.loadingNode.style.display='none';return;}
const modem=this.modems.find((item)=>item.id===this.selectedModemId);const groupKeys=modemHelper.fieldGroups.concat(Object.keys(modem.groups||{}).filter((key)=>modemHelper.fieldGroups.indexOf(key)===-1));const sections=groupKeys.map((key)=>this.renderGroup(modemHelper.resolveGroupTitle(key),modem.groups[key])).filter(Boolean);const fields=modem.cellEntries||[],get=key=>fields.find(e=>String(e.key).toLowerCase()===key.toLowerCase()&&/^NR/i.test(e.extra_info||''))?.value||modemHelper.findEntry(fields,[key]);const mode=chesterNetworkLabel({netMode:modem.netMode,networkType:modem.network}).replace('NR5G','5G')||modem.network;
 const bands=chesterCarriersFromEntries(fields,modem.netMode||modem.network);const radio=E('div',{'class':'chester-home ci-radio'},[E('link',{rel:'stylesheet',href:L.resource('chester-ui/overview.css')+'?v=a7bd0b071507'}),E('section',{'class':'ch-card'},[E('h3',{},['Cellular']),E('div',{'class':'ch-carrier'},[E('strong',{},[chesterCarrierName(modem.isp)]),E('span',{'class':'ch-network-badge'},[mode])]),E('div',{'class':'ch-radio-grid'},['RSRP','RSRQ','SINR'].map((key,i)=>E('div',{'class':'ch-radio-metric'},[E('span',{},[key]),E('strong',{},[get(key)+(i===0?' dBm':' dB')])])).concat([E('div',{'class':'ch-radio-metric'},[E('span',{},['Connection']),E('strong',{},[modem.connectState])])])),E('section',{'class':'ch-band-section'},[E('h4',{},['Connected Bands']),E('div',{'class':'ch-band-grid'},Array.from({length:Math.max(4,bands.length)},(_,i)=>{const c=bands[i]||{};return E('section',{'class':'ch-band-column'},[E('strong',{'class':'ch-band-head'},[i?'SCC'+i:'PCC']),...[['Band',c.band],['ARFCN',c.arfcn],['PCI',c.pci],['BW',c.bw]].map(([label,value])=>E('div',{'class':'ch-band-row'},[E('span',{},[label]),E('strong',{},[value||'—'])]))]);}))])])]);
 dom.content(this.contentNode,[radio,E('div',{'class':'ci-groups'},sections)]);this.loadingNode.style.display='none';},render(modems){const shell=this.createSelector(modems);this.renderSelector();return this.fetchSnapshot().then((snapshot)=>{this.updateView(snapshot);poll.add(()=>this.fetchSnapshot().then((nextSnapshot)=>this.updateView(nextSnapshot)).catch(()=>{}),REFRESH_INTERVAL);return shell;}).catch(()=>{this.loadingNode.style.display='none';dom.content(this.contentNode,[misectel.createEmptyState(_('Failed to load cellular information'),_('Please try again later.'))]);return shell;});},handleSave:null,handleSaveApply:null,handleReset:null});
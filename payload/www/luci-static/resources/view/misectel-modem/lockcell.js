'use strict';'require view';'require chester-ui.settings as settings';'require chester-ui.live-cellular as liveCellular';'require ui';'require dom';'require misectel.ui as misectel';'require misectel.modem as modemHelper';function buildSelect(current,modems){return E('select',{'class':'misectel-select'},(modems||[]).map((modem)=>E('option',{'value':modem.id,'selected':modem.id===current?'selected':null},[modemHelper.modemLabel(modem)])));}
function buildChoiceSelect(current,choices){return E('select',{'class':'misectel-select'},(choices||[]).map((choice)=>E('option',{'value':choice.value,'selected':choice.value===current?'selected':null},[choice.label])));}
function hasStatusValue(value){return value!=null&&value!==''&&value!=='unlock'&&value!=='--';}
function isLockedValue(value){const normalized=String(value||'').toLowerCase();return normalized.indexOf('lock')!==-1&&normalized.indexOf('unlock')===-1;}
function statusText(value){if(isLockedValue(value))
return _('Locked');return _('Unlocked');}
function isEnabledValue(value){const normalized=String(value||'').toLowerCase();return value===true||value===1||normalized==='1'||normalized==='true'||normalized==='yes'||normalized==='on';}
function normalizeBootHookStatus(neighborInfo){const hook=neighborInfo?.neighborcell?.lockcell_boot_hook||neighborInfo?.lockcell_boot_hook||{};if(!L.isObject(hook))
return{enabled:false,delay:''};return{enabled:isEnabledValue(hook.enabled),delay:hasStatusValue(hook.delay)?hook.delay:'15'};}
function addDetail(details,label,value){if(!hasStatusValue(value))
return;details.push({label,value});}
function normalizeLockStatus(neighborInfo){const status=neighborInfo?.neighborcell?.lockcell_status||neighborInfo?.lockcell_status||{};const locks=[];if(!L.isObject(status))
return locks;['LTE','NR'].forEach((rat)=>{if(!isLockedValue(status[rat]))
return;const details=[];addDetail(details,_('ARFCN'),status[`${rat}_Freq`]||status[`${rat}_ARFCN`]);addDetail(details,_('PCI'),status[`${rat}_PCI`]);addDetail(details,_('SCS'),status[`${rat}_SCS`]);addDetail(details,_('Band'),status[`${rat}_Band`]||status[`${rat}_BAND`]);locks.push({rat,status:status[rat],details});});if(locks.length)
return locks;if(!isLockedValue(status.lockcell_status)&&!isLockedValue(status.Status))
return locks;const rat=hasStatusValue(status.Rat)?status.Rat:_('LTE');const details=[];addDetail(details,_('Lock Type'),status['Lock Type']);addDetail(details,_('ARFCN'),status.arfcn||status.ARFCN);addDetail(details,_('PCI'),status.pci||status.PCI);addDetail(details,_('SCS'),status.scs||status.SCS);addDetail(details,_('Band'),status.band||status['NR BAND']);locks.push({rat,status:status.lockcell_status||status.Status,details});return locks;}
return view.extend({load(){misectel.ensureBaseStyle();return modemHelper.loadModems();},renderSelector(){if(this.modems.length<=1){dom.content(this.selectorNode,[]);return;}
const select=buildSelect(this.selectedModemId,this.modems);select.addEventListener('change',(ev)=>{this.selectedModemId=ev.currentTarget.value;this.refresh();this.liveCellular.refresh();});dom.content(this.selectorNode,[misectel.createCard(_('Current Modem'),null,[misectel.createField(_('Select Modem'),E('div',{'class':'misectel-select-wrap'},[select]))])]);},createShell(){this.selectorNode=E('div');this.bodyNode=E('div');this.liveCellular=liveCellular.create(()=>this.modems.find(m=>m.id===this.selectedModemId));return settings.sheet([settings.head('Cell Lock','Choose a specific cell for your cellular connection.','network'),this.selectorNode,this.liveCellular.node,this.bodyNode],'st-celllock');},
updateRatFields(){if(!this.form)return;const nr=this.form.ratSelect.value==='1';this.form.bandField.hidden=!nr;this.form.scsField.hidden=!nr;dom.content(this.form.applyButton,[nr?'Apply 5G lock':'Apply LTE lock']);},
createFormCard(modem){
 const locks=normalizeLockStatus(this.lastLockStatus),nr=locks.find(l=>l.rat==='NR'),detail=label=>nr?.details.find(d=>d.label===label)?.value||'';
 const ratSelect=buildChoiceSelect('1',[{value:'1',label:'5G'},{value:'0',label:'4G LTE'}]);
 const numeric=(value,placeholder)=>E('input',{type:'text',inputmode:'numeric',value:String(value).replace(/^[NB]/i,''),placeholder,autocomplete:'off'});
 const pciInput=numeric(detail('PCI'),'For example, 120'),arfcnInput=numeric(detail('ARFCN'),'For example, 507870'),bandInput=numeric(detail('Band'),'For example, 41');
 const scs=String(detail('SCS')),scsSelect=buildChoiceSelect(/^(1|30|30khz)$/i.test(scs)?'1':'0',[{value:'0',label:'15 kHz'},{value:'1',label:'30 kHz'}]);
 const bootHookInput=E('input',{type:'checkbox',checked:normalizeBootHookStatus(this.lastLockStatus).enabled?'checked':null});
 const bandField=settings.field('5G band number',bandInput,'Enter the number without N, for example 41.'),scsField=settings.field('Subcarrier spacing (SCS)',scsSelect);
 const applyButton=settings.button('Apply 5G lock',ui.createHandlerFn(this,ev=>this.applyLock(ev.currentTarget))),unlockButton=settings.button('Remove cell locks',ui.createHandlerFn(this,ev=>this.unlockCell(ev.currentTarget)),{'class':'st-button secondary'});
 this.form={modemId:modem.id,ratSelect,pciInput,arfcnInput,bandInput,scsSelect,bootHookInput,bandField,scsField,applyButton};ratSelect.addEventListener('change',()=>this.updateRatFields());
 const card=settings.card('Lock to a cell','Enter the cell parameters you want the modem to use. Nothing changes until you apply.',[
 E('div',{'class':'st-fields'},[settings.field('Connection type',ratSelect),settings.field('Physical Cell ID (PCI)',pciInput),settings.field('Frequency channel (ARFCN)',arfcnInput),bandField,scsField]),
 E('details',{'class':'cl-advanced'},[E('summary',{},['After a reboot']),settings.toggle('Reapply this lock after reboot',bootHookInput,'Use only when you want this cell selection to persist.')]),
 E('div',{'class':'st-footer cl-actions'},[E('span',{'class':'st-muted'},['Applying or removing a lock may briefly reconnect cellular data.']),E('div',{'class':'cl-buttons'},[unlockButton,applyButton])])
 ],'network');this.updateRatFields();return card;
},
createStatusCard(info){
 const locks=normalizeLockStatus(info),status=info?.neighborcell?.lockcell_status||info?.lockcell_status;
 return settings.card('Current cell locks','Live status reported by the modem. 5G is shown first.',[
 E('div',{'class':'cl-status-grid'},['NR','LTE'].map(rat=>{const lock=locks.find(l=>l.rat===rat);return E('section',{'class':'cl-status'},[
 E('div',{'class':'cl-status-head'},[E('strong',{},[rat==='NR'?'5G':'4G LTE']),E('span',{'class':'cl-pill '+(lock?'is-locked':'')},[!status?'Unavailable':lock?'Locked':'Unlocked'])]),
 lock?E('dl',{'class':'ci-fields'},lock.details.flatMap(d=>[E('dt',{},[d.label]),E('dd',{},[d.value])])):E('p',{'class':'st-muted'},[!status?'The modem has not reported its lock status.':'The modem is free to choose a cell.'])
 ]);}))
 ],'shield');
},buildPayload(){if(!this.form)
return null;const rat=this.form.ratSelect.value==='1'?'1':'0';const pci=this.form.pciInput.value.trim();const arfcn=this.form.arfcnInput.value.trim();const band=this.form.bandInput.value.trim();if(!pci||!arfcn){misectel.notify(_('PCI and ARFCN are required'),'error');return null;}
if(rat==='1'&&!band){misectel.notify(_('Band is required for 5G'),'error');return null;}
if(!/^\d+$/.test(pci)||!/^\d+$/.test(arfcn)||(rat==='1'&&!/^\d+$/.test(band))){misectel.notify(_('Enter PCI, ARFCN and band as numbers only'),'error');return null;}
return{rat:rat,pci:pci,arfcn:arfcn,band:rat==='1'?band:'',scs:rat==='1'?this.form.scsSelect.value:'0',en_boot_hook:this.form.bootHookInput.checked?'1':'0'};},async applyLock(button){const payload=this.buildPayload();if(!payload)
return;misectel.setButtonBusy(button,true);try{const result=await modemHelper.setNeighborCell(this.form.modemId,payload);if(result?.error||result?.result===false||/ERROR/i.test(result?.result?.setlockcell||''))throw new Error('The modem rejected the cell lock.');await this.refresh();const rat=payload.rat==='1'?'NR':'LTE';const confirmed=normalizeLockStatus(this.lastLockStatus).find(lock=>lock.rat===rat);if(!confirmed)throw new Error('The modem did not confirm the selected cell lock.');for(const [label,expected]of [['PCI',payload.pci],['ARFCN',payload.arfcn],['Band',payload.band]]){const actual=confirmed.details.find(d=>d.label===label)?.value;if(expected&&actual!=null&&String(actual).replace(/^[NB]/i,'')!==String(expected))throw new Error('The modem reported different cell parameters.');}misectel.notify(_('Cell lock saved and confirmed by the modem'),'info');}
catch(err){misectel.notify(_('Failed to apply cell lock configuration: %s').format(err.message||err),'error');}
finally{misectel.setButtonBusy(button,false);}},async unlockCell(button){if(!this.form)
return;misectel.setButtonBusy(button,true);try{const result=await modemHelper.setNeighborCell(this.form.modemId,{rat:'0',pci:'',arfcn:'',band:'',scs:'',en_boot_hook:'0'});if(result?.error||result?.result===false||/ERROR/i.test(result?.result?.setlockcell||''))throw new Error('The modem did not confirm unlocking.');await this.refresh();if(!this.lastLockStatus?.neighborcell?.lockcell_status&&!this.lastLockStatus?.lockcell_status)throw new Error('The modem did not report its updated lock status.');if(normalizeLockStatus(this.lastLockStatus).length)throw new Error('The modem still reports an active cell lock.');misectel.notify(_('Cell locks released and confirmed by the modem'),'info');}
catch(err){misectel.notify(_('Failed to unlock cell: %s').format(err.message||err),'error');}
finally{misectel.setButtonBusy(button,false);}},async refresh(){this.lastLockStatus=null;const modem=this.modems.find((item)=>item.id===this.selectedModemId);if(!modem){dom.content(this.bodyNode,[misectel.createEmptyState(_('No configurable modem detected'))]);return;}
dom.content(this.bodyNode,[E('div',{'class':'misectel-loading'},[_('Reading cell lock status...')])]);try{const disabled=await modemHelper.getDisabledFeatures(modem.id);const disabledFeatures=disabled.disabled_features||[];if(disabledFeatures.indexOf('NeighborCell')!==-1){dom.content(this.bodyNode,[misectel.createEmptyState(_('Cell locking is not supported by the current modem'))]);return;}
const lockStatus=await modemHelper.getNeighborCell(modem.id);this.lastLockStatus=lockStatus;dom.content(this.bodyNode,[this.createStatusCard(lockStatus),this.createFormCard(modem)]);}
catch(err){dom.content(this.bodyNode,[misectel.createEmptyState(_('Failed to load cell lock controls'),err.message||err)]);}},render(modems){this.modems=modems||[];this.selectedModemId=modemHelper.ensureSelected(this.selectedModemId,this.modems);const shell=this.createShell();this.renderSelector();this.refresh();return shell;},handleSave:null,handleSaveApply:null,handleReset:null});
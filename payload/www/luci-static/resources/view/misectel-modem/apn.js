'use strict';'require view';'require chester-ui.settings as settings';'require ui';'require uci';'require dom';'require rpc';'require misectel.ui as misectel';'require misectel.modem as modemHelper';const PAGE_SIZE=8;const AUTH_CHOICES=[{value:'none',label:_('No Authentication')},{value:'MsChapV2',label:'MsChapV2'},{value:'pap',label:_('PAP')},{value:'chap',label:_('CHAP')},{value:'both',label:_('PAP / CHAP')}];const PDP_CHOICES=[{value:'ip',label:_('IPv4')},{value:'ipv6',label:_('IPv6')},{value:'ipv4v6',label:_('IPv4 / IPv6')},{value:'ethernet',label:_('Ethernet')}];const callApnPresetsGet=rpc.declare({object:'misectel',method:'apn_presets_get',expect:{}});const callApnPresetsSave=rpc.declare({object:'misectel',method:'apn_presets_save',params:['presets'],expect:{}});const callApnPresetsReset=rpc.declare({object:'misectel',method:'apn_presets_reset',expect:{}});function textValue(value){return value==null?'':String(value);}
function normalizeAuth(value){return textValue(value)||'none';}
function normalizePdp(value){return textValue(value)||'ipv4v6';}
function sameConfig(left,right){return textValue(left.apn)===textValue(right.apn)&&normalizeAuth(left.auth)===normalizeAuth(right.auth)&&textValue(left.username)===textValue(right.username)&&textValue(left.password)===textValue(right.password);}
function findPresetIndexForConfig(presets,config){return(presets||[]).findIndex((preset)=>sameConfig(preset,config));}
function isEmptyConfig(config){return!textValue(config.apn)&&!textValue(config.username)&&!textValue(config.password)&&!textValue(config.auth);}
function normalizePreset(preset,indexValue){const operator=textValue(preset?.operator).trim()||`apn${indexValue + 1}`;let id=textValue(preset?.id).trim()||operator.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');if(!id)
id=`apn-${indexValue + 1}`;return{id,operator,apn:textValue(preset?.apn).trim(),auth:normalizeAuth(preset?.auth),username:textValue(preset?.username).trim(),password:textValue(preset?.password)};}
function configFromSection(modem,slot){if(slot==='2'){return{apn:uci.get('qmodem',modem.id,'apn2')||'',auth:uci.get('qmodem',modem.id,'auth2')||'',username:uci.get('qmodem',modem.id,'username2')||'',password:uci.get('qmodem',modem.id,'password2')||''};}
return{apn:uci.get('qmodem',modem.id,'apn')||'',auth:uci.get('qmodem',modem.id,'auth')||'',username:uci.get('qmodem',modem.id,'username')||'',password:uci.get('qmodem',modem.id,'password')||''};}
function nextUserConfigName(presets){const used={};(presets||[]).forEach((preset)=>{const match=textValue(preset.operator).match(/^userconfig-(\d+)$/i);if(match)
used[parseInt(match[1],10)]=true;});for(let i=1;i<10000;i++){if(!used[i])
return`userconfig-${i}`;}
return`userconfig-${(presets || []).length + 1}`;}
function syncPresetsWithModems(presets,modems){let changed=false;const result=(presets||[]).map((preset,indexValue)=>normalizePreset(preset,indexValue));(modems||[]).forEach((modem)=>{[configFromSection(modem,'1'),configFromSection(modem,'2')].forEach((config)=>{if(findPresetIndexForConfig(result,config)>=0)
return;if(isEmptyConfig(config)){result.push(normalizePreset({id:'empty-apn',operator:_('Empty APN'),apn:'',auth:'none',username:'',password:''},result.length));changed=true;return;}
const name=nextUserConfigName(result);result.push(normalizePreset(Object.assign({},config,{id:name,operator:name}),result.length));changed=true;});});return{presets:result,changed};}
function buildSelect(currentValue,choices){return E('select',{'class':'misectel-select'},(choices||[]).map((choice)=>E('option',{'value':choice.value,'selected':choice.value===currentValue?'selected':null},[choice.label])));}
function tableCell(label,content){const children=Array.isArray(content)?content:[content];return E('td',{'data-title':label},children.filter((item)=>item!=null&&item!==false).map((item)=>item==null?'':item));}
function rowKey(row){return`preset:${row.index}`;}
return view.extend({async load(){misectel.ensureBaseStyle();const [,presetData]=await Promise.all([uci.load(['qmodem','misectel']),callApnPresetsGet()]);if(presetData?.result===false||!Array.isArray(presetData?.presets))throw new Error('Could not load the carrier preset library. Refresh and try again.');const modems=modemHelper.getModemSections();const synced=syncPresetsWithModems(presetData.presets,modems);if(synced.changed)presetData.presets=synced.presets;
return{modems,presetData};},getCurrentModem(){return this.modems.find((item)=>item.id===this.selectedModemId)||null;},setPresetData(data){this.country=data?.country||'unknown';this.presets=misectel.ensureArray(data?.presets).map((preset,indexValue)=>normalizePreset(preset,indexValue));},applySavedPresetData(data,fallbackPresets){if(data?.result===false)
throw new Error(data.message||_('Failed to save APN presets'));if(Array.isArray(data?.presets)){this.setPresetData(data);return;}
this.presets=misectel.ensureArray(fallbackPresets).map((preset,indexValue)=>normalizePreset(preset,indexValue));if(data?.country)
this.country=data.country;},getActiveLabel(modem,preset){const sim1=configFromSection(modem,'1');const sim2=configFromSection(modem,'2');const labels=[];if(isEmptyConfig(sim2)||sameConfig(sim1,sim2))
return sameConfig(preset,sim1)?_('SIM1/2'):'';if(sameConfig(preset,sim1))
labels.push(_('SIM1'));if(sameConfig(preset,sim2))
labels.push(_('SIM2'));return labels.join(', ');},nextPresetName(){const used={};this.presets.forEach((preset)=>{const match=preset.operator.match(/^apn(\d+)$/i);if(match)
used[parseInt(match[1],10)]=true;});for(let i=1;i<10000;i++){if(!used[i])
return`apn${i}`;}
return`apn${this.presets.length + 1}`;},makePresetId(operator){let base=textValue(operator).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'apn';let candidate=base;let suffix=1;const used={};this.presets.forEach((preset)=>{used[preset.id]=true;});while(used[candidate]){suffix++;candidate=`${base}-${suffix}`;}
return candidate;},ensurePresetForConfig(config){const draft=normalizePreset(Object.assign({},config,{operator:textValue(config.operator).trim()||nextUserConfigName(this.presets)}),this.presets.length);const idIndex=this.presets.findIndex((preset)=>preset.id&&preset.id===draft.id);const sameIndex=this.presets.findIndex((preset)=>sameConfig(preset,draft));if(idIndex>=0){this.presets[idIndex]=normalizePreset(Object.assign({},draft,{id:this.presets[idIndex].id}),idIndex);return;}
if(sameIndex>=0)
return;draft.id=this.makePresetId(draft.operator);this.presets.push(draft);},writeConfigToUci(modemId,target,config){const slots=target==='both'?['1','2']:[target];slots.forEach((slot)=>{const suffix=slot==='2'?'2':'';uci.set('qmodem',modemId,`apn${suffix}`,textValue(config.apn).trim());uci.set('qmodem',modemId,`auth${suffix}`,normalizeAuth(config.auth));if(normalizeAuth(config.auth)==='none'){uci.unset('qmodem',modemId,`username${suffix}`);uci.unset('qmodem',modemId,`password${suffix}`);}
else{uci.set('qmodem',modemId,`username${suffix}`,textValue(config.username).trim());uci.set('qmodem',modemId,`password${suffix}`,textValue(config.password));}});},async applyPdpType(value,button){const modem=this.getCurrentModem();if(!modem||!this.beginApnOperation(button))
return;try{await uci.load('qmodem');uci.set('qmodem',modem.id,'pdp_type',normalizePdp(value));await this.commitAndRestartDial(uci,_('PDP Type saved. Dial service restarted.'));}
catch(err){this.reportOperationFailure(err);}
finally{this.endApnOperation(button);}},renderPdpTypeCard(){const modem=this.getCurrentModem();if(!modem)
return misectel.createCard(_('PDP Type'),null,[misectel.createEmptyState(_('No configurable modem detected'))]);const pdpSelect=buildSelect(normalizePdp(uci.get('qmodem',modem.id,'pdp_type')),PDP_CHOICES);return misectel.createCard(_('PDP Type'),_('SIM1 and SIM2 share this setting.'),[E('div',{'class':'misectel-form-grid'},[misectel.createField(_('PDP Type'),E('div',{'class':'misectel-select-wrap'},[pdpSelect]))]),E('div',{'class':'misectel-card__footer','style':'justify-content:flex-start;gap:12px;flex-wrap:wrap'},[misectel.createButton(_('Save PDP Type'),'misectel-button',ui.createHandlerFn(this,function(ev){return this.applyPdpType(pdpSelect.value,ev.currentTarget);}))])]);},beginApnOperation(button){if(this.apnOperationBusy)
return false;this.apnOperationBusy=true;misectel.setButtonBusy(button,true);this.operationPhase='prepare';this.operationCommitted=false;return true;},endApnOperation(button){this.apnOperationBusy=false;misectel.setButtonBusy(button,false);},reportOperationFailure(err){const message=err&&err.message?err.message:err;if(this.operationPhase==='presets')
misectel.notify(_('Failed to save APN presets: %s').format(message),'error');else if(this.operationCommitted)
misectel.notify(_('The settings were saved, but the dial service did not confirm: %s').format(message),'warning');else
misectel.notify(_('The request did not complete; the save result is unconfirmed: %s').format(message),'error');},async commitAndRestartDial(uci,successMessage){this.operationPhase='apply';await misectel.saveAndApplyUnchecked(uci);this.operationCommitted=true;this.operationPhase='dial';await modemHelper.restartDialService();misectel.notify(successMessage,'info');window.setTimeout(()=>window.location.reload(),300);},async applyConfig(target,config,button){if(config.apn&&(!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(config.apn)||config.apn.length>100)){misectel.notify('Enter a valid APN using letters, numbers, dots or hyphens.','warning');return;}const modem=this.getCurrentModem();if(!modem||!this.beginApnOperation(button))
return;try{await uci.load('qmodem');this.writeConfigToUci(modem.id,target,config);if(config.pdp)uci.set('qmodem',modem.id,'pdp_type',normalizePdp(config.pdp));this.ensurePresetForConfig(config);this.operationPhase='presets';const presetResult=await callApnPresetsSave(this.presets);if(presetResult?.result===false)
throw new Error(presetResult.message||_('Failed to save APN presets'));await this.commitAndRestartDial(uci,_('APN settings saved. Dial service restarted.'));}
catch(err){this.reportOperationFailure(err);}
finally{this.endApnOperation(button);}},async persistPresets(next){
 const result=await callApnPresetsSave(next);this.applySavedPresetData(result,next);this.libraryStatus.classList.remove('is-error');this.renderTable();
 if(this.carrierPresetSelect){const target=this.apnTarget||'1';dom.content(this.carrierPresetSelect,[E('option',{value:'custom',selected:true},['Custom / current settings']),...this.presets.map((p,i)=>E('option',{value:String(i)},[(p.operator==='Empty APN'?(target==='2'?'Use SIM 1 profile':'Automatic'):p.operator)+' — '+(p.apn||'Carrier default')]))]);}
 if(this.simSummary)dom.content(this.simSummary,[this.renderSavedSIMs()]);
},
openPresetModal(index){
 if(this.libraryBusy)return;const current=index==null?{operator:'',apn:'',auth:'none',username:'',password:''}:this.presets[index];
 const name=E('input',{type:'text',value:current.operator==='Empty APN'?'Automatic':current.operator,maxlength:'64',autocomplete:'off'}),apn=E('input',{type:'text',value:current.apn,maxlength:'100',placeholder:'Carrier APN',autocomplete:'off',spellcheck:'false'}),auth=buildSelect(normalizeAuth(current.auth),AUTH_CHOICES),username=E('input',{type:'text',value:current.username,autocomplete:'off'}),password=E('input',{type:'password',value:current.password,autocomplete:'new-password'});
 const credentials=E('div',{'class':'st-fields'},[settings.field('Preset username',username),settings.field('Preset password',password)]),message=E('p',{'class':'ap-library-result',role:'status'});
 const sync=()=>{credentials.hidden=auth.value==='none';username.disabled=password.disabled=auth.value==='none';};auth.addEventListener('change',sync);sync();
 const cancel=settings.button('Cancel',()=>{if(!this.libraryBusy)dom.content(this.libraryEditor,[]);},{'class':'st-button secondary'});
 const save=settings.button('Save preset',async()=>{
  if(this.libraryBusy)return;if(!name.value.trim()){message.textContent='Enter a carrier or plan name.';name.focus();return;}
  if(apn.value.trim()&&!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(apn.value.trim())){message.textContent='Use letters, numbers, dots or hyphens for the APN.';apn.focus();return;}
  this.libraryBusy=true;save.disabled=cancel.disabled=true;message.textContent='Saving preset…';
  try{const next=this.presets.slice(),value=normalizePreset({id:index==null?this.makePresetId(name.value.trim()):current.id,operator:name.value.trim(),apn:apn.value.trim(),auth:auth.value,username:auth.value==='none'?'':username.value.trim(),password:auth.value==='none'?'':password.value},index??next.length);if(index==null)next.push(value);else next[index]=value;await this.persistPresets(next);dom.content(this.libraryEditor,[]);this.libraryStatus.textContent='Preset saved. Select it above to use it on a SIM.';}
  catch(error){message.textContent=error.message||'Could not save this preset.';message.classList.add('is-error');}
  finally{this.libraryBusy=false;save.disabled=cancel.disabled=false;}
 });
 dom.content(this.libraryEditor,[E('section',{'class':'ap-preset-editor'},[E('h4',{},[index==null?'Add carrier preset':'Edit carrier preset']),E('p',{'class':'st-muted'},['This changes your saved library. Your SIM connection stays as configured.']),E('div',{'class':'st-fields'},[settings.field('Carrier / plan name',name),settings.field('Preset APN',apn,'Blank uses the carrier default, or the SIM 1 profile when applied to SIM 2.')]),settings.field('Preset authentication',auth),credentials,message,E('div',{'class':'ap-editor-actions'},[cancel,save])])]);
 name.focus();
},
async removePreset(index,button){
 if(this.libraryBusy)return;this.libraryBusy=true;button.disabled=true;
 try{const next=this.presets.filter((_,i)=>i!==index);await this.persistPresets(next);dom.content(this.libraryEditor,[]);this.libraryStatus.textContent='Preset removed. Saved SIM settings were not changed.';}
 catch(error){this.libraryStatus.textContent=error.message||'Could not delete this preset.';this.libraryStatus.classList.add('is-error');}
 finally{this.libraryBusy=false;button.disabled=false;}
},
async resetPresets(button){
 if(this.libraryBusy)return;this.libraryBusy=true;button.disabled=true;
 try{const result=await callApnPresetsReset();if(result?.result===false)throw new Error(result.message||'Could not restore presets.');this.setPresetData(result);this.libraryStatus.classList.remove('is-error');this.renderTable();dom.content(this.libraryEditor,[]);if(this.carrierPresetSelect)this.refreshPresetPicker();this.libraryStatus.textContent='Default carrier presets restored. Saved SIM settings were not changed.';}
 catch(error){this.libraryStatus.textContent=error.message||'Could not restore presets.';this.libraryStatus.classList.add('is-error');}
 finally{this.libraryBusy=false;button.disabled=false;}
},
refreshPresetPicker(){const target=this.apnTarget||'1';dom.content(this.carrierPresetSelect,[E('option',{value:'custom',selected:true},['Custom / current settings']),...this.presets.map((p,i)=>E('option',{value:String(i)},[(p.operator==='Empty APN'?(target==='2'?'Use SIM 1 profile':'Automatic'):p.operator)+' — '+(p.apn||'Carrier default')]))]);},
renderTable(){
 if(!this.libraryRows){
  this.libraryEditor=E('div');this.libraryRows=E('div',{'class':'ap-preset-list'});this.libraryStatus=E('p',{'class':'ap-library-result',role:'status','aria-live':'polite'});this.libraryCount=E('span',{'class':'ap-library-count'});
  const search=E('input',{type:'search',placeholder:'Find a carrier or APN','aria-label':'Search carrier presets'});search.addEventListener('input',()=>{this.libraryQuery=search.value;this.renderTable();});
  const restoreBox=E('div',{'class':'ap-restore-confirm',hidden:true}),restore=settings.button('Restore defaults',()=>{if(this.libraryBusy)return;restoreBox.hidden=!restoreBox.hidden;},{'class':'st-button secondary'});
  dom.content(restoreBox,[E('p',{},['Replace your saved preset library with the default carrier list? SIM settings stay unchanged.']),E('div',{'class':'ap-editor-actions'},[settings.button('Keep my presets',()=>{restoreBox.hidden=true;},{'class':'st-button secondary'}),settings.button('Restore preset library',async ev=>{await this.resetPresets(ev.currentTarget);restoreBox.hidden=true;})])]);
  dom.content(this.tableNode,[E('div',{'class':'ap-library-toolbar'},[search,settings.button('Add preset',()=>this.openPresetModal(null))]),this.libraryEditor,this.libraryStatus,this.libraryCount,this.libraryRows,E('div',{'class':'ap-library-bottom'},[E('small',{},['Choose a preset in the SIM editor above, then Apply to connect.']),restore]),restoreBox]);
 }
 const query=(this.libraryQuery||'').trim().toLowerCase(),modem=this.getCurrentModem();let shown=0;
 const rows=this.presets.map((preset,index)=>({preset,index})).filter(({preset})=>!query||(preset.operator+' '+preset.apn).toLowerCase().includes(query)).map(({preset,index})=>{
  shown++;const label=preset.operator==='Empty APN'?'Automatic':preset.operator,used=modem?this.getActiveLabel(modem,preset):'';
  const actions=E('div',{'class':'ap-preset-actions'}),edit=settings.button('Edit',()=>this.openPresetModal(index),{'class':'st-button secondary','aria-label':'Edit '+label}),remove=settings.button('Delete',()=>{
   if(this.libraryBusy)return;dom.content(actions,[settings.button('Keep',()=>this.renderTable(),{'class':'st-button secondary'}),settings.button('Confirm delete',ev=>this.removePreset(index,ev.currentTarget),{'class':'st-button ap-delete'})]);
  },{'class':'st-button secondary ap-delete','aria-label':'Delete '+label});dom.content(actions,[edit,remove]);
  return E('article',{'class':'ap-preset-row'},[E('span',{'class':'ap-preset-icon','aria-hidden':'true'},[settings.icon('network')]),E('div',{'class':'ap-preset-identity'},[E('strong',{},[label]),E('span',{'class':'ap-preset-apn'},[preset.apn||'Carrier default / SIM 1 fallback']),E('small',{},[normalizeAuth(preset.auth)==='none'?'No authentication':normalizeAuth(preset.auth)+' authentication'])]),used?E('span',{'class':'ap-preset-used'},['Saved · '+used.replaceAll('SIM1','SIM 1').replaceAll('SIM2','SIM 2')]):E('span',{'class':'ap-preset-used is-unused'},['Available']),actions]);
 });
 this.libraryCount.textContent=shown+' of '+this.presets.length+' presets';dom.content(this.libraryRows,rows.length?rows:[E('p',{'class':'st-muted ap-no-presets'},['No carrier presets match your search.'])]);
},renderQuickEditor(){
 const modem=this.getCurrentModem();if(!modem)return settings.card('APN settings','',[E('p',{'class':'st-muted'},['No configurable modem detected.'])]);
 const target=this.apnTarget||'1',config=configFromSection(modem,target==='2'?'2':'1');
 const targetSelect=buildSelect(target,[{value:'1',label:'SIM 1'},{value:'2',label:'SIM 2'},{value:'both',label:'Both SIMs'}]);targetSelect.setAttribute('aria-label','Apply APN to');
 const apn=E('input',{type:'text',value:config.apn,placeholder:target==='2'?'Use SIM 1 APN':'Carrier automatic',autocomplete:'off',spellcheck:'false','aria-label':'APN'});
 const auth=buildSelect(normalizeAuth(config.auth),AUTH_CHOICES),user=E('input',{type:'text',value:config.username,autocomplete:'off'}),password=E('input',{type:'password',value:config.password,autocomplete:'new-password','aria-label':'APN authentication password'});
 const matching=findPresetIndexForConfig(this.presets,config);
 const preset=buildSelect(matching<0?'custom':String(matching),[{value:'custom',label:'Custom / current settings'},...this.presets.map((p,i)=>({value:String(i),label:(p.operator==='Empty APN'?(target==='2'?'Use SIM 1 profile':'Automatic'):p.operator)+' — '+(p.apn||'Carrier default')}))]);preset.setAttribute('aria-label','Carrier preset');this.carrierPresetSelect=preset;
 const syncAuth=()=>{user.disabled=auth.value==='none';password.disabled=auth.value==='none';};auth.addEventListener('change',syncAuth);syncAuth();
 preset.addEventListener('change',()=>{if(preset.value==='custom')return;const p=this.presets[Number(preset.value)];if(!p)return;apn.value=p.apn;auth.value=normalizeAuth(p.auth);user.value=p.username;password.value=p.password;syncAuth();});
 apn.addEventListener('input',()=>{preset.value='custom';});
 targetSelect.addEventListener('change',()=>{this.apnTarget=targetSelect.value;this.refreshEditor();});
 const pdp=buildSelect(normalizePdp(uci.get('qmodem',modem.id,'pdp_type')),PDP_CHOICES.filter(c=>c.value!=='ethernet'));
 [auth,user,password].forEach(input=>input.addEventListener('input',()=>{preset.value='custom';}));
 const save=settings.button('Apply APN to '+(target==='both'?'both SIMs':'SIM '+target),ui.createHandlerFn(this,ev=>this.applyConfig(target,{operator:preset.value==='custom'?'':this.presets[Number(preset.value)]?.operator,apn:apn.value.trim(),auth:auth.value,username:user.value.trim(),password:password.value,pdp:pdp.value},ev.currentTarget)));
 return settings.card('Configure '+(target==='both'?'both SIMs':'SIM '+target),'Choose a carrier preset or enter the APN supplied with your plan.',[
 E('div',{'class':'st-fields'},[settings.field('Apply to',targetSelect,target==='both'?'Replaces the APN on both SIMs.':'Changes only the selected SIM configuration.'),settings.field('Carrier preset',preset,'Choose your plan, or enter a custom APN below.')]),
 E('div',{'class':'ap-main-field'},[settings.field('APN',apn,target==='2'?'Leave blank to use the SIM 1 APN. Enter a separate APN when this SIM uses another carrier.':'Your carrier provides this value. Leave blank for carrier automatic selection.')]),
 settings.field('IP type',pdp,'Shared by both SIMs. IPv4 / IPv6 is recommended unless your carrier requires otherwise.'),
 E('details',{'class':'ap-advanced'},[E('summary',{},['Authentication']),E('p',{'class':'st-muted'},['Leave this set to No Authentication unless your carrier gave you a username and password.']),E('div',{'class':'st-fields'},[settings.field('Authentication',auth),settings.field('Username',user),settings.field('Password',password)])]),
 settings.footer(save,'Changes take effect only when you apply. Cellular data reconnects briefly.')
 ],'network');
},
renderSavedSIMs(){const modem=this.getCurrentModem();if(!modem)return E('div');return E('div',{'class':'ap-sim-grid'},['1','2'].map(slot=>{const cfg=configFromSection(modem,slot),matched=this.presets.find(p=>sameConfig(p,cfg));return E('button',{type:'button','class':'ap-sim-card'+((this.apnTarget||'1')===slot?' is-selected':''),'aria-pressed':(this.apnTarget||'1')===slot?'true':'false',click:()=>{this.apnTarget=slot;this.refreshEditor();}},[E('span',{'class':'ap-sim-label'},['SIM '+slot]),E('strong',{},[slot==='2'&&!cfg.apn?'Uses SIM 1 profile':matched?.operator==='Empty APN'?'Automatic':matched?.operator||'Custom APN']),E('span',{},[cfg.apn||(slot==='2'?(configFromSection(modem,'1').apn||'Carrier automatic'):'Carrier automatic')]),E('small',{},['Saved profile · Tap to edit'])]);}));},
refreshEditor(){dom.content(this.simSummary,[this.renderSavedSIMs()]);dom.content(this.editorNode,[this.renderQuickEditor()]);},
renderConnectionType(){const modem=this.getCurrentModem();if(!modem)return E('div');const pdp=buildSelect(normalizePdp(uci.get('qmodem',modem.id,'pdp_type')),PDP_CHOICES);return E('details',{'class':'st-card ap-advanced'},[E('summary',{},['Connection type']),E('p',{'class':'st-muted'},['Shared by both SIMs. IPv4 / IPv6 supports both address types when your carrier allows it.']),settings.field('IP connection type',pdp),settings.footer(settings.button('Save connection type',ui.createHandlerFn(this,ev=>this.applyPdpType(pdp.value,ev.currentTarget))),'Saving reconnects cellular data.')]);},
render(data){this.modems=data.modems||[];this.selectedModemId=modemHelper.ensureSelected(this.selectedModemId,this.modems);this.page=this.page||0;this.setPresetData(data.presetData);this.simSummary=E('div');this.tableNode=E('div');this.editorNode=E('div');this.pdpTypeNode=E('div');
 const selector=buildSelect(this.selectedModemId,this.modems.map(m=>({value:m.id,label:modemHelper.modemLabel(m)})));selector.addEventListener('change',()=>{this.selectedModemId=selector.value;this.refreshEditor();this.renderTable();});
 this.refreshEditor();this.renderTable();
 return settings.sheet([settings.head('APN Config','Select a SIM, choose its carrier profile, then apply.','network'),this.modems.length>1?settings.card('Modem','',[settings.field('Modem',selector)]):'',this.simSummary,this.editorNode,
 E('details',{'class':'st-card ap-library'},[E('summary',{},['Manage carrier presets']),E('p',{'class':'st-muted'},['Save carrier profiles here, then select one in the SIM editor above. Library edits do not reconnect cellular data.']),this.tableNode])],'st-apn');
},handleSave:null,handleSaveApply:null,handleReset:null});

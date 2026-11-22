
'use strict';
'require view';'require ui';'require dom';'require uci';'require chester-ui.settings as settings';'require chester-ui.live-cellular as liveCellular';'require misectel.ui as misectel';'require misectel.modem as modemHelper';
function bandNumber(value){const match=String(value).match(/\d+/);return match?Number(match[0]):Number.MAX_SAFE_INTEGER;}
function bandList(values){return [...new Set((Array.isArray(values)?values:values==null?[]:[values]).map(String))].sort((a,b)=>bandNumber(a)-bandNumber(b));}
function sameBands(a,b){return JSON.stringify(bandList(a))===JSON.stringify(bandList(b));}
function modeName(key){return ({LTE:'4G LTE',NR:'5G SA',NR_NSA:'5G NSA',NR_NAS:'5G NSA',UMTS:'3G'})[key]||key;}
function bandName(key,id){return (key==='LTE'?'B':/^NR/.test(key)?'N':'Band ')+id;}
return view.extend({
 load(){misectel.ensureBaseStyle();return Promise.all([modemHelper.loadModems(),uci.load('misectel')]);},
 makeCard(modemId,key,info){
  let current=bandList(info.lock_band),busy=false;
  const available=(info.available_band||[]).slice().sort((a,b)=>bandNumber(a.band_id)-bandNumber(b.band_id));
  const ids=bandList(available.map(b=>b.band_id).concat(current.filter(id=>id!=='0'))),known=new Set(available.map(b=>String(b.band_id)));
  const inputs=[],count=E('span',{'class':'bl-count'}),notice=E('p',{'class':'st-muted bl-notice','aria-live':'polite'}),result=E('div',{'class':'bl-result',role:'status','aria-live':'polite'});
  const selected=()=>inputs.filter(i=>i.checked).map(i=>i.value);
  const save=settings.button('Save '+modeName(key),ui.createHandlerFn(this,async ev=>{
   const values=selected();if(busy||sameBands(values,current)||!values.length)return;
   busy=true;sync();dom.content(result,['Applying band selection…']);result.classList.remove('is-error');
   try{
    const reply=await modemHelper.setLockBand(modemId,{band_class:key,lock_band:bandList(values).join(',')});
    if(reply?.error||reply?.success===false||reply?.result===false)throw new Error(reply.message||'The modem rejected the request.');
    const response=reply?.result?.set_lockband||reply?.set_lockband||'';
    if(/ERROR/i.test(String(response)))throw new Error('The modem rejected the band selection.');
    const readback=await modemHelper.getLockBand(modemId),actual=readback?.lockband?.[key]?.lock_band;
    if(!Array.isArray(actual)||!sameBands(actual,values))throw new Error('The modem did not confirm this selection. Refresh to read its current setting.');
    current=bandList(actual);dom.content(result,['Saved. Confirmed by the modem.']);
   }catch(error){result.classList.add('is-error');dom.content(result,[error.message||'Could not confirm the band selection.']);}
   finally{busy=false;sync();}
  }));
  function sync(){
   const values=selected(),dirty=!(sameBands(values,current)||(current.length===1&&current[0]==='0'&&!values.length));save.disabled=busy||!dirty||!values.length;inputs.forEach(i=>{i.disabled=busy;});
   dom.content(count,[values.length+' / '+ids.length+' selected']);
   dom.content(notice,[current.includes('0')&&!dirty?'The modem reports a custom setting. It stays unchanged until you choose bands and save.':!values.length?'Choose at least one band before saving.':dirty?'Unsaved selection. Your current bands stay active until you save.':'Your current modem selection is shown.']);
  }
  const grid=E('div',{'class':'bl-grid'},ids.map(id=>{
   const input=E('input',{type:'checkbox',value:id,checked:current.includes(id)?'checked':null,'aria-label':modeName(key)+' '+bandName(key,id)});inputs.push(input);input.addEventListener('change',()=>{dom.content(result,[]);sync();});
   return E('label',{'class':'bl-band'},[input,E('span',{},[bandName(key,id)]),known.has(id)?'':E('small',{},['Current'])]);
  }));
  const select=(values)=>{if(busy)return;inputs.forEach(i=>i.checked=values.includes(i.value));dom.content(result,[]);sync();};
  const all=settings.button('Select all',()=>select(ids),{'class':'st-button secondary'}),clear=settings.button('Clear',()=>select([]),{'class':'st-button secondary'}),restore=settings.button('Restore current',()=>select(current),{'class':'st-button secondary'});
  sync();return settings.card(modeName(key)+' bands',key==='LTE'?'LTE bands are also used as the anchor for 5G NSA.':key==='NR'?'Standalone 5G bands.':key==='UMTS'?'Legacy 3G bands, where available.':'Non-standalone 5G bands used alongside LTE.',[
   E('div',{'class':'bl-tools'},[count,E('div',{'class':'bl-actions'},[all,clear,restore])]),grid,notice,result,settings.footer(save,'A band change may briefly interrupt cellular service.')
  ],'network');
 },
 async refresh(){
  const modem=this.modems.find(m=>m.id===this.selectedModemId);if(!modem){dom.content(this.content,[E('p',{'class':'st-muted'},['No configurable modem detected.'])]);return;}
  dom.content(this.content,[E('p',{'class':'st-muted'},['Reading bands from the modem…'])]);
  try{
   const [disabled,info]=await Promise.all([modemHelper.getDisabledFeatures(modem.id),modemHelper.getLockBand(modem.id)]);
   if((disabled.disabled_features||[]).includes('LockBand')){dom.content(this.content,[E('p',{'class':'st-muted'},['Band selection is not supported by this modem.'])]);return;}
   if(!info.lockband)throw new Error('The modem did not return its band settings.');
   const hidden=bandList(uci.get('misectel','modem_cfg_main','hidden_lockband')).map(v=>v.toUpperCase());
   const keys=Object.keys(info.lockband).filter(k=>!hidden.includes(k.toUpperCase())&&((info.lockband[k].available_band||[]).length||(info.lockband[k].lock_band||[]).length));
   const order={LTE:1,NR_NSA:2,NR_NAS:2,NR:3,UMTS:99};keys.sort((a,b)=>(order[a]||10)-(order[b]||10));
   const tabs=E('div',{'class':'bl-tabs',role:'tablist','aria-label':'Radio bands'}),panels=E('div');
   keys.forEach((key,i)=>{
    const button=E('button',{type:'button',role:'tab',id:'bl-tab-'+i,'aria-selected':i===0?'true':'false','aria-controls':'bl-panel-'+i,tabindex:i===0?'0':'-1'},[modeName(key)]);
    const panel=E('section',{role:'tabpanel',id:'bl-panel-'+i,'aria-labelledby':'bl-tab-'+i,hidden:i===0?null:true},[this.makeCard(modem.id,key,info.lockband[key])]);
    const activate=()=>{[...tabs.children].forEach((b,n)=>{b.setAttribute('aria-selected',b===button?'true':'false');b.tabIndex=b===button?0:-1;panels.children[n].hidden=b!==button;});};
    button.addEventListener('click',activate);button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?keys.length-1:(i+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length;tabs.children[index].click();tabs.children[index].focus();});
    tabs.appendChild(button);panels.appendChild(panel);
   });
   dom.content(this.content,keys.length?[tabs,panels]:[E('p',{'class':'st-muted'},['No selectable bands are available.'])]);
  }catch(error){dom.content(this.content,[settings.card('Could not read bands',error.message||'Try refreshing the page.',[settings.button('Try again',()=>this.refresh())])]);}
 },
 render(data){
  this.modems=Array.isArray(data)&&Array.isArray(data[0])?data[0]:[];this.selectedModemId=modemHelper.ensureSelected(this.selectedModemId,this.modems);this.content=E('div');
  const selector=E('select',{},this.modems.map(m=>E('option',{value:m.id,selected:m.id===this.selectedModemId?'selected':null},[modemHelper.modemLabel(m)])));
  selector.addEventListener('change',()=>{this.selectedModemId=selector.value;this.refresh();this.liveCellular.refresh();});
  this.liveCellular=liveCellular.create(()=>this.modems.find(m=>m.id===this.selectedModemId));
  const shell=settings.sheet([settings.head('Band Lock','Choose which bands your modem can use.','network'),this.liveCellular.node,E('p',{'class':'st-muted bl-intro'},['Keep all bands selected for normal use. Select fewer bands only when you want to limit the connection. Each radio group saves separately.']),this.modems.length>1?settings.card('Modem','',[settings.field('Modem',selector)]):'',this.content],'st-bands');this.refresh();return shell;
 },handleSave:null,handleSaveApply:null,handleReset:null
});

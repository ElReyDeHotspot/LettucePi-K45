'use strict';
'require view';
'require rpc';
'require poll';
'require chester-ui.settings as settings';

const getStatus=rpc.declare({object:'misectel',method:'ttl_status',expect:{}});
const applyValues=rpc.declare({object:'misectel',method:'set_ttl_values',params:['enabled','ttl','hl'],expect:{}});
return view.extend({
 load(){return getStatus();},
 showStatus(data){
  this.ttlValue.textContent=data.ttl||'—';this.hlValue.textContent=data.hl||'—';
  this.appliedValue.textContent=data.enabled?(data.applied?'Verified':'Needs Apply'):'Off';
  this.liveNote.textContent=data.enabled?(data.applied?'Both values match the live firewall rules.':'Saved settings do not match both live rules. Apply to repair them.'):'TTL and hop-limit rewriting are disabled.';
 },
 async save(button){
  const ttl=String(Number(this.ttlInput.value)),hl=String(Number(this.hlInput.value));
  if(!this.ttlInput.value||!this.hlInput.value||![ttl,hl].every(v=>/^[1-9][0-9]{0,2}$/.test(v)&&Number(v)<=255)){this.message.textContent='Enter whole numbers from 1 to 255 for both TTL and HL.';this.message.className='st-message error';return;}
  button.disabled=true;this.message.className='st-message';this.message.textContent='Applying and checking both live rules…';
  try{
   const result=await applyValues(this.enabled.checked?'1':'0',ttl,hl);
   if(!result.success)throw new Error(result.message||'TTL/HL could not be applied.');
   this.showStatus(result);this.message.className='st-message success';this.message.textContent=result.enabled?'IPv4 TTL '+result.ttl+' and IPv6 HL '+result.hl+' are applied and verified.':'TTL/HL rewriting is off.';
  }catch(error){this.message.className='st-message error';this.message.textContent=error.message||String(error);}
  finally{button.disabled=false;}
 },
 render(data){
  this.enabled=E('input',{type:'checkbox',checked:data.enabled?'checked':null});
  this.ttlInput=E('input',{type:'number',min:1,max:255,step:1,value:data.ttl||'64',input:()=>{if(this.sameValue.checked)this.hlInput.value=this.ttlInput.value;}});
  this.hlInput=E('input',{type:'number',min:1,max:255,step:1,value:data.hl||data.ttl||'64'});
  this.sameValue=E('input',{type:'checkbox',checked:String(data.ttl)===String(data.hl)?'checked':null,change:()=>{this.hlInput.disabled=this.sameValue.checked;if(this.sameValue.checked)this.hlInput.value=this.ttlInput.value;}});this.hlInput.disabled=this.sameValue.checked;
  const ttlStat=settings.stat('IPv4 TTL','—','network'),hlStat=settings.stat('IPv6 Hop Limit','—','network'),activeStat=settings.stat('Live Rules','—','check');
  this.ttlValue=ttlStat.querySelector('strong');this.hlValue=hlStat.querySelector('strong');this.appliedValue=activeStat.querySelector('strong');this.liveNote=E('p',{'class':'st-muted'});this.message=E('div',{'class':'st-message',role:'status','aria-live':'polite'});
  const card=settings.card('TTL & Hop Limit','Set the value clients use when traffic leaves your LAN.',[
   settings.toggle('Enable Rewriting',this.enabled,'Applies to forwarded traffic from Main LAN and its VLANs.'),
   settings.toggle('Use the Same Value for Both',this.sameValue,'Keep IPv4 TTL and IPv6 HL together, or turn this off to set them separately.'),
   E('div',{'class':'st-fields ttl-values'},[settings.field('IPv4 TTL',this.ttlInput,'Whole number from 1 to 255.'),settings.field('IPv6 Hop Limit (HL)',this.hlInput,'Whole number from 1 to 255.')]),
   this.message,settings.footer(settings.button('Save & Apply',(ev)=>this.save(ev.currentTarget)),'The page checks both live rules before reporting success.')
  ],'network');
  const root=settings.sheet([settings.head('TTL/HL','One place for IPv4 and IPv6.','network'),E('div',{'class':'st-summary'},[ttlStat,hlStat,activeStat]),this.liveNote,card,E('details',{'class':'st-card st-advanced'},[E('summary',{},['How This Works']),E('p',{'class':'st-muted'},['TTL is the IPv4 time-to-live value. HL is the equivalent hop limit for IPv6. Rewriting applies to traffic forwarded from br-lan and its VLAN interfaces. IPv6 neighbor discovery keeps its required hop limit.']),E('p',{'class':'st-muted'},['Flow offloading is disabled while rewriting is active so forwarded packets pass through these rules. Router-originated traffic is unchanged.'])])],'st-ttl');
  this.showStatus(data);poll.add(()=>getStatus().then(next=>this.showStatus(next)),15);return root;
 },handleSave:null,handleSaveApply:null,handleReset:null
});

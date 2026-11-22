'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
var status=rpc.declare({object:'failover',method:'status',expect:{}});
var start=rpc.declare({object:'failover',method:'test_start',params:['role','notice'],expect:{}});
var cancel=rpc.declare({object:'failover',method:'test_cancel',expect:{}});
var CSS='.ml-page{max-width:1040px;margin:auto;padding:18px 8px;color:#182b3c}.ml-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.ml-card{padding:24px;border:1px solid #d8e5e8;border-radius:18px;background:#fff}.ml-muted{font-size:12px;color:#728697;line-height:1.6}.ml-note{color:#a63d48}.ml-page a{color:#215d98;text-decoration:underline}.fo-test-button{min-height:46px;width:100%;margin:0 0 10px;padding:10px 5px;border:1px solid #aac3e2;border-radius:12px;background:#eaf3ff;color:#215d98;font-size:13px;font-weight:700;cursor:pointer}.fo-test-button:disabled{opacity:.5;cursor:default}.fo-test-result{font-size:12px;line-height:1.5;margin-bottom:12px;overflow-wrap:anywhere}.fo-test-result.error{color:#b53643}.fo-test-row{display:flex;justify-content:space-between;gap:5px;flex-wrap:wrap}.fo-test-row strong{color:#254c71}@media(max-width:600px){.ml-grid{grid-template-columns:1fr}.ml-card{padding:18px}}';
return view.extend({
 load:function(){return status();},
 render:function(s){var self=this;
  this.note=E('div',{'class':'ml-note','aria-live':'polite'});
  this.refs=['primary','secondary'].map(function(role){var title=E('h3'),detail=E('p',{'class':'ml-muted'}),result=E('div',{'class':'fo-test-result','aria-live':'polite'}),button=E('button',{type:'button','class':'fo-test-button',click:ui.createHandlerFn(self,function(){return this.run(role);})},[role==='primary'?'Test Primary':'Test Secondary']);return {role:role,title:title,detail:detail,result:result,button:button,node:E('section',{'class':'ml-card'},[title,detail,button,result])};});
  var root=E('div',{'class':'ml-page'},[E('style',{},[CSS]),E('h2',{},['M-Lab NDT']),E('p',{'class':'ml-muted'},['Test each connection independently with the same M-Lab NDT engine used in Failover. Tests use data and may slow other traffic. M-Lab publishes results and your public IP address. ',E('a',{href:'https://www.measurementlab.net/privacy/',target:'_blank',rel:'noopener noreferrer'},['Privacy policy'])]),this.note,E('div',{'class':'ml-grid'},this.refs.map(function(r){return r.node;})),E('p',{'class':'ml-muted'},['To test individual SIM cards, use ',E('a',{href:L.url('admin/chester/sim')},['SIM Selection']),'.'])]);
  this.update(s);poll.add(async function(){try{self.update(await status());}catch(e){self.note.textContent='Connection status temporarily unavailable.';}},2);return root;
 },
 update:function(s){this.last=s;var c=s.config||{},t=s.link_tests||{};this.refs.forEach(function(r){var iface=r.role==='primary'?c.primary:c.backup,v=[s.wan,s.cell].find(function(v){return v&&v.iface===iface;})||{},result=(t.results||[]).filter(function(x){return x.iface===iface;}).sort(function(a,b){return b.timestamp-a.timestamp;})[0],active=!!t.running&&t.role===r.role;
  r.title.textContent=(r.role==='primary'?'Primary':'Secondary')+' · '+(iface==='pcie0'?'Cellular':iface==='wan'?'Ethernet WAN':iface||'Not configured');r.detail.textContent=v.up?'Connected':'Not connected';r.button.disabled=!!this.busy||(t.running&&!active)||(!active&&!v.up);r.button.textContent=active?'Cancel test':r.role==='primary'?'Test Primary':'Test Secondary';r.result.className='fo-test-result'+(result&&result.phase==='failed'?' error':'');r.result.replaceChildren();
  if(result){if(result.phase==='completed'){[['Download',result.download_mbps,'Mbps'],['Upload',result.upload_mbps,'Mbps'],['Latency',result.latency_ms,'ms']].forEach(function(m){r.result.append(E('div',{'class':'fo-test-row'},[E('span',{},[m[0]]),E('strong',{},[Number.isFinite(m[1])?m[1].toFixed(1)+' '+m[2]:'—'])]));});r.result.append(E('div',{'class':'ml-muted'},['M-Lab · '+new Date(result.timestamp*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})]));}else r.result.textContent=result.phase==='failed'?result.error:result.phase==='cancelled'?'Test cancelled':result.phase==='download'?'Testing download…':result.phase==='upload'?'Testing upload…':'Finding an M-Lab server…';}
 },this);},
 run:async function(role){if(this.busy)return;this.busy=true;this.note.textContent='';this.update(this.last);try{var t=this.last.link_tests||{},r=t.running?await cancel():await start(role,'1');if(!r.success)throw new Error(r.error||'Could not start the test.');this.update(await status());}catch(e){this.note.textContent=e.message;}finally{this.busy=false;this.update(this.last);}},
 handleSaveApply:null,handleSave:null,handleReset:null
});

'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
var ooklaStatus=rpc.declare({object:'luci.lettucepi.speedtest',method:'status',expect:{}});
var ooklaHistory=rpc.declare({object:'luci.lettucepi.speedtest',method:'history',expect:{}});
var ooklaStart=rpc.declare({object:'luci.lettucepi.speedtest',method:'start',expect:{}});
var ooklaCancel=rpc.declare({object:'luci.lettucepi.speedtest',method:'cancel',expect:{}});
var linkStatus=rpc.declare({object:'failover',method:'status',expect:{}});
var linkStart=rpc.declare({object:'failover',method:'test_start',params:['role','notice'],expect:{}});
var linkCancel=rpc.declare({object:'failover',method:'test_cancel',expect:{}});
var names={ookla:'Ookla',mlab:'M-Lab NDT',netflix:'Netflix · FAST.com'};
function format(value){return Number.isFinite(value)?value.toFixed(1):'—';}
return view.extend({
 load:function(){return Promise.all([ooklaStatus(),ooklaHistory(),L.resolveDefault(linkStatus(),{})]);},
 render:function(data){
  var self=this;this.provider='ookla';this.data=data;this.busy=false;this.fastFrame=null;
  this.tabs=['ookla','mlab','netflix'].map(function(key){return E('button',{type:'button',role:'tab','aria-selected':String(key===self.provider),'aria-controls':'chester-speeds-panel',id:'chester-speeds-'+key,click:function(){self.choose(key);}},[key==='mlab'?'M-Lab':key==='ookla'?'Ookla':'Netflix']);});
  this.heading=E('h3');this.scope=E('div',{'class':'sp-muted'});
  this.role=E('select',{'aria-label':'Connection to test',change:function(){self.update();}});
  this.role.append(E('option',{value:'primary'},['Primary']),E('option',{value:'secondary'},['Secondary']));
  this.roleRow=E('label',{'class':'sp-connection'},[E('span',{},['Connection']),this.role]);
  this.startButton=E('button',{type:'button','class':'sp-start',click:ui.createHandlerFn(this,this.start)},['Run speed test']);
  this.cancelButton=E('button',{type:'button','class':'sp-cancel',click:ui.createHandlerFn(this,this.cancel)},['Cancel test']);
  this.message=E('div',{'class':'sp-message','aria-live':'polite'});
  this.metrics={};this.metricGrid=E('div',{'class':'sp-metrics'});
  [['download','Download','Mbps'],['upload','Upload','Mbps'],['latency','Latency','ms'],['jitter','Jitter','ms']].forEach(function(m){var value=E('strong',{},['—']),node=E('div',{'class':'sp-metric'},[E('span',{},[m[1]]),value,E('small',{},[m[2]])]);self.metrics[m[0]]={value:value,node:node};self.metricGrid.append(node);});
  this.progressBar=E('div');this.progress=E('div',{'class':'sp-progress',role:'progressbar','aria-label':'Speed test progress','aria-valuemin':'0','aria-valuemax':'100'},[this.progressBar]);
  this.detail=E('div',{'class':'sp-details'});this.notice=E('p',{'class':'sp-muted sp-notice'});this.fastHost=E('div',{'class':'sp-fast'});
  this.history=E('div',{'class':'sp-history'});this.historyCard=E('details',{'class':'sp-history-card'},[E('summary',{},['Recent results']),this.history]);
  var root=E('div',{'class':'lp-speedtest chester-ios chester-speeds'},[
   E('link',{rel:'stylesheet',href:L.resource('chester-ui/ios.css')+'?v=f78b876c6b61'}),
   E('div',{'class':'sp-head'},[E('div',{'class':'ios-title',role:'heading','aria-level':'2'},['Chester Speeds']),E('p',{'class':'sp-muted'},['One place for your connection tests.'])]),
   E('div',{'class':'sp-tabs',role:'tablist','aria-label':'Speed test provider'},this.tabs),
   E('section',{id:'chester-speeds-panel',role:'tabpanel','class':'sp-panel'},[
    E('div',{'class':'sp-panel-head'},[E('div',{},[this.heading,this.scope]),E('div',{'class':'sp-actions'},[this.startButton,this.cancelButton])]),
    this.roleRow,this.message,this.progress,this.metricGrid,this.detail,this.fastHost,this.notice
   ]),this.historyCard
  ]);
  this.update();poll.add(function(){return self.refresh();},2);return root;
 },
 nativeRunning:function(){var d=this.data||[];return !!((d[0]||{}).running||(((d[2]||{}).link_tests||{}).running));},
 choose:function(key){if(this.busy)return;this.closeFast();this.provider=key;this.error='';this.update();},
 closeFast:function(){if(this.fastFrame){this.fastFrame.remove();this.fastFrame=null;}},
 refresh:async function(){try{this.data=await Promise.all([ooklaStatus(),ooklaHistory(),L.resolveDefault(linkStatus(),{})]);this.update();}catch(e){this.message.textContent='Status is temporarily unavailable.';}},
 update:function(){
  var self=this,d=this.data||[],o=d[0]||{},f=d[2]||{},tests=f.link_tests||{},isOokla=this.provider==='ookla',isMlab=this.provider==='mlab',isNetflix=this.provider==='netflix';
  this.tabs.forEach(function(t,i){t.setAttribute('aria-selected',String(['ookla','mlab','netflix'][i]===self.provider));t.disabled=self.busy;});
  this.heading.textContent=names[this.provider];
  this.scope.textContent=isOokla?'From your router · current routing':isMlab?'From your router · one connection at a time':'From this device · Netflix servers';
  this.roleRow.style.display=isMlab?'flex':'none';this.role.disabled=this.busy||this.nativeRunning();
  var c=f.config||{};['primary','secondary'].forEach(function(role,i){var iface=role==='primary'?c.primary:c.backup;self.role.options[i].textContent=(i?'Secondary':'Primary')+(iface?' · '+(iface==='pcie0'?'Cellular':iface==='wan'?'Ethernet WAN':iface):'');});
  if(isMlab&&tests.running&&(tests.role==='primary'||tests.role==='secondary'))this.role.value=tests.role;
  var otherEngine=!isOokla&&o.running?'Ookla':!isMlab&&tests.running?'M-Lab':null;
  var result=isOokla?o:(tests.results||[]).filter(function(r){return r.role===self.role.value;}).sort(function(a,b){return b.timestamp-a.timestamp;})[0]||{};
  var running=isOokla?!!o.running:isMlab?!!tests.running:false;
  var activeRole=!isMlab||!tests.running||tests.role===this.role.value;
  this.startButton.disabled=this.busy||this.nativeRunning()||(isOokla&&!o.installed)||(isMlab&&!c.primary);
  this.startButton.textContent=isNetflix?(this.fastFrame?'Restart test':'Run Netflix test'):'Run speed test';
  this.cancelButton.style.display=running||this.fastFrame?'':'none';this.cancelButton.disabled=this.busy||(!activeRole&&!this.fastFrame);this.cancelButton.textContent=isNetflix?'Close test':'Cancel test';
  this.metricGrid.style.display=isNetflix?'none':'grid';this.detail.style.display=isNetflix?'none':'grid';this.metrics.jitter.node.style.display=isOokla?'':'none';this.metricGrid.style.gridTemplateColumns=isOokla?'':'repeat(3,minmax(0,1fr))';
  this.metrics.download.value.textContent=format(result.download_mbps);this.metrics.upload.value.textContent=format(result.upload_mbps);this.metrics.latency.value.textContent=format(result.latency_ms);this.metrics.jitter.value.textContent=format(result.jitter_ms);
  var phase=isOokla?o.test_phase:result.phase;
  this.message.className='sp-message'+(this.error||result.phase==='failed'?' error':'');
  this.message.textContent=this.error||(isNetflix?(this.fastFrame?'The official FAST.com test is shown below.':'Ready to test Netflix performance.'):running?(!activeRole?'A test is running on the other connection.':phase==='download'?'Measuring download…':phase==='upload'?'Measuring upload…':phase==='ping'?'Measuring latency…':'Preparing your connection test…'):result.phase==='completed'?'Last test complete':result.phase==='cancelled'?'Test cancelled':result.phase==='failed'?'The test could not complete. Check this connection and try again.':'Ready to test');
  if(!this.error&&otherEngine)this.message.textContent=otherEngine+' test is running. Select its tab to view or cancel it.';
  this.progress.style.display=running&&activeRole?'':'none';var pct=isOokla?(phase==='upload'?50+50*(o.progress||0):phase==='download'?Math.max(4,50*(o.progress||0)):3):phase==='upload'?75:phase==='download'?25:3;this.progressBar.style.width=Math.min(100,pct)+'%';this.progress.setAttribute('aria-valuenow',String(Math.round(pct)));
  this.detail.replaceChildren();[['Server',result.server||'—'],['Test location',isOokla?(result.location||'Automatic'):this.role.options[this.role.selectedIndex].textContent]].forEach(function(row){self.detail.append(E('div',{},[E('span',{},[row[0]]),E('strong',{},[row[1]])]));});
  if(isOokla&&result.result_url)this.detail.append(E('a',{href:result.result_url,target:'_blank',rel:'noopener noreferrer'},['View result on Speedtest.net']));
  this.notice.replaceChildren();this.notice.append(document.createTextNode(isOokla?'Runs on the router using the built-in Ookla engine. Tests use internet data.':isMlab?'Runs on the selected router connection. M-Lab tests use data and publish the result and public IP address. ':'Loads Netflix’s official FAST.com test only when you press Run. This measures this device’s connection, including Wi-Fi or Ethernet. '));
  if(isMlab)this.notice.append(E('a',{href:'https://www.measurementlab.net/privacy/',target:'_blank',rel:'noopener noreferrer'},['M-Lab privacy policy']));
  if(isNetflix)this.notice.append(E('a',{href:'https://fast.com/',target:'_blank',rel:'noopener noreferrer'},['Open FAST.com separately']));
  this.historyCard.style.display=isNetflix?'none':'';this.history.replaceChildren();var history=isOokla?((d[1]||{}).results||[]).slice().reverse().slice(0,5):(tests.results||[]).filter(function(r){return r.phase==='completed';}).sort(function(a,b){return b.timestamp-a.timestamp;});
  if(!history.length)this.history.append(E('p',{'class':'sp-muted'},['No completed tests yet.']));
  history.forEach(function(r){self.history.append(E('div',{'class':'sp-history-row'},[E('span',{},[r.timestamp?new Date(r.timestamp*1000).toLocaleString():'Recent test']),E('strong',{},[format(r.download_mbps)+' ↓ / '+format(r.upload_mbps)+' ↑ Mbps']),E('span',{'class':'sp-muted'},[r.server||names[self.provider]])]));});
 },
 start:async function(){
  if(this.busy||this.nativeRunning())return;this.error='';
  if(this.provider==='netflix'){this.closeFast();this.fastFrame=E('iframe',{src:'https://fast.com/',title:'Netflix FAST.com speed test',referrerpolicy:'no-referrer'});this.fastHost.replaceChildren(this.fastFrame);this.update();return;}
  this.busy=true;this.update();try{var r=this.provider==='ookla'?await ooklaStart():await linkStart(this.role.value,'1');if(r.error||r.success===false||r.ok===false)throw new Error(r.error||'Could not start the test.');await this.refresh();}catch(e){this.error=e.message;}finally{this.busy=false;this.update();}
 },
 cancel:async function(){if(this.busy)return;if(this.provider==='netflix'){this.closeFast();this.update();return;}this.busy=true;this.update();try{if(this.provider==='ookla')await ooklaCancel();else await linkCancel();await this.refresh();}catch(e){this.error=e.message;}finally{this.busy=false;this.update();}},
 handleSaveApply:null,handleSave:null,handleReset:null
});

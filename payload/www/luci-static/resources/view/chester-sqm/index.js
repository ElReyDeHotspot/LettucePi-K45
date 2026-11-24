'use strict';
'require view';
'require ui';
'require rpc';
'require chester-ui.settings as settings';

var callStatus = rpc.declare({object:'misectel',method:'sqm_status',expect:{}});
var callSet = rpc.declare({object:'misectel',method:'set_sqm',params:['enabled','upload_enabled','upload_kbit','download_enabled','download_kbit'],expect:{}});
function size(value) {
 var n=Number(value);if(!isFinite(n)||n<0)return '—';
 var units=['B','KB','MB','GB'],i=0;while(n>=1024&&i<3){n/=1024;i++;}
 return (i?n.toFixed(1):n)+' '+units[i];
}
function detail(label,value){return E('div',{'class':'sq-detail'},[E('span',{},[label]),E('strong',{},[value||'—'])]);}
function switchInput(value){return E('input',{type:'checkbox',checked:value?'checked':null});}
function speedInput(kbit,label){return E('input',{type:'number',min:'0.064',max:'10000',step:'any',value:String(Number(kbit||0)/1000),'aria-label':label,inputmode:'decimal'});}
function toKbit(input){var n=Number(input.value);return input.value.trim()&&Number.isFinite(n)?String(Math.round(n*1000)):'';}
return view.extend({
 load:function(){return callStatus();},
 render:function(s){
  var self=this,on=s.enabled===true,active=s.shaping||s.download_active,cake=s.cake_available===true;
  var master=switchInput(on),up=switchInput(s.upload_enabled),down=switchInput(s.download_enabled);
  var upRate=speedInput(s.upload_kbit||20000,'Upload Speed Limit in Mbps');
  var downRate=speedInput(s.download_kbit||90000,'Download Speed Limit in Mbps');
  var message=E('p',{'class':'sq-message',role:'status','aria-live':'polite'});
  var sync=function(){upRate.disabled=!up.checked;downRate.disabled=!down.checked||!s.download_available;};
  up.addEventListener('change',sync);down.addEventListener('change',sync);down.disabled=!s.download_available;sync();
  function direction(title,description,input,rate,arrow,applied){
   return settings.card(title,description,[settings.toggle('Limit '+title.toLowerCase(),input),E('div',{'class':'sq-speed'},[E('span',{'class':'sq-arrow','aria-hidden':'true'},[arrow]),rate,E('span',{'class':'sq-unit'},['Mbps'])]),E('div',{'class':'sq-applied'},[E('span',{'class':applied?'sq-dot is-active':'sq-dot','aria-hidden':'true'}),applied?'Limit is active':'Limit is off'])],title==='Upload'?'network':'router');
  }
  var save=settings.button('Save Changes',ui.createHandlerFn(self,function(){
   message.textContent='';var uk=toKbit(upRate),dk=toKbit(downRate);
   for(var item of [[up,upRate,uk,'Upload'],[down,downRate,dk,'Download']]){
    item[1].removeAttribute('aria-invalid');
    if(master.checked&&item[0].checked&&(!item[2]||Number(item[2])<64||Number(item[2])>10000000)){
     item[1].setAttribute('aria-invalid','true');item[1].focus();message.textContent=item[3]+' must be between 0.064 and 10,000 Mbps.';message.classList.add('is-error');return;
    }
   }
   message.classList.remove('is-error');message.textContent='Saving changes…';
   return callSet(master.checked?'1':'0',up.checked?'1':'0',uk,down.checked?'1':'0',dk).then(function(r){
    if(!r||r.success!==true)throw new Error(r&&r.message||'Could not save changes.');
    message.textContent='Saved. Checking active limits…';window.setTimeout(function(){location.reload();},600);
   }).catch(function(e){message.classList.add('is-error');message.textContent=e.message||String(e);});
  }));
  return settings.sheet([
   E('link',{rel:'stylesheet',href:L.resource('chester-ui/smart-queue.css')+'?v=20261122-1'}),
   settings.head('Smart Queue','Keep busy connections feeling responsive.','network'),
   E('section',{'class':'st-card sq-hero'},[
    E('div',{'class':'sq-hero-top'},[E('div',{},[E('span',{'class':'sq-eyebrow'},['TRAFFIC MANAGEMENT']),E('h3',{},['A little headroom. A smoother connection.'])]),E('span',{'class':'sq-badge'+(active?' is-active':'')},[active?'Active':on?'Waiting':'Off'])]),
    E('p',{'class':'st-muted'},['Set upload and download limits just below your connection speed to help keep calls, games and browsing responsive.']),
    settings.toggle('Enable Smart Queue',master,'Your saved limits take effect when you save changes.'),
    E('div',{'class':'sq-link'},[settings.icon('port'),E('div',{},[E('span',{},['Selected connection']),E('strong',{},[s.wan==='wan'?'Ethernet WAN':s.wan&&s.wan.indexOf('rmnet')===0?'Cellular':s.wan||'Waiting for a Connection'])]),E('span',{'class':'sq-method'},[cake?'CAKE':'fq_codel'])])
   ]),
   E('div',{'class':'sq-columns'},[
    direction('Upload','Room for calls, messages and everything you send.',up,upRate,'↑',s.shaping),
    direction('Download','Keep large downloads from taking over.',down,downRate,'↓',s.download_active)
   ]),
   E('section',{'class':'st-card sq-guide'},[settings.icon('clock'),E('div',{},[E('strong',{},['Start at 90% of Your Measured Speed']),E('p',{'class':'st-muted'},['Run a speed test with Smart Queue off, then enter slightly lower limits. Cellular speeds change, so adjust if needed.'])]),E('a',{'class':'st-button secondary',href:L.url('admin','chester','ookla')},['Open Speeds'])]),
   !s.download_available?E('p',{'class':'sq-warning'},['Download limiting is unavailable on this firmware. Upload control is still available.']):'',
   s.offload==='1'?E('p',{'class':'sq-warning'},['Flow offloading is on. Smart Queue will turn it off when enabled so traffic passes through the queue.']):'',
   E('details',{'class':'st-card sq-technical'},[E('summary',{},['Connection Details']),E('div',{'class':'sq-details'},[
    detail('Interface',s.wan),detail('Upload Method',s.upload_method||(s.shaping?'TBF + fq_codel':'Not active')),
    detail('Download Method',s.download_method==='cake'?'CAKE + IFB':s.download_method==='nftables'?'Packet limiter':'Not available'),
    detail('Upload Traffic',size(s.sent_bytes)),detail('Download Traffic',size(s.dl_seen_bytes)),detail('Download Packets Dropped',s.dl_dropped||'0')
   ]),E('p',{'class':'st-muted'},[cake?'CAKE manages upload queues. Downloads use a packet limiter. Limits apply to the selected uplink.':'Upload uses a managed queue. Download limiting drops excess packets. Limits apply to the selected uplink.'])]),
   settings.footer(save,'Changes apply to this router.'),message
  ],'st-sqm');
 },handleSave:null,handleSaveApply:null,handleReset:null
});

'use strict';
'require view';
'require chester-ui.settings as settings';
'require rpc';
'require ui';
'require uci';
var callReboot=rpc.declare({object:'system',method:'reboot',expect:{result:0}});
return view.extend({
 load:function(){return uci.changes();},
 render:function(changes){
  const pending=Object.values(changes||{}).some(v=>Array.isArray(v)&&v.length);
  const confirm=E('div',{'class':'st-reboot-confirm',hidden:true},[
   E('strong',{},['Reboot now?']),
   E('p',{'class':'st-muted'},['Everyone connected will briefly lose internet access.']),
   E('div',{'class':'st-reboot-actions'},[
    settings.button('Cancel',()=>{confirm.hidden=true;actions.hidden=false;},{'class':'st-button secondary'}),
    settings.button('Reboot now',ui.createHandlerFn(this,'handleReboot'),{'class':'st-button'})
   ])
  ]);
  const actions=E('div',{'class':'st-reboot-actions'},[
   E('a',{'class':'st-button secondary',href:L.url('admin','dashboard','overview')},['Back to Home']),
   settings.button('Reboot',()=>{actions.hidden=true;confirm.hidden=false;},{disabled:pending?'disabled':null})
  ]);
  return settings.sheet([
   settings.head('Reboot','A fresh connection. Your settings stay with you.','reboot'),
   E('section',{'class':'st-card st-reboot st-reboot-modern'},[
    E('div',{'class':'st-reboot-emblem'},[settings.icon('reboot')]),
    E('h3',{},['Reboot Chester K45P']),
    E('p',{'class':'st-muted'},['Your router will disconnect briefly and come back online automatically.']),
    E('div',{'class':'st-reboot-detail'},[settings.icon('check'),E('span',{},['Wi-Fi, cellular and network settings are kept.'])]),
    pending?E('div',{'class':'st-note'},['Save or discard your pending changes before you reboot.']):'',
    actions,confirm
   ])
  ],'st-reboot-page');
 },
 handleReboot:function(){
  return callReboot().then(function(res){
   if(res!==0)throw new Error(_('The router could not reboot. Please try again.'));
   ui.showModal(_('Rebooting…'),[E('p',{'class':'spinning'},_('Waiting for your router to come back online…'))]);
   ui.awaitReconnect();
  }).catch(function(e){ui.addNotification(null,E('p',{},[e.message]),'danger');});
 },
 handleSaveApply:null,handleSave:null,handleReset:null
});


'use strict';'require baseclass';'require poll';'require dom';'require rpc';'require uci';'require chester-ui.overview-core as overviewCore';
const interfaces=rpc.declare({object:'network.interface',method:'dump',expect:{interface:[]}});
return baseclass.extend({create(getModem){
 const context=Object.assign({},overviewCore.methods,{modemSnapshotCache:{},selectedModes:{}}),body=E('div',{},['Reading cellular connection…']);
 const node=E('div',{'class':'chester-home lock-cellular'},[E('link',{rel:'stylesheet',href:L.resource('chester-ui/overview.css')+'?v=a7bd0b071507'}),E('section',{'class':'ch-card'},[E('h3',{},['Cellular']),body])]);
 let pending=false;
 const refresh=async()=>{
  if(pending||!node.isConnected)return;const modem=getModem();if(!modem){dom.content(body,[E('p',{'class':'ch-muted'},['No modem detected.'])]);return;}
  pending=true;
  try{await uci.load(['qmodem','network']);const dump=await L.resolveDefault(interfaces(),{});const data=await context.fetchModem(modem,dump);if(getModem()?.id!==modem.id)return;context.selectedModemId=modem.id;dom.content(body,context.renderModems([data]));}
  catch(error){dom.content(body,[E('p',{'class':'ch-muted'},['Cellular information is temporarily unavailable.'])]);}
  finally{pending=false;}
 };
 requestAnimationFrame(refresh);poll.add(refresh,15);return {node,refresh};
}});

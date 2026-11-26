
'use strict';'require baseclass';'require poll';'require dom';'require rpc';'require uci';'require chester-ui.overview-core as overviewCore';
const interfaces=rpc.declare({object:'network.interface',method:'dump',expect:{interface:[]}});
const simStatus=rpc.declare({object:'chester.sim',method:'status',expect:{}});
return baseclass.extend({create(getModem){
 const context=Object.assign({},overviewCore.methods,{modemSnapshotCache:{},selectedModes:{},modeModels:{},modeControls:{}}),body=E('div',{},['Reading cellular connection…']);
 const node=E('div',{'class':'chester-home lock-cellular'},[E('link',{rel:'stylesheet',href:L.resource('chester-ui/overview.css')+'?v=20261125-mode-halo1'}),E('section',{'class':'ch-card'},[E('h3',{},['Cellular']),body])]);
 let pending=false,livePending=false,mounted=false,snapshot=null,latestSIM=null;
 function visible(){
  if(!node.isConnected){if(mounted){poll.remove(refresh);poll.remove(refreshLive);}return false;}
  mounted=true;return !document.hidden;
 }
 function rememberSIM(info){
  if(!info?.cards||(latestSIM?.updated&&info.updated&&info.updated<latestSIM.updated))return;
  // A temporarily unknown slot is not evidence that an established data link vanished.
  // Fall back to the current QModem/netifd snapshot until SIM state is known again.
  const cards=Object.values(info.cards);
  latestSIM=info.running!==false&&!info.cards[info.active]&&cards.length&&cards.every(c=>c.presence==='unknown')?null:info;
 }
 function renderSnapshot(){
  if(!snapshot||snapshot.id!==getModem()?.id||!node.isConnected)return;
  const open=body.querySelector('details')?.open===true;
  const data=context.applyLiveSIM({modems:[snapshot],primaryModem:snapshot},latestSIM);
  context.selectedModemId=snapshot.id;dom.content(body,context.renderModems(data.modems));
  if(open&&body.querySelector('details'))body.querySelector('details').open=true;
 }
 const refresh=async()=>{
  if(pending||!visible())return;const modem=getModem();if(!modem){snapshot=null;dom.content(body,[E('p',{'class':'ch-muted'},['No modem detected.'])]);return;}
  if(snapshot&&snapshot.id!==modem.id){snapshot=null;dom.content(body,['Reading cellular connection…']);}
  pending=true;
  try{await uci.load(['qmodem','network']);const [dump,sim]=await Promise.all([L.resolveDefault(interfaces(),{}),L.resolveDefault(simStatus(),null)]);rememberSIM(sim);const data=await context.fetchModem(modem,dump);if(getModem()?.id!==modem.id)return;snapshot=data;renderSnapshot();}
  catch(error){if(!snapshot)dom.content(body,[E('p',{'class':'ch-muted'},['Cellular information is temporarily unavailable.'])]);}
  finally{pending=false;}
 };
 const refreshLive=async()=>{
  if(livePending||!visible())return;livePending=true;
  try{rememberSIM(await L.resolveDefault(simStatus(),null));renderSnapshot();}
  finally{livePending=false;}
 };
 requestAnimationFrame(refresh);poll.add(refresh,15);poll.add(refreshLive,2);return {node,refresh};
}});

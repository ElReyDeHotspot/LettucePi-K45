'use strict';
'require baseclass';
function reading(s){
 const drive=s?.available&&typeof s.drive_percent==='number'&&Number.isFinite(s.drive_percent)?Math.max(0,Math.min(100,s.drive_percent)):null;
 if(drive!=null)return {drive,value:drive+'%',unit:'',detail:s.boost?'Cooling Protection · Full Output':drive===0?(s.mode==='2'?'Automatic · Below Threshold':s.mode==='1'?'Fan Output Not Applied':'Fan Off'):'',duration:drive===0?0:Math.max(.4,4-drive*.036)};
 return {drive:null,value:'—',unit:'',detail:'Fan Reading Unavailable',duration:0};
}
return baseclass.extend({reading,create(){
 const asset=L.resource('chester-ui/fan-cooling-v1.png'),picture=()=>E('img',{'class':'fv-fan-art',src:asset,alt:'',draggable:'false',decoding:'async'}),frame=E('div',{'class':'fv-frame','aria-hidden':'true'},[picture()]),rotor=E('div',{'class':'fv-rotor','aria-hidden':'true'},[picture()]);
 const ring=E('div',{'class':'fv-ring','aria-hidden':'true'});ring.innerHTML='<svg viewBox="0 0 200 200"><circle class="fv-gauge-track" cx="100" cy="100" r="91"/><circle class="fv-gauge-level" cx="100" cy="100" r="91" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>';
 const gauge=ring.querySelector('.fv-gauge-level');

 const menu=E('div',{'class':'fv-side-menu'}),power=E('div',{'class':'fv-power-slot'});const value=E('strong',{},['—']),detail=E('p',{'class':'fv-detail'},['Reading Fan…']),telemetry=E('div',{'class':'fv-telemetry'}),presets=E('div',{'class':'fv-under-fan'}),node=E('section',{'class':'fv-card','aria-label':'Live Fan Status'},[E('div',{'class':'fv-fan-column'},[menu,E('div',{'class':'fv-orbit'},[frame,rotor,ring,E('div',{'class':'fv-reading',role:'status','aria-live':'polite'},[value])]),presets]),E('div',{'class':'fv-info'},[E('div',{'class':'fv-caption'},['LIVE COOLING']),E('h3',{'class':'fv-title'},['Cooling Status']),power,detail,telemetry])]);let animation=null;const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 return {node,telemetry,presets,menu,power,update(s){const r=reading(s);value.textContent=r.value;detail.textContent=r.detail;detail.hidden=!r.detail;node.classList.toggle('is-stopped',r.duration===0);node.classList.toggle('is-unavailable',r.drive==null);gauge.setAttribute('stroke-dashoffset',String(100-(r.drive||0)));if(!animation&&r.duration>0&&typeof rotor.animate==='function')animation=rotor.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:1000,iterations:Infinity});if(animation){if(r.duration===0||reduced?.matches||document.hidden)animation.pause();else{animation.playbackRate=1/r.duration;animation.play();}}}};

}});

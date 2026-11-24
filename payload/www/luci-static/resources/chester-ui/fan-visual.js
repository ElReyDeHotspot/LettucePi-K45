'use strict';
'require baseclass';
function reading(s){
 const drive=s?.available&&typeof s.drive_percent==='number'&&Number.isFinite(s.drive_percent)?Math.max(0,Math.min(100,s.drive_percent)):null;
 if(drive!=null)return {drive,value:drive+'%',unit:'Output',detail:s.boost?'Cooling Protection · Full Output':drive===0?(s.mode==='2'?'Automatic · Below Threshold':s.mode==='1'?'Fan Output Not Applied':'Fan Off'):'Live Fan Output',duration:drive===0?0:Math.max(.4,4-drive*.036)};
 return {drive:null,value:'—',unit:'Output',detail:'Fan Reading Unavailable',duration:0};
}
return baseclass.extend({reading,create(){
 const rotor=E('div',{'class':'fv-rotor','aria-hidden':'true'});let blades='';for(let i=0;i<7;i++)blades+='<path transform="rotate('+(i*360/7)+' 100 100)" d="M94 94C76 79 67 53 75 32C80 17 99 12 112 21C127 31 130 48 121 63C114 75 103 81 105 96Z"/>';
 rotor.innerHTML='<svg viewBox="0 0 200 200"><defs><linearGradient id="fv-blade-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#87c6ff"/><stop offset=".45" stop-color="#409cff"/><stop offset="1" stop-color="#076bd8"/></linearGradient></defs><g fill="url(#fv-blade-gradient)" stroke="#c5e4ff" stroke-opacity=".18" stroke-width=".8">'+blades+'</g></svg>';
 let ticks='';for(let i=0;i<36;i++)ticks+='<line x1="100" y1="3" x2="100" y2="'+(i%3===0?9:6)+'" transform="rotate('+(i*10)+' 100 100)"/>';const ring=E('div',{'class':'fv-ring','aria-hidden':'true'});ring.innerHTML='<svg viewBox="0 0 200 200"><g class="fv-dial-ticks">'+ticks+'</g><circle class="fv-gauge-track" cx="100" cy="100" r="91"/><circle class="fv-gauge-level" cx="100" cy="100" r="91" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/><circle class="fv-bolt" cx="16" cy="16" r="2"/><circle class="fv-bolt" cx="184" cy="16" r="2"/><circle class="fv-bolt" cx="16" cy="184" r="2"/><circle class="fv-bolt" cx="184" cy="184" r="2"/></svg>';
 const gauge=ring.querySelector('.fv-gauge-level');

 const value=E('strong',{},['—']),unit=E('span',{},['Output']),detail=E('p',{'class':'fv-detail'},['Reading Fan…']),telemetry=E('div',{'class':'fv-telemetry'}),node=E('section',{'class':'fv-card','aria-label':'Live Fan Status'},[E('div',{'class':'fv-orbit'},[ring,rotor,E('div',{'class':'fv-reading',role:'status','aria-live':'polite'},[value,unit])]),E('div',{'class':'fv-info'},[E('div',{'class':'fv-caption'},['LIVE COOLING']),E('h3',{'class':'fv-title'},['Cooling Status']),detail,telemetry])]);let animation=null;const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 return {node,telemetry,update(s){const r=reading(s);value.textContent=r.value;unit.textContent=r.unit;detail.textContent=r.detail;node.classList.toggle('is-stopped',r.duration===0);node.classList.toggle('is-unavailable',r.drive==null);gauge.setAttribute('stroke-dashoffset',String(100-(r.drive||0)));if(!animation&&r.duration>0&&typeof rotor.animate==='function')animation=rotor.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:1000,iterations:Infinity});if(animation){if(r.duration===0||reduced?.matches||document.hidden)animation.pause();else{animation.playbackRate=1/r.duration;animation.play();}}}};

}});

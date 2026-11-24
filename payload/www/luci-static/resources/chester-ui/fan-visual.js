'use strict';
'require baseclass';
function reading(s){
 const drive=s?.available&&typeof s.drive_percent==='number'&&Number.isFinite(s.drive_percent)?Math.max(0,Math.min(100,s.drive_percent)):null;
 if(drive!=null)return {value:drive+'%',unit:'Fan Drive',detail:s.boost?'Cooling Protection · Full Output':drive===0?(s.mode==='2'?'Automatic · Below Threshold':s.mode==='1'?'Fan Output Not Applied':'Fan Off'):'Live Fan Output',duration:drive===0?0:Math.max(.4,4-drive*.036)};
 return {value:'—',unit:'Fan Drive',detail:'Fan Reading Unavailable',duration:0};
}
return baseclass.extend({reading,create(){
 const rotor=E('div',{'class':'fv-rotor','aria-hidden':'true'});rotor.innerHTML='<svg viewBox="0 0 200 200" fill="currentColor"><path d="M100 100C46 95 25 63 43 38c17-23 49-13 58 17 5 16 2 31-1 45Zm0 0c5-54 37-75 62-57 23 17 13 49-17 58-16 5-31 2-45-1Zm0 0c54 5 75 37 57 62-17 23-49 13-58-17-5-16-2-31 1-45Zm0 0c-5 54-37 75-62 57-23-17-13-49 17-58 16-5 31-2 45 1Z"/></svg>';
 const value=E('strong',{},['—']),unit=E('span',{},['Fan Drive']),detail=E('p',{'class':'fv-detail'},['Reading Fan…']),node=E('section',{'class':'fv-card','aria-label':'Live Fan Status'},[E('div',{'class':'fv-caption'},['LIVE COOLING']),E('div',{'class':'fv-orbit'},[E('div',{'class':'fv-ring'}),rotor,E('div',{'class':'fv-reading',role:'status','aria-live':'polite'},[value,unit])]),detail]);let animation=null,lastDuration=null;
 return {node,update(s){const r=reading(s);value.textContent=r.value;unit.textContent=r.unit;detail.textContent=r.detail;node.classList.toggle('is-stopped',r.duration===0);if(r.duration!==lastDuration){lastDuration=r.duration;if(!animation&&typeof rotor.animate==='function')animation=rotor.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:1000,iterations:Infinity});if(animation){if(r.duration===0)animation.pause();else{animation.playbackRate=1/r.duration;animation.play();}}}}};
}});

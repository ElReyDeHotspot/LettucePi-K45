/* Chester Sun / Night. Runs in <head> before CSS to avoid a light flash. */
(function () {
 'use strict';
 const key='chester-appearance',root=document.documentElement;
 let current='sun',buttons=[];
 const valid=value=>value==='night'?'night':'sun';
 try{current=valid(localStorage.getItem(key));}catch(e){}
 function apply(value,persist){
  current=valid(value);root.dataset.chesterAppearance=current;
  root.style.colorScheme=current==='night'?'dark':'light';
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appearance===current)));
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=current==='night'?'#12202e':'#f8faff';
  if(persist)try{localStorage.setItem(key,current);}catch(e){}
  window.dispatchEvent(new CustomEvent('chester:appearance',{detail:{appearance:current}}));
 }
 apply(current,false);
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.newValue,false);});
 function mount(){
  if(document.querySelector('.chester-appearance'))return;
  const group=document.createElement('div');group.className='chester-appearance';group.setAttribute('role','group');group.setAttribute('aria-label','Appearance');
  const paths={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',night:'<path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z"/>'};
  buttons=['sun','night'].map(mode=>{
   const button=document.createElement('button');button.type='button';button.dataset.appearance=mode;
   button.setAttribute('aria-label',mode==='sun'?'Sun — light appearance':'Night — dark appearance');button.title=mode==='sun'?'Sun · Light':'Night · Dark';
   button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[mode]+'</svg>';
   button.addEventListener('click',()=>apply(mode,true));group.appendChild(button);return button;
  });
  group.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const mode=event.key==='Home'?'sun':event.key==='End'?'night':current==='sun'?'night':'sun';apply(mode,true);buttons[mode==='night'?1:0].focus();
  });
  const bar=document.querySelector('header .topbar-right');
  if(bar&&!document.body.classList.contains('node-main-login'))bar.insertBefore(group,bar.firstChild);
  else{group.classList.add('chester-appearance-floating');document.body.appendChild(group);}
  apply(current,false);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

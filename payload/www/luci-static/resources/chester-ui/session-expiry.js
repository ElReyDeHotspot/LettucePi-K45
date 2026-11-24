/* Keep LuCI session expiry and navigation intact; decorate only its dialog. */
(function(){
 'use strict';
 const original=LuCI.prototype.notifySessionExpiry;
 LuCI.prototype.notifySessionExpiry=function(){
  try{return original.apply(this,arguments);}
  finally{
   const modal=document.querySelector('#modal_overlay > .modal');
   if(modal){
    modal.classList.add('chester-session-expired');
    const message=modal.querySelector('.alert-message'),old=modal.querySelector('.right .btn');
    if(message){message.className='chester-session-message';message.textContent='Your session has ended. Sign in again to continue.';}
    const icon=document.createElement('div');icon.className='chester-session-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg>';modal.prepend(icon);
    if(old){const button=document.createElement('button');button.type='button';button.className='chester-session-login';button.textContent='Sign in Again';button.addEventListener('click',()=>old.click());old.replaceWith(button);button.focus();}
   }
  }
 };
})();

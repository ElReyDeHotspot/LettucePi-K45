'use strict';
'require baseclass';
// One request at a time; replace intermediate slider positions with the latest choice.
return baseclass.extend({create(options){
 let timer=null,running=false,pending=null,revision=0;
 const schedule=options.setTimer||setTimeout,cancel=options.clearTimer||clearTimeout;
 async function drain(){
  if(running||timer!=null)return;
  running=true;
  try{while(pending&&timer==null){
   const job=pending;pending=null;options.onState?.('applying');
   try{
    const result=await options.apply(job.settings);
    if(!result?.success)throw new Error(result?.error||'The fan output could not be confirmed.');
    options.onApplied?.(result,job.settings,job.revision===revision);
    if(job.revision===revision)options.onState?.('applied');
   }catch(error){if(job.revision===revision)options.onState?.('error',error);}
  }}finally{running=false;}
 }
 return {
  request(settings,delay){
   pending={settings:{...settings},revision:++revision};
   if(timer!=null){cancel(timer);timer=null;}
   if(delay>0){options.onState?.('pending');timer=schedule(()=>{timer=null;void drain();},delay);return;}
   return drain();
  },
  busy(){return running||timer!=null||pending!=null;},
  version(){return revision;}
 };
}});

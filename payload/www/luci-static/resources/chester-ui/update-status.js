'use strict';
'require baseclass';
function describe(info){
 info=info||{};
 const verified=info.release_verified===true;
 const available=verified&&info.update_available===true;
 const rev=/^[0-9]{1,4}$/.test(String(info.latest_rev||''))?String(info.latest_rev):'';
 if(available)return {available:true,label:'Update Available',detail:rev?'Rev. '+rev:'New Release',title:'Update Available'+(rev?' — Rev. '+rev:'')};
 if(info.checking===true)return {available:false,label:'Checking…',detail:'',title:'Checking for a signed firmware update'};
 if(verified)return {available:false,label:'Up to Date',detail:'',title:'Your installed firmware is up to date'};
 return {available:false,label:'Check Unavailable',detail:'',title:'Could not check for updates. Open System Update to try again.'};
}
return baseclass.extend({describe});

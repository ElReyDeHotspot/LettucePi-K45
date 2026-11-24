#!/usr/bin/ucode
'use strict';
import {glob,readfile,unlink} from 'fs';
import {cursor} from 'uci';
function number(path){let s=trim(readfile(path)||'');return match(s,/^[0-9]+$/)?int(s):null;}
function runtime(){try{return json(readfile('/tmp/chester-fan/status.json')||'{}');}catch(e){return {};}}
function status(){
 let u=cursor(),run=runtime(),mode=u.get('misectel','main','fan_mode')||'1';
 for(let node in glob('/sys/class/hwmon/hwmon*')){
  let name=trim(readfile(node+'/name')||'');if(name!='pwmfan'&&name!='pwm-fan')continue;
  let pwm=number(node+'/pwm1'),enabled=number(node+'/pwm1_enable');
  if(pwm!=null&&(pwm<0||pwm>255))pwm=null;
  return {available:true,pwm:pwm,enabled:enabled,drive_percent:pwm==null||enabled==null?null:enabled==0?0:int(pwm*100/255.0+0.5),mode:mode,threshold:int(u.get('misectel','main','fan_temp_threshold')||70),controller:run.ready==true&&time()-int(run.updated||0)<15,boost:run.boost==1};
 }
 return {available:false,drive_percent:null,mode:mode};
}
return {'chester.fan':{
 status:{call:()=>status()},
 save:{args:{settings:'String'},call:function(req){
  if(length(req.args.settings||'')>1024)return {success:false,error:'Fan settings are too large.'};
  let a;try{a=json(req.args.settings);}catch(e){return {success:false,error:'Invalid fan settings.'};}
  if(type(a)!='object'||index(['0','1','2'],a.mode)<0||type(a.percent)!='string'||(a.percent!=''&&(!match(a.percent,/^[1-9][0-9]{1,2}$/)||int(a.percent)<20||int(a.percent)>100)))return {success:false,error:'Choose a valid cooling mode and output from 20% to 100%.'};
  if(a.mode=='2'&&(type(a.threshold)!='string'||!match(a.threshold,/^[0-9]{1,3}$/)||int(a.threshold)<1||int(a.threshold)>150))return {success:false,error:'Choose a valid automatic temperature threshold.'};
  let u=cursor();if(!u.get('misectel','main'))return {success:false,error:'Fan configuration is missing.'};
  u.set('misectel','main','fan_mode',a.mode);u.set('misectel','main','fan_enabled',a.mode=='0'?'0':'1');
  if(a.percent!='')u.set('misectel','main','fan_speed_percent',a.percent);
  if(a.mode=='2')u.set('misectel','main','fan_temp_threshold',a.threshold);
  if(!u.save('misectel')||!u.commit('misectel'))return {success:false,error:'Could not save the fan settings.'};
  let percent=u.get('misectel','main','fan_speed_percent'),duty=percent?int((int(percent)*255+50)/100):100,started=time();
  unlink('/tmp/chester-fan/status.json');
  if(system('/etc/init.d/misectel-fan-control restart >/dev/null 2>&1')!=0)return {success:false,error:'Settings were saved, but the fan controller could not restart.'};
  for(let attempt=0;attempt<8;attempt++){
   let r=runtime(),s=status();
   if(r.ready==true&&r.updated>=started&&r.mode==a.mode&&r.setting_pwm==duty&&(a.mode!='2'||r.threshold==int(a.threshold))&&s.pwm==r.requested_pwm&&s.enabled==(r.requested_pwm>0?1:0))return {success:true,status:s};
   system('sleep 1');
  }
  return {success:false,error:'Settings were saved, but the fan output was not confirmed. The controller has not reported a successful apply.'};
 }}
}};

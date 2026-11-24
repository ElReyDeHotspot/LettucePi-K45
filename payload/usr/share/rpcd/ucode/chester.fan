#!/usr/bin/ucode
'use strict';
import {glob,readfile} from 'fs';
function number(path){let s=trim(readfile(path)||'');return match(s,/^[0-9]+$/)?int(s):null;}
return {'chester.fan':{status:{call:function(){
 for(let node in glob('/sys/class/hwmon/hwmon*')){
  let name=trim(readfile(node+'/name')||'');if(name!='pwmfan'&&name!='pwm-fan')continue;
  let pwm=number(node+'/pwm1'),enabled=number(node+'/pwm1_enable');
  if(pwm!=null&&(pwm<0||pwm>255))pwm=null;
  return {available:true,pwm:pwm,enabled:enabled,drive_percent:pwm==null||enabled==null?null:enabled==0?0:int(pwm*100/255.0+0.5)};
 }
 return {available:false,drive_percent:null};
}}}};

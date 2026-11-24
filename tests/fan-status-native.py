"""Emit isolated ucode tests for fan readings, validation and hardware-confirmed saves."""
from pathlib import Path
import re
source=(Path(__file__).resolve().parents[1]/'payload/usr/share/rpcd/ucode/chester.fan').read_text(encoding='utf-8').split('\n',1)[1]
source=re.sub(r"^import .*?;\n", "", source, flags=re.M)
prelude='''let pwm='100',enabled='1',present=true,ready=true,requested=255,writes=0;
let config={fan_mode:'1',fan_temp_threshold:'70',fan_speed_percent:'100'};
function unlink(path){return true;}
function system(command){return 0;}
function sleep(milliseconds){return true;}
function cursor(){return {get:(a,b,c)=>c==null?'main':config[c],set:(a,b,c,v)=>{writes++;config[c]=v;},save:()=>true,commit:()=>true};}
function glob(path){return present?['/mock/fan']:[];}
function readfile(path){
 if(path=='/tmp/chester-fan/status.json')return sprintf('%J',{ready:ready,mode:config.fan_mode,setting_pwm:255,requested_pwm:requested,threshold:int(config.fan_temp_threshold),updated:time()});
 return path=='/mock/fan/name'?'pwmfan':path=='/mock/fan/pwm1'?pwm:path=='/mock/fan/pwm1_enable'?enabled:null;
}
'''
source=prelude+source.replace("return {'chester.fan':", "let api={'chester.fan':")
source+='''
function check(ok,message){if(!ok)die(message+'\\n');}
for(let pair in [[51,20],[94,37],[100,39],[102,40],[153,60],[255,100]]){pwm=sprintf('%d',pair[0]);let s=api['chester.fan'].status.call();check(s.drive_percent==pair[1],'PWM percentage rounding failed');}
for(let bad in [{mode:'3',percent:'40'},{mode:'1',percent:'19'},{mode:'1',percent:'101'},{mode:'1',percent:'37.5'},{mode:'2',percent:'40',threshold:'0'},{mode:'2',percent:'40',threshold:'151'}])check(!api['chester.fan'].save.call({args:{settings:sprintf('%J',bad)}}).success,'Invalid settings accepted');
check(writes==0,'Invalid settings wrote config');
let request={args:{settings:sprintf('%J',{mode:'1',percent:'100',threshold:'70'})}};
pwm='0';check(!api['chester.fan'].save.call(request).success,'Save succeeded despite missing hardware output');
pwm='255';ready=false;check(!api['chester.fan'].save.call(request).success,'Save succeeded without controller confirmation');
ready=true;check(api['chester.fan'].save.call(request).success,'Confirmed hardware output was rejected');
enabled='0';check(api['chester.fan'].status.call().drive_percent==0,'Off is not zero');enabled='1';pwm='bad';check(api['chester.fan'].status.call().drive_percent==null,'Invalid output became a value');present=false;check(!api['chester.fan'].status.call().available,'Missing fan reported available');
print('PASS native fan: rounding, invalid settings write nothing, success requires matching hardware output and controller confirmation.\\n');
'''
print(source)

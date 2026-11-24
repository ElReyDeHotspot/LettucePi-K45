"""Emit ucode checks for live PWM percentage rounding without hardware writes."""
from pathlib import Path
source=(Path(__file__).resolve().parents[1]/'payload/usr/share/rpcd/ucode/chester.fan').read_text(encoding='utf-8')
source=source.replace("import {glob,readfile} from 'fs';", """let pwm='100',enabled='1',present=true;
function glob(path){return present?['/mock/fan']:[];}
function readfile(path){return path=='/mock/fan/name'?'pwmfan':path=='/mock/fan/pwm1'?pwm:path=='/mock/fan/pwm1_enable'?enabled:null;}
""").replace("return {'chester.fan':", "let api={'chester.fan':")
source+="""
function check(ok,message){if(!ok)die(message+'\\n');}
for(let pair in [[51,20],[94,37],[100,39],[102,40],[153,60],[255,100]]){pwm=sprintf('%d',pair[0]);let s=api['chester.fan'].status.call();check(s.drive_percent==pair[1],'PWM percentage rounding failed');}
enabled='0';check(api['chester.fan'].status.call().drive_percent==0,'Off is not zero');enabled='1';pwm='bad';check(api['chester.fan'].status.call().drive_percent==null,'Invalid output became a value');present=false;check(!api['chester.fan'].status.call().available,'Missing fan reported as available');print('PASS native fan status: percentage rounding, Off, invalid readings and absent sensors.\\n');
"""
print(source)

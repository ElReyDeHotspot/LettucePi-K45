"""Generate isolated ucode cases; no production update cache is fabricated."""
from pathlib import Path
import re
source=(Path(__file__).resolve().parents[1]/'payload/usr/share/rpcd/ucode/chester.update').read_text(encoding='utf-8').split('\n',1)[1]
source=re.sub(r'^import .*?;\n','',source,flags=re.M)
source=source.replace("return {'chester.update':{status:{call:()=>status()}}};",'')
prelude='''let cached={},refreshes=0;
function time(){return 2000000000;}
function readfile(path){if(path=='/etc/chester-version')return 'build=202611240003\\nbin=15\\n';return cached=='malformed'?'{bad':sprintf('%J',cached);}
function system(command){refreshes++;return 0;}
function check(ok,message){if(!ok)die(message+'\\n');}
'''
cases='''
let s=status();check(s.checking&&refreshes==1,'Empty cache must refresh without claiming current');
cached={ok:true,release_verified:true,checked_at:time(),latest_build:'202611240003',latest_bin:'15'};
s=status();check(s.release_verified&&!s.update_available&&!s.checking,'Equal signed build must be current');
cached.latest_build='202611240004';cached.latest_bin='16';s=status();check(s.update_available&&s.latest_rev=='16','New signed release must be available');
cached.release_verified=false;s=status();check(!s.update_available&&!s.release_verified,'Unsigned results must not advertise an update');
cached.release_verified=true;cached.latest_build='202611240002';s=status();check(!s.release_verified,'Older build cannot be labelled current');
cached.latest_build='invalid';s=status();check(!s.release_verified,'Malformed build must not be trusted');
cached={ok:false,checked_at:time()};s=status();check(!s.checking&&!s.release_verified,'Failed check must stay unavailable');
cached.checked_at=time()-61;s=status();check(s.checking,'Failed checks must retry promptly after Internet returns');
cached.checked_at=time()+100;s=status();check(s.checking,'Future timestamps must be refreshed');
cached='malformed';s=status();check(s.checking&&!s.release_verified,'Malformed cache must be refreshed');
print('PASS native Home update status: signed newer/current, invalid, failed, stale and clock-change cases.\\n');
'''
print(prelude+source+cases)

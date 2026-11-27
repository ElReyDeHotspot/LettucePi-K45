"""Emit capability tests for execution by native ucode, without router writes."""
from pathlib import Path
import re
source=(Path(__file__).resolve().parents[1]/'payload/usr/share/rpcd/ucode/chester.mlo').read_text().split('\n',1)[1]
source=re.sub(r'^import .*?;\n','',source,flags=re.M)
source=source.replace("return {'chester.mlo':", "let api={'chester.mlo':")
print("""let files={
 '/tmp/sysinfo/board_name':'misectel,m02k45',
 '/lib/netifd/wireless.uc':'mlo_vif_create parse_array(data.device) hostapd_update_mlo',
 '/usr/share/hostap/hostapd.uc':'mld_set:',
 '/usr/share/ucode/wifi/ap.uc':'mld_ap=1'
};
function readfile(path){return files[path];}
"""+source+"""
function check(ok,message){if(!ok)die(message+'\\n');}
check(api['chester.mlo'].status.call().supported,'Supported stack rejected');
for(let path in keys(files)){
 let saved=files[path];files[path]='';
 check(!api['chester.mlo'].status.call().supported,'Missing capability accepted: '+path);
 files[path]=saved;
}
files['/tmp/sysinfo/board_name']='misectel,m01k43';
check(!api['chester.mlo'].status.call().supported,'Wrong board accepted');
print('PASS native MLO: exact board and all required installed-stack markers.\\n');
""")

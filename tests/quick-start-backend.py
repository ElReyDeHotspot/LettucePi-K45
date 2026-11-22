from pathlib import Path
import sys
repo=Path(__file__).resolve().parents[1]
src=(repo/'payload/usr/share/rpcd/ucode/misectel_setup_wizard').read_text(encoding='utf-8')
def fn(name,nextname):return src[src.index('function '+name+'('):src.index('function '+nextname+'(')]
code='''let calls=[],sim={supported:true,busy:false},pending=null;
let timezones={'America/New_York':'EST5EDT,M3.2.0,M11.1.0'};
function readfile(path){return path=='/tmp/chester-sim/state.json'?sprintf('%J',sim):pending;}
function readWirelessRadios(){return [{name:'radio0',section:'ap0'},{name:'radio1',section:'ap1'}];}
function readManagedWanConfig(){return {role:'wan',device:'wan'};}
function findModemSections(){return ['modem0'];}
function runCommand(command){push(calls,command);return {result:true,code:0};}
function check(condition,message){if(!condition)die(message+'\\n');}
'''
code+=fn('quoteArg','trimSafe')+fn('trimSafe','parseInteger')+fn('parseJsonSafe','parseCpinStatus')+fn('validProtocol','validEncryption')+fn('validEncryption','normalizeListValue')+fn('validateWifiEntries','applyNetworkConfig')+fn('applyWifiConfig','applyAdminConfig')+fn('applyAdminConfig','scheduleRuntimeReload')+fn('validWizardIpv4','validateWizardDraft')+fn('validateWizardDraft','applyChesterExtras')+fn('applyChesterExtras','applySetupWizardConfig')
code+='''
let draft={wizard:{skipped_admin:true},admin:{skipped:true},network:{wan_role:'wan',wan_device:'wan',optional_wan_mode:'wan',proto:'dhcp'},wifi:{enabled:false,linked_bands:true,radios:[{name:'radio0',section:'ap0',ssid:'',key:''},{name:'radio1',section:'ap1',ssid:'',key:''}]},chester:{sim_slot:'2',apn:'vzwinternet',ttl_enabled:true,ttl:65,hl:66,zonename:'America/New_York'}};
check(validateWizardDraft(draft)==null,'valid disabled Wi-Fi draft rejected');
draft.chester.ttl=256;check(validateWizardDraft(draft)!=null,'invalid TTL accepted');draft.chester.ttl=65;
draft.chester.sim_slot='3';check(validateWizardDraft(draft)!=null,'invalid SIM accepted');draft.chester.sim_slot='2';
draft.chester.apn='bad; command';check(validateWizardDraft(draft)!=null,'invalid APN accepted');draft.chester.apn='vzwinternet';
draft.wifi.radios[0].section='arbitrary';check(validateWizardDraft(draft)!=null,'foreign Wi-Fi section accepted');draft.wifi.radios[0].section='ap0';
draft.wifi.enabled=true;check(validateWizardDraft(draft)!=null,'empty Wi-Fi credentials accepted');draft.wifi.enabled=false;
sim.busy=true;check(validateWizardDraft(draft)!=null,'busy SIM accepted');sim.busy=false;
check(length(calls)==0,'validation performed writes');
check(applyWifiConfig(draft.wifi,draft.wifi.radios).result,'Wi-Fi disable failed');
let cmd=calls[0];check(index(cmd,"wireless.radio0.disabled='1'")>=0&&index(cmd,"wireless.radio1.disabled='1'")>=0&&index(cmd,"wireless.ap0.disabled='1'")>=0&&index(cmd,"wireless.ap1.disabled='1'")>=0,'radio/AP disable flags missing');
calls=[];check(applyChesterExtras(draft.chester).result,'extras failed');
check(index(calls[0],"chester_sim.main.mode='manual'")>=0&&index(calls[0],"chester_sim.main.preferred='2'")>=0&&index(calls[0],"chester_sim.main.apn2='vzwinternet'")>=0,'SIM/APN policy not persisted');
check(index(calls[0],"EST5EDT,M3.2.0,M11.1.0")>=0,'server timezone not used');
check(index(calls[1],'chester-ttl apply 1 65 66')>=0,'TTL/HL helper not used');
check(index(calls[2],'request.json')>=0&&index(calls[2],'switch')>=0,'manual selection not queued');
calls=[];check(applyAdminConfig({password:' keep spaces ',skipped:false}).result,'password helper failed');check(index(calls[0],"' keep spaces '")>=0,'password spaces lost');
print('PASS Quick Start: validation before writes, SIM/APN policy, verified TTL/HL helper, radio + AP disable, timezone lookup, password whitespace. All system operations mocked.\\n');
'''
Path(sys.argv[1]).write_text(code,encoding='utf-8',newline='\n')
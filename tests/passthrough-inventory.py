#!/usr/bin/env python3
"""Generate a native-ucode test of physical inventory and uplink protection."""
from pathlib import Path
import sys
s=(Path(__file__).resolve().parents[1]/'payload/usr/share/rpcd/ucode/misectel.interface').read_text()
helpers=s[s.index('function list(value)'):s.index('function clean(section)')]
validation=s[s.index('function validIpv4('):s.index('function uciQuote(')]
code='''let mode = 'wan', disabled = '0';
let board = { network: { wan: {device:'wan'}, lan:{ports:['lan1','lan2','lan3']} } };
const PROVIDERS = ['qmodem_passthrough','vxlan'];
const wifi = { validate: () => [] };
function readText(path) { return sprintf('%J', board); }
function command(cmd) { return {output:''}; }
function cursor() { return {get: (config, section, option) => {
 if (option == 'wan_role') return 'wan';
 if (option == 'optional_wan_mode') return mode;
 if (config == 'network' && section == 'wan' && option == 'disabled') return disabled;
 return null;
}, foreach: () => null}; }
'''+helpers+validation+'''
function check(condition, message) { if (!condition) die(message); }
let ports=inventory();check(ports[0].device=='wan' && length(ports)==4, 'WAN must be first');
check(!ports[0].assignable && ports[0].role=='wan', 'live uplink must not be assignable');
let config={global:{api_version:'1',revision:'1',apply_timeout:'90'},assignments:[{id:'qmodem_modemA',provider:'qmodem_passthrough',instance:'modemA',enabled:'1',desired_port:['wan']}]};
check(length(validateConfig(config))>0,'uplink claim must be rejected before apply');
mode='lan';check(!inventory()[0].assignable,'mode change must wait for disabled WAN interface');
disabled='1';check(inventory()[0].assignable,'LAN-mode WAN should be assignable');
check(length(validateConfig(config))==0,'LAN-mode WAN should pass validation');
config.assignments[0].desired_port=['lan1','lan2'];check(length(validateConfig(config))>0,'multiple ports must be rejected');
config.assignments[0].desired_port=['lan1'];config.assignments[0].desired_wifi=['ap1'];check(length(validateConfig(config))>0,'port plus Wi-Fi must be rejected');
config.assignments[0].desired_wifi=[];check(length(validateConfig(config))==0,'single port must remain valid');
board.network.lan.ports=['wan','lan1','lan2','lan3'];check(length(inventory())==4,'WAN must not be duplicated');
print('PASS WAN inventory: WAN first, no duplicates, uplink claim rejected, LAN mode available only after interface handoff.\\n');
'''
Path(sys.argv[1]).write_text(code,encoding='utf-8',newline='\n')

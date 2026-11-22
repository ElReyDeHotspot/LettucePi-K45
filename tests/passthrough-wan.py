#!/usr/bin/env python3
"""Check WAN handoff and boot ownership without touching a real interface."""
from pathlib import Path
import json,os,subprocess,tempfile
repo=Path(__file__).resolve().parents[1]
apply=(repo/'payload/usr/libexec/misectel-interface-apply').read_text()
a=apply.index('port_allowed() {');port_allowed=apply[a:apply.index('\n}\n',a)+3]
optional=(repo/'payload/etc/init.d/misectel-optional-wan').read_text()
role_functions=optional[optional.index('port_is_managed() {'):optional.index('\nstart() {')]
with tempfile.TemporaryDirectory(prefix='chester-wan-role-') as temp:
 root=Path(temp);state=root/'uci.json';log=root/'calls';uci=root/'uci';sysfs=root/'sys';(sysfs/'wan').mkdir(parents=True);(sysfs/'wan/type').write_text('1\n')
 uci.write_text('''#!/usr/bin/env python3
import json,os,sys
p=os.environ['TEST_STATE'];d=json.load(open(p));a=[x for x in sys.argv[1:] if x!='-q'];op=a[0]
if op=='get':
 if a[1] not in d:sys.exit(1)
 print(d[a[1]])
elif op=='show':
 for k,v in d.items():
  if k.startswith(a[1]+'.'):print(k+'='+v)
elif op=='set':
 k,v=a[1].split('=',1);d[k]=v;json.dump(d,open(p,'w'))
elif op=='delete':
 if a[1] not in d:sys.exit(1)
 del d[a[1]];json.dump(d,open(p,'w'))
elif op!='commit':sys.exit(2)
''');uci.chmod(0o755)
 env={**os.environ,'TEST_STATE':str(state),'TEST_UCI':str(uci),'TEST_SYSFS':str(sysfs),'TEST_LOG':str(log)}
 base={'misectel.network_defaults.wan_role':'wan','misectel.network_defaults.optional_wan':'wan','misectel.network_defaults.optional_wan_mode':'lan','misectel.main.product_mode':'router','network.wan.disabled':'1','misectel_interface.modemA':'assignment','misectel_interface.modemA.enabled':'1','misectel_interface.modemA.desired_port':'lan2 wan'}
 script=root/'test.sh'
 script.write_text('''#!/bin/bash
set -e
uci(){ "$TEST_UCI" "$@"; }
logger(){ :; }
add_port_to_lan(){ echo add >> "$TEST_LOG"; }
remove_port_from_lan(){ echo remove >> "$TEST_LOG"; }
ensure_wan_firewall(){ echo wan >> "$TEST_LOG"; }
remove_wan_firewall(){ echo no-wan >> "$TEST_LOG"; }
'''+role_functions+'\nreconcile_optional_wan\n')
 for mode,owned in [('lan',True),('wan',True),('lan',False),('wan',False)]:
  d=dict(base);d['misectel.network_defaults.optional_wan_mode']=mode;d['misectel_interface.modemA.enabled']='1' if owned else '0';state.write_text(json.dumps(d));log.write_text('')
  subprocess.run(['bash',str(script)],env=env,check=True);out=json.loads(state.read_text());calls=log.read_text().splitlines()
  if owned:
   assert 'add' not in calls and 'wan' not in calls
   assert out['misectel.network_defaults.optional_wan_mode']=='lan' and out['network.wan.disabled']=='1'
  elif mode=='lan':assert 'add' in calls and out['network.wan.disabled']=='1'
  else:assert 'wan' in calls and 'network.wan.disabled' not in out
 script.write_text('UCI="$TEST_UCI";SYSFS="$TEST_SYSFS";MISECTEL_INTERFACE_PORTS="wan lan1"\n'+port_allowed+'\nport_allowed wan\n')
 for mode,disabled,expected in [('wan','0',False),('lan','0',False),('lan','1',True)]:
  d=dict(base);d['misectel.network_defaults.optional_wan_mode']=mode;d['network.wan.disabled']=disabled;state.write_text(json.dumps(d))
  result=subprocess.run(['bash',str(script)],env=env)
  assert (result.returncode==0)==expected,(mode,disabled,result.returncode)
 (sysfs/'wan/type').write_text('65534\n');assert subprocess.run(['bash',str(script)],env=env).returncode!=0
print('PASS WAN roles: active uplink blocked, Ethernet LAN handoff allowed, assigned WAN preserved at boot and role reconciles without stealing it.')

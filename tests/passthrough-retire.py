#!/usr/bin/env python3
"""Exercise the actual bridge-retirement helper against an isolated UCI store."""
from pathlib import Path
import json, os, subprocess, tempfile

source=(Path(__file__).resolve().parents[1]/'payload/usr/libexec/misectel-interface-apply').read_text()
helper=source[source.index('retire_qmodem_interface_cb() {'):source.index('create_qmodem() {')]
with tempfile.TemporaryDirectory(prefix='chester-retire-') as temp:
 root=Path(temp);state=root/'state.json';uci=root/'uci';netdev=root/'netdev'
 uci.write_text('''#!/usr/bin/env python3
import json,os,sys
p=os.environ['TEST_UCI_STATE'];d=json.load(open(p));a=[x for x in sys.argv[1:] if x!='-q'];op=a[0]
if op=='get':
 if a[1] not in d:sys.exit(1)
 print(d[a[1]])
elif op=='set':
 k,v=a[1].split('=',1);d[k]=v;json.dump(d,open(p,'w'))
elif op=='delete':
 if a[1] not in d:sys.exit(1)
 del d[a[1]];json.dump(d,open(p,'w'))
else:sys.exit(2)
''')
 netdev.write_text('#!/bin/sh\n[ -n "$TEST_ENDPOINT" ] || exit 1\nprintf "%s\\n" "$TEST_ENDPOINT"\n')
 uci.chmod(0o755);netdev.chmod(0o755)
 harness=root/'run.sh'
 harness.write_text('''#!/bin/bash
set -e
UCI="$TEST_UCI";QMODEM_NETDEV="$TEST_NETDEV";NETWORK=network;CONFIG=misectel_interface
config_load(){ :; }
config_get(){ local result;result="$($UCI -q get "$NETWORK.$2.$3" || true)";printf -v "$1" '%s' "$result"; }
config_foreach(){ local section;for section in pcie0 pcie0v6 other customer;do "$1" "$section";done; }
valid_name(){ case "$1" in ''|*[!A-Za-z0-9_.:-]*) return 1;; esac; }
'''+helper+'\nretire_qmodem_network modemA "$TEST_BRIDGE_ARG"\n')
 base={'qmodem.modemA.alias':'pcie0','misectel_interface.qmodem_modemA.bridge_name':'bqmtest',
 'network.pcie0.modem_config':'modemA','network.pcie0.device':'bqmtest','network.pcie0.ifname':'bqmtest','network.pcie0.proto':'none','network.pcie0.metric':'11',
 'network.pcie0v6.modem_config':'modemA','network.pcie0v6.device':'bqmtest',
 'network.other.modem_config':'modemB','network.other.device':'bqmtest',
 'network.customer.device':'br-custom'}
 def run(endpoint,bridge,changes=None):
  d=dict(base);d.update(changes or {});state.write_text(json.dumps(d))
  env={**os.environ,'TEST_UCI_STATE':str(state),'TEST_UCI':str(uci),'TEST_NETDEV':str(netdev),'TEST_ENDPOINT':endpoint,'TEST_BRIDGE_ARG':bridge}
  subprocess.run(['bash',str(harness)],env=env,check=True)
  return json.loads(state.read_text())
 for bridge in ('bqmtest',''):
  d=run('cell0.1',bridge)
  assert d['network.pcie0.device']==d['network.pcie0.ifname']==d['network.pcie0v6.device']=='cell0.1'
  assert d['network.pcie0.proto']=='none' and d['network.pcie0.metric']=='11'
  assert d['network.other.device']=='bqmtest' and d['network.customer.device']=='br-custom'
 d=run('','')
 assert 'network.pcie0.device' not in d and 'network.pcie0.ifname' not in d and 'network.pcie0v6.device' not in d
 d=run('cell0.1','',{'network.pcie0.modem_config':'modemB'})
 assert d['network.pcie0.device']=='bqmtest'
 d=run('cell0.1','',{'network.pcie0.device':'br-custom','network.pcie0.ifname':'br-custom'})
 assert d['network.pcie0.device']=='br-custom'
print('PASS bridge retirement: disabled assignment lookup, IPv4/IPv6 release, offline modem, foreign ownership and unrelated interfaces.')

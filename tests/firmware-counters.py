#!/usr/bin/env python3
"""Exercise firmware rollback counters independently of overlay app versions.

Only the signature operation is stubbed here; live tests separately run the
real verifier and the original Rev.16 signing key. No router or flash access.
"""
from pathlib import Path
import json,os,subprocess,tempfile
repo=Path(__file__).resolve().parents[1]
source=(repo/'payload/usr/libexec/chester-verify-manifest').read_text()
cases=[('app-counter-is-independent','202611240006','20261126155247','202611260020','202611240006',True),
       ('current-firmware','202611260019','20261126155247','202611260019','202611260019',True),
       ('rom-rollback','202611260019','20261126155247','202611250018','202611240006',False),
       ('saved-floor','202611240006','20261126155247','202611250018','202611260019',False),
       ('unrelated-app-format','202611240006','app-version','202611260020','',True),
       ('invalid-rom','bad-rom','20261126155247','202611260020','',False)]
with tempfile.TemporaryDirectory(prefix='chester-firmware-counters-') as tmp:
 root=Path(tmp);(root/'bin').mkdir();(root/'key').write_text('fixture key');(root/'sig').write_text('fixture signature')
 for name,rom,app,target,floor,expected in cases:
  (root/'rom-version').write_text('build='+rom+'\n');(root/'app-version').write_text('build='+app+'\n')
  manifest={'product':'K45P','board':'misectel,m02k45','build':target,'version':'1.0.20','sha256':'a'*64,'size':2000000,'url':'https://raw.githubusercontent.com/ElReyDeHotspot/LettucePi-K45/main/firmware/LettucePi-K45P-1.0.20-sysupgrade.itb'}
  (root/'manifest').write_text(json.dumps(manifest))
  for file,text in [('usign','#!/bin/sh\nexit 0\n'),('uci',"#!/bin/sh\nprintf '%s\\n' '"+floor+"'\n")]:
   (root/'bin'/file).write_text(text);(root/'bin'/file).chmod(0o755)
  script=source.replace('/usr/share/chester/ota.pub',str(root/'key')).replace('/rom/etc/chester-version',str(root/'rom-version')).replace('/etc/chester-version',str(root/'app-version'))
  (root/'verify').write_text(script);(root/'verify').chmod(0o755)
  result=subprocess.run([str(root/'verify'),str(root/'manifest'),str(root/'sig')],env=dict(os.environ,PATH=str(root/'bin')+':'+os.environ['PATH']),capture_output=True,text=True)
  assert (result.returncode==0)==expected,(name,result.stdout,result.stderr)
  print('PASS firmware counters:',name)

"""Exercise one-shot lifecycle and failure handling with a mocked kernel helper."""
from pathlib import Path
import hashlib,os,re,subprocess,tempfile,unittest

WORKER=Path(__file__).resolve().parents[1]/'payload/usr/libexec/chester-wifi-check'
class WorkerTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
  for name in ('bin','tmp','var/lock','usr/lib/chester/wifi-check','lib/modules/6.12.94','sys/kernel/debug/ieee80211/phy0/mt76','sys/module'):(self.root/name).mkdir(parents=True,exist_ok=True)
  self.driver=self.root/'lib/modules/6.12.94/mt7996e.ko';self.driver.write_bytes(b'approved driver fixture')
  self.eeprom=self.root/'sys/kernel/debug/ieee80211/phy0/mt76/eeprom';self.eeprom.touch()
  mod=self.root/'usr/lib/chester/wifi-check/chester_wifi_check.ko';mod.write_bytes(b'checker fixture')
  (mod.parent/'SHA256SUMS').write_text(hashlib.sha256(mod.read_bytes()).hexdigest()+'  chester_wifi_check.ko\n')
  text=WORKER.read_text().replace('a51af118ae7535efa1ba9d1b5274445990368b24e449dd1ad51b3f87c0fe13af',hashlib.sha256(self.driver.read_bytes()).hexdigest())
  text=re.sub(r'/usr/lib/|/lib/modules/|/tmp/|/var/lock/|/sys/',lambda m:str(self.root)+m.group(),text)
  self.worker=self.root/'worker';self.worker.write_text(text)
  scripts={'uname':'echo 6.12.94','logger':'echo "$*" >> "$TEST_ROOT/log"','iw':'exit 0','sleep':'exit 0',
   'insmod':'echo read >> "$TEST_ROOT/loads"; mkdir -p "$TEST_ROOT/sys/module/chester_wifi_check/parameters"; printf "%s\\n" "$CHECK_RESULT" > "$TEST_ROOT/sys/module/chester_wifi_check/parameters/result"',
   'rmmod':'rm -rf "$TEST_ROOT/sys/module/chester_wifi_check"'}
  for name,body in scripts.items():
   p=self.root/'bin'/name;p.write_text('#!/bin/sh\n'+body+'\n');p.chmod(0o755)
  self.env=dict(os.environ,PATH=str(self.root/'bin')+':'+os.environ['PATH'],TEST_ROOT=str(self.root),CHECK_RESULT='verified=1 matched=19 total=19 blocks=5')
 def run_worker(self):return subprocess.run(['sh',str(self.worker)],env=self.env,capture_output=True)
 def test_success_unloads_and_skips_future_reads(self):
  self.assertEqual(self.run_worker().returncode,0)
  self.assertTrue((self.root/'tmp/chester-wifi-check.done').exists())
  self.assertFalse((self.root/'sys/module/chester_wifi_check').exists())
  self.assertEqual(self.run_worker().returncode,0)
  self.assertEqual((self.root/'loads').read_text().splitlines(),['read'])
 def test_unverified_result_does_not_claim_success(self):
  self.env['CHECK_RESULT']='verified=0 reason=active_override_mismatch matched=7 total=19 blocks=3 error=0'
  self.assertEqual(self.run_worker().returncode,0)
  self.assertFalse((self.root/'tmp/chester-wifi-check.done').exists())
  self.assertFalse((self.root/'sys/module/chester_wifi_check').exists())
 def test_unknown_driver_is_not_probed(self):
  self.driver.write_bytes(b'unknown driver')
  self.assertEqual(self.run_worker().returncode,0)
  self.assertFalse((self.root/'loads').exists())
  self.assertIn('unsupported driver',(self.root/'log').read_text())
 def test_checker_integrity_failure_is_not_probed(self):
  (self.root/'usr/lib/chester/wifi-check/chester_wifi_check.ko').write_bytes(b'changed')
  self.assertEqual(self.run_worker().returncode,0)
  self.assertFalse((self.root/'loads').exists())
 def test_radio_wait_is_bounded(self):
  self.eeprom.unlink()
  self.assertEqual(self.run_worker().returncode,0)
  self.assertFalse((self.root/'loads').exists())
  self.assertIn('radio not ready',(self.root/'log').read_text())
if __name__=='__main__':unittest.main()

import unittest,tempfile,subprocess,json
from pathlib import Path
class Metrics(unittest.TestCase):
 def test_real_deltas_and_reinitialization(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);proc=root/'proc';proc.mkdir();state=root/'metrics'
   source=Path('payload/usr/sbin/chester-runtime-metrics').read_text().replace('/tmp/chester-runtime-metrics',str(state)).replace('/proc/',str(proc)+'/')
   script=root/'metrics.sh';script.write_text(source)
   def sample(now,total,idle,available=400):
    (proc/'uptime').write_text(f'{now} 0\n')
    (proc/'stat').write_text(f'cpu {total-idle} 0 0 {idle} 0 0 0 0 999 999\n')
    (proc/'meminfo').write_text(f'MemTotal: 1000 kB\nMemAvailable: {available} kB\n')
    return json.loads(subprocess.check_output(['sh',str(script)]))
   self.assertIsNone(sample(10,1000,800)['cpu_percent'])
   result=sample(12,1200,840)
   self.assertEqual(result['cpu_percent'],80)
   self.assertEqual(result['sample_ms'],2000)
   self.assertEqual(result['memory'],{'total':1024000,'available':409600})
   self.assertEqual(sample(12.1,1210,842,300)['cpu_percent'],80)
   self.assertEqual(sample(14,1400,1040)['cpu_percent'],0)
   self.assertIsNone(sample(100,2000,1500)['cpu_percent'])
   self.assertIsNone(sample(1,100,50)['cpu_percent'])
   self.assertEqual(sample(3,300,150)['cpu_percent'],50)
if __name__=='__main__':unittest.main()

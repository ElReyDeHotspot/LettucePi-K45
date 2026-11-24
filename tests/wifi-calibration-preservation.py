#!/usr/bin/env python3
"""Exercise release rejection for calibration and reset-path tampering."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/check-wifi-calibration.py'


class PreservationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.root, self.payload, self.manifest = base/'root', base/'payload', base/'baseline.json'
        self.payload.mkdir()
        self.files = (
            'lib/modules/6.12.94/mt7996e.ko', 'sbin/factoryreset',
            'lib/upgrade/platform.sh',
            'lib/firmware/mediatek/mt7996/mt7992_eeprom_23_2i5i.bin',
        )
        for relative in self.files:
            path = self.root/relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'original vendor data')
        subprocess.run([sys.executable, str(SCRIPT), 'snapshot', str(self.root),
                        str(self.manifest)], check=True, capture_output=True)

    def verify(self):
        return subprocess.run([sys.executable, str(SCRIPT), 'verify', str(self.root),
                               str(self.manifest), str(self.payload)], capture_output=True)

    def test_vendor_files_pass_unchanged(self):
        self.assertEqual(self.verify().returncode, 0)

    def test_replaced_vendor_files_are_rejected(self):
        for relative in self.files:
            with self.subTest(file=relative):
                path = self.root/relative
                path.write_bytes(b'replacement data')
                self.assertNotEqual(self.verify().returncode, 0)
                path.write_bytes(b'original vendor data')

    def test_deleted_driver_is_rejected(self):
        (self.root/self.files[0]).unlink()
        self.assertNotEqual(self.verify().returncode, 0)

    def test_extra_eeprom_in_vendor_directory_is_rejected(self):
        (self.root/self.files[-1]).with_name('unit-eeprom.bin').write_bytes(b'unit data')
        self.assertNotEqual(self.verify().returncode, 0)

    def test_private_artifacts_are_rejected(self):
        for name in ('router-efuse.bin', 'effective-eeprom.bin', 'chester_cal_read.ko'):
            with self.subTest(file=name):
                path = self.payload/name
                path.write_bytes(b'private diagnostic data')
                self.assertNotEqual(self.verify().returncode, 0)
                path.unlink()


if __name__ == '__main__':
    unittest.main()

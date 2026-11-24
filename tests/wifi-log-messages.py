#!/usr/bin/env python3
from pathlib import Path
import hashlib
import struct
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import wifi_log_messages as policy


def fixture():
    names = b'\0.text\0.rodata.str1.8\0.shstrtab\0'
    code = b'\x1f\x20\x03\xd5'*2
    strings = b'\0'.join(old for old, _ in policy.MESSAGES)+b'\0'
    string_offset = 64+len(code)
    names_offset = string_offset+len(strings)
    headers_offset = names_offset+len(names)
    header = struct.pack('<16sHHIQQQIHHHHHH', b'\x7fELF\x02\x01\x01'+b'\0'*9,
                         1, 183, 1, 0, 0, headers_offset, 0, 64, 0, 0, 64, 4, 3)
    sections = bytes(64)
    for name, flags, offset, size in ((b'.text', 6, 64, len(code)),
                                      (b'.rodata.str1.8', 0x32, string_offset, len(strings)),
                                      (b'.shstrtab', 0, names_offset, len(names))):
        sections += struct.pack('<IIQQQQIIQQ', names.index(name), 1, flags, 0,
                                offset, size, 0, 0, 1, 0)
    return header+code+strings+names+sections


class LogMessageTest(unittest.TestCase):
    def setUp(self):
        self.original = fixture()
        expected = self.original
        for old, new in policy.MESSAGES:
            expected = expected.replace(old+b'\0', new+b'\0'*(len(old)-len(new)+1))
        self.expected = expected
        self.vendor = hashlib.sha256(self.original).hexdigest()
        self.clarified = hashlib.sha256(expected).hexdigest()
        for name, value in (('VENDOR_SHA256', self.vendor), ('CLARIFIED_SHA256', self.clarified)):
            context = patch.object(policy, name, value)
            context.start()
            self.addCleanup(context.stop)

    def test_only_approved_string_slots_change(self):
        result = policy.patch(self.original)
        self.assertEqual(result, self.expected)
        self.assertEqual(len(result), len(self.original))
        self.assertEqual(result[:72], self.original[:72])

    def test_reapplying_is_safe(self):
        self.assertEqual(policy.patch(self.expected), self.expected)

    def test_unknown_or_code_modified_modules_are_rejected(self):
        changed = bytearray(self.original)
        changed[64] ^= 1
        with self.assertRaises(ValueError):
            policy.patch(bytes(changed))

    def test_patched_module_does_not_weaken_preservation_check(self):
        self.assertEqual(policy.preservation_digest(self.expected), self.vendor)
        changed = bytearray(self.expected)
        changed[64] ^= 1
        self.assertNotEqual(policy.preservation_digest(bytes(changed)), self.vendor)

    def test_executable_section_cannot_be_patched(self):
        changed = bytearray(self.original)
        shoff = struct.unpack_from('<Q', changed, 40)[0]
        struct.pack_into('<Q', changed, shoff+2*64+8, 6)
        with patch.object(policy, 'VENDOR_SHA256', hashlib.sha256(changed).hexdigest()):
            with self.assertRaisesRegex(ValueError, 'read-only'):
                policy.patch(bytes(changed))


if __name__ == '__main__':
    unittest.main()

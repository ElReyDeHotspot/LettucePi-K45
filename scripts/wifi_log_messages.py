#!/usr/bin/env python3
"""Change only two diagnostic string slots in the pinned vendor Wi-Fi module.

Keep instruction bytes, relocations, EEPROM templates and per-unit eFuse handling
unchanged. Unknown modules fail closed rather than accepting a fuzzy replacement.
"""
import hashlib
from pathlib import Path
import struct
import sys

VENDOR_SHA256 = 'a51af118ae7535efa1ba9d1b5274445990368b24e449dd1ad51b3f87c0fe13af'
CLARIFIED_SHA256 = 'd0b31ebb24727101234130cb0520b1dab0a58727a990f63bcd9c7f68b3bba3ac'
MESSAGES = (
    (b'eeprom tx_power zeros detected, using defaults\n',
     b'Wi-Fi: initializing vendor power template\n'),
    (b'eeprom load fail, use default bin\n',
     b'Wi-Fi: template ready; eFuse next\n'),
)


def preservation_digest(data):
    digest = hashlib.sha256(data).hexdigest()
    return VENDOR_SHA256 if digest == CLARIFIED_SHA256 else digest


def patch(data):
    digest = hashlib.sha256(data).hexdigest()
    if digest == CLARIFIED_SHA256:
        return data
    if digest != VENDOR_SHA256:
        raise ValueError('Unrecognized vendor Wi-Fi module; refusing diagnostic patch')
    # Locate read-only string sections from the actual ELF section headers.
    if data[:6] != b'\x7fELF\x02\x01':
        raise ValueError('Expected little-endian ELF64 module')
    shoff = struct.unpack_from('<Q', data, 40)[0]
    entsize, count, names_index = struct.unpack_from('<HHH', data, 58)
    sections = [struct.unpack_from('<IIQQQQIIQQ', data, shoff+i*entsize)
                for i in range(count)]
    names_header = sections[names_index]
    names = data[names_header[4]:names_header[4]+names_header[5]]
    strings = []
    for section in sections:
        name = names[section[0]:].split(b'\0', 1)[0]
        if name.startswith(b'.rodata.str') and not section[2] & (1 | 4):
            strings.append((section[4], section[4]+section[5]))
    result = bytearray(data)
    allowed = set()
    for old, new in MESSAGES:
        if len(new) > len(old) or data.count(old+b'\0') != 1:
            raise ValueError('Unexpected vendor diagnostic string layout')
        offset = data.index(old+b'\0')
        end = offset+len(old)+1
        if not any(start <= offset and end <= stop for start, stop in strings):
            raise ValueError('Diagnostic is outside a read-only ELF string section')
        result[offset:end] = new+b'\0'*(len(old)-len(new)+1)
        allowed.update(range(offset, end))
    result = bytes(result)
    if len(result) != len(data) or any(a != b and i not in allowed
                                     for i, (a, b) in enumerate(zip(data, result))):
        raise ValueError('Change escaped approved diagnostic slots')
    if hashlib.sha256(result).hexdigest() != CLARIFIED_SHA256:
        raise ValueError('Clarified module hash differs from reviewed result')
    return result


def main():
    root = Path(sys.argv[1])
    modules = list(root.glob('lib/modules/*/mt7996e.ko'))
    if len(modules) != 1:
        raise ValueError('Expected one vendor Wi-Fi module')
    module = modules[0]
    module.write_bytes(patch(module.read_bytes()))
    print('Wi-Fi diagnostics clarified: two string slots; executable code unchanged')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, IndexError) as error:
        sys.exit(str(error))

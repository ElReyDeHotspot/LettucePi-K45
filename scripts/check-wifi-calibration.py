#!/usr/bin/env python3
"""Preserve vendor per-unit eFuse loading and settings-only reset/upgrade paths.

Only generic vendor firmware belongs in an image. Per-router eFuse/EEPROM dumps
and diagnostic readers must remain outside the payload and release image.
"""
import hashlib
import json
from pathlib import Path
import sys
from wifi_log_messages import preservation_digest


def inventory(root):
    paths = set()
    for pattern in (
        'lib/modules/*/mt76*.ko', 'lib/modules/*/mt79*.ko',
        'lib/firmware/mediatek/mt7996/**/*', 'lib/libfstools.so*',
        'etc/hotplug.d/firmware/11-mt76-caldata', 'lib/functions/caldata.sh',
        'lib/upgrade/*.sh', 'sbin/sysupgrade',
        'sbin/factoryreset', 'sbin/firstboot', 'sbin/jffs2reset',
        'etc/rc.button/reset', 'etc/hotplug.d/factoryreset/**/*',
    ):
        paths.update(p for p in root.glob(pattern) if p.is_file() or p.is_symlink())
    required = ('sbin/factoryreset', 'lib/upgrade/platform.sh',
                'lib/firmware/mediatek/mt7996/mt7992_eeprom_23_2i5i.bin')
    for relative in required:
        if root / relative not in paths:
            raise ValueError(f'Missing protected vendor file: {relative}')
    if not any(p.name == 'mt7996e.ko' for p in paths):
        raise ValueError('Missing vendor MT7992 driver')
    result = {}
    for path in sorted(paths):
        relative = str(path.relative_to(root))
        if path.is_symlink():
            result[relative] = {'symlink': str(path.readlink())}
        else:
            data = path.read_bytes()
            # Only the exact reviewed two-string change may differ in this driver.
            digest = preservation_digest(data) if path.name == 'mt7996e.ko' else hashlib.sha256(data).hexdigest()
            result[relative] = {'sha256': digest}
    return result


def check_payload(payload):
    if not payload.is_dir():
        raise ValueError('Payload directory is missing')
    forbidden = ('eeprom', 'efuse', 'calibration', 'chester_cal_read', 'factory-partition')
    for path in payload.rglob('*'):
        if path.is_file() and any(term in path.name.lower() for term in forbidden):
            raise ValueError(f'Calibration artifact must not be shipped: {path.relative_to(payload)}')


def main():
    mode, root_arg, manifest_arg, *extra = sys.argv[1:]
    root, manifest = Path(root_arg), Path(manifest_arg)
    actual = inventory(root)
    if mode == 'snapshot':
        with manifest.open('x', encoding='utf-8') as output:
            json.dump(actual, output, indent=2)
    elif mode == 'verify':
        expected = json.loads(manifest.read_text(encoding='utf-8'))
        changed = sorted(path for path in expected.keys() | actual.keys()
                         if expected.get(path) != actual.get(path))
        if changed:
            raise ValueError('Protected vendor files changed: ' + ', '.join(changed))
        check_payload(Path(extra[0]))
    else:
        raise ValueError('Use snapshot or verify')
    print(f'Wi-Fi calibration preservation: {mode} OK ({len(actual)} vendor files)')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, IndexError) as error:
        sys.exit(f'Wi-Fi calibration preservation failed: {error}')

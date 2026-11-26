#!/usr/bin/env python3
"""Exercise detached K45P update status without accessing a router or flash."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile
import time

repo = Path(__file__).resolve().parents[1]
source = (repo / 'payload/usr/sbin/chester-update').read_text()
with tempfile.TemporaryDirectory(prefix='chester-k45-update-') as tmp:
    for mode in ['signature', 'old', 'download', 'size', 'checksum', 'compatibility', 'flash', 'keep', 'erase']:
        root = Path(tmp) / mode
        root.mkdir()
        (root / 'bin').mkdir()
        (root / 'board').write_text('misectel,m02k45\n')
        (root / 'version').write_text('version=1.0.19\nbuild=202611260019\nbin=19\n')
        image = b'FIT test image' * 300
        (root / 'image').write_bytes(image)
        release = dict(build='202611260020' if mode != 'old' else '202611260019',
                       sha256=hashlib.sha256(image).hexdigest(), size=len(image),
                       url='https://raw.githubusercontent.com/ElReyDeHotspot/LettucePi-K45/main/firmware/test.itb')
        (root / 'manifest').write_text(json.dumps(release))
        curl = f'''#!/bin/sh
r={str(root)!r}
dest=
for arg in "$@"; do url=$arg; done
while [ "$#" -gt 0 ]; do
 [ "$1" != -o ] || {{ shift; dest=$1; }}
 shift
done
if [ -n "$dest" ]; then
 case {mode!r} in
 download) exit 7;;
 size) head -c 20 "$r/image" > "$dest";;
 checksum) cp "$r/image" "$dest"; printf X | dd of="$dest" bs=1 seek=12 conv=notrunc 2>/dev/null;;
 *) cp "$r/image" "$dest";;
 esac
else
 case "$url" in
 *git/ref/heads/main*) printf '{{"object":{{"sha":"{'a' * 40}"}}}}';;
 *.json.sig) echo signature;;
 *) cat "$r/manifest";;
 esac
fi
'''
        (root / 'bin/curl').write_text(curl)
        (root / 'verify').write_text('#!/bin/sh\nexit ' + ('1' if mode == 'signature' else '0') + '\n')
        (root / 'bin/uci').write_text(f'''#!/bin/sh
printf '%s\\n' "$*" >> {str(root / 'uci-calls')!r}
[ "$1" != -q ] || echo {0 if mode == 'erase' else 1}
exit 0
''')
        (root / 'flash').write_text(f'''#!/bin/sh
printf '%s\\n' "$*" >> {str(root / 'flash-calls')!r}
if [ "$1" = -T ]; then [ {mode!r} != compatibility ]; else [ {mode!r} != flash ]; fi
''')
        for p in [root / 'bin/curl', root / 'bin/uci', root / 'verify', root / 'flash']:
            p.chmod(0o755)
        script = source
        for old, new in {
            '/rom/etc/chester-version': str(root / 'version'),
            '/etc/chester-version': str(root / 'version'),
            '/tmp/chester-update.log': str(root / 'log'),
            '/tmp/chester-update-job.json': str(root / 'job'),
            '/tmp/sysinfo/board_name': str(root / 'board'),
            '/var/lock': str(root / 'locks'),
            '/usr/libexec/chester-verify-manifest': str(root / 'verify'),
            '/tmp/k45p-manifest.XXXXXX': str(root / 'manifest.XXXXXX'),
            '/tmp/k45p-sysupgrade.itb': str(root / 'staged.itb'),
            'sysupgrade -': str(root / 'flash') + ' -',
            'sysupgrade "$img"': str(root / 'flash') + ' "$img"',
            'sleep 3': 'sleep .05',
        }.items():
            script = script.replace(old, new)
        (root / 'update').write_text(script)
        (root / 'update').chmod(0o755)
        env = dict(os.environ, PATH=str(root / 'bin') + ':' + os.environ['PATH'])
        request_id = 'd' * 32
        result = subprocess.run([str(root / 'update'), 'install', request_id], env=env,
                                capture_output=True, text=True, timeout=10)
        assert result.returncode == 0 and result.stdout.startswith('OK:'), (mode, result)
        end = time.monotonic() + 10
        while time.monotonic() < end:
            job = json.loads((root / 'job').read_text())
            done = job['phase'] == 'failed' or (root / 'flash-calls').exists() and len((root / 'flash-calls').read_text().splitlines()) == 2
            if done:
                break
            time.sleep(.04)
        else:
            raise AssertionError((mode, (root / 'log').read_text(), job))
        assert job['id'] == request_id
        calls = (root / 'flash-calls').read_text().splitlines() if (root / 'flash-calls').exists() else []
        if mode in ['keep', 'erase']:
            assert job['phase'] == 'installing' and len(calls) == 2, (mode, calls, job)
            assert calls[0].startswith('-T ')
            assert calls[1].startswith('-n ') == (mode == 'erase')
        else:
            assert job['phase'] == 'failed', (mode, job)
            if mode not in ['flash', 'compatibility']:
                assert not calls, (mode, calls)
            if mode == 'compatibility':
                assert len(calls) == 1 and calls[0].startswith('-T ')
        print('PASS detached K45P worker', mode, flush=True)
print('PASS K45P worker status and validation; no real network, UCI or flash accessed.')

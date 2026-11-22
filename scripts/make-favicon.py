#!/usr/bin/env python3
"""Render the existing leaf SVG as browser icons (requires rsvg-convert)."""
from pathlib import Path
import struct
import subprocess

root = Path(__file__).resolve().parents[1] / 'payload/www'
media = root / 'luci-static/misectel'
source = media / 'green-leaf.svg'

def png(size):
    return subprocess.check_output(['rsvg-convert', '-w', str(size), '-h', str(size), str(source)])

sizes = (16, 32, 48, 64, 128, 256)
images = [png(size) for size in sizes]
offset = 6 + 16 * len(images)
entries = []
for size, data in zip(sizes, images):
    entries.append(struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(data), offset))
    offset += len(data)
icon = struct.pack('<HHH', 0, 1, len(images)) + b''.join(entries) + b''.join(images)
(media / 'favicon.ico').write_bytes(icon)
(root / 'favicon.ico').write_bytes(icon)
(media / 'apple-touch-icon.png').write_bytes(png(180))
print('Rendered green-leaf ICO sizes 16–256 and 180px touch icon.')

#!/bin/sh
# Keep the release key outside the checkout and router. Sign only reviewed images.
set -eu
repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
key=${1:?Usage: sign-release.sh /private/path/ota.key}
usign -S -s "$key" -m "$repo/firmware/latest.json" -x "$repo/firmware/latest.json.sig"
usign -V -p "$repo/payload/usr/share/chester/ota.pub" -m "$repo/firmware/latest.json" -x "$repo/firmware/latest.json.sig"

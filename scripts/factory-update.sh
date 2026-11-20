#!/bin/sh
# Verified bootstrap for vendor K45 routers. Always discards saved settings.
set -eu
key=${1:?Pinned release public key required}
mode=${2:-install}
case "$mode" in install|--check) ;; *) echo 'Invalid mode' >&2; exit 2 ;; esac
[ "$(id -u)" = 0 ] || { echo 'Run as root' >&2; exit 1; }
[ "$(cat /tmp/sysinfo/board_name)" = 'misectel,m02k45' ] || { echo 'Unsupported router' >&2; exit 1; }
for cmd in curl jq usign sha256sum sysupgrade; do command -v "$cmd" >/dev/null; done
t=$(mktemp -d /tmp/k45p-factory-update.XXXXXX)
trap 'rm -rf "$t"' EXIT
raw=https://raw.githubusercontent.com/ElReyDeHotspot/LettucePi-K45
ref=$(curl -fsSL --connect-timeout 15 --max-time 45 "https://api.github.com/repos/ElReyDeHotspot/LettucePi-K45/git/ref/heads/main?cb=$(date +%s)" | jq -er .object.sha)
[ "${#ref}" = 40 ] || exit 1
case "$ref" in *[!0-9a-f]*) exit 1 ;; esac
base=$raw/$ref/firmware
curl -fsSL --connect-timeout 15 --max-time 45 "$base/latest.json" -o "$t/manifest"
curl -fsSL --connect-timeout 15 --max-time 45 "$base/latest.json.sig" -o "$t/signature"
usign -V -p "$key" -m "$t/manifest" -x "$t/signature"
jq -e '.product == "K45P" and .board == "misectel,m02k45" and (.version|type == "string") and (.build|type == "string") and (.url|type == "string") and (.sha256|type == "string") and (.sha256|length == 64) and (.size|type == "number") and .size > 1000000 and .size < 60000000 and (.size|floor) == .size' "$t/manifest" >/dev/null
url=$(jq -r .url "$t/manifest"); file=${url##*/}
case "$file" in LettucePi-K45P-*-sysupgrade.itb) ;; *) exit 1 ;; esac
case "$file" in *[!A-Za-z0-9._-]*) exit 1 ;; esac
[ "$url" = "$raw/main/firmware/$file" ] || exit 1
sha=$(jq -r .sha256 "$t/manifest"); size=$(jq -r .size "$t/manifest")
case "$sha" in *[!0-9a-f]*) exit 1 ;; esac
build=$(jq -r .build "$t/manifest")
[ "${#build}" = 12 ] || exit 1
case "$build" in *[!0-9]*) exit 1 ;; esac
[ "$(df -k /tmp | awk 'NR==2 {print $4}')" -gt $((size / 1024 + 16384)) ] || { echo 'Insufficient memory' >&2; exit 1; }
echo "Downloading signed K45P $(jq -r .version "$t/manifest") / bin $(jq -r .bin "$t/manifest")"
curl --http1.1 -fL --retry 3 --connect-timeout 20 --max-time 1200 "$base/$file" -o "$t/firmware.itb"
[ "$(wc -c < "$t/firmware.itb" | tr -d ' ')" = "$size" ] || { echo 'Incorrect image size' >&2; exit 1; }
[ "$(sha256sum "$t/firmware.itb" | cut -d' ' -f1)" = "$sha" ] || { echo 'Image checksum mismatch' >&2; exit 1; }
sysupgrade -T "$t/firmware.itb"
if [ "$mode" = --check ]; then
    echo 'PASS: signed latest image downloaded and validated; no flash invoked'
    exit 0
fi
echo 'Installing newest published K45P firmware, erasing saved settings, then rebooting.'
sysupgrade -n "$t/firmware.itb"

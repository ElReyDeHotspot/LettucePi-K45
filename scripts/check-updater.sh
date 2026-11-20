#!/bin/sh
# Test manifest gates with the K45P's own minimal jq, without network or flash.
set -eu
T=$(mktemp -d /tmp/k45p-updater-test.XXXXXX)
trap 'rm -rf "$T"' EXIT
awk '/^case .*status/ {exit} {print}' /usr/sbin/chester-update > "$T/functions"
. "$T/functions"
FIXTURE=$T/fixture
curl() {
    case "$*" in
        *api.github.com*) printf '%s\n' '{"object":{"sha":"0123456789abcdef0123456789abcdef01234567"}}' ;;
        *) cat "$FIXTURE" ;;
    esac
}
printf '%s\n' '{"product":"K45P","board":"misectel,m02k45","version":"1.0.0","build":"202611200001","url":"https://raw.githubusercontent.com/ElReyDeHotspot/LettucePi-K45/main/firmware/test.itb","sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","size":25000000}' > "$T/good"
cp "$T/good" "$FIXTURE"
fetch_manifest "$T/out" || { echo 'FAIL: valid K45P manifest rejected'; exit 1; }
for change in '.board="alwaylink,m01k43"' '.product="K43P"' '.sha256="INVALID"' '.sha256="gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg"' '.url="https://example.com/other.itb"' '.size=999999999'; do
    jq "$change" "$T/good" > "$FIXTURE"
    if fetch_manifest "$T/out"; then echo "FAIL: accepted $change"; exit 1; fi
done
echo 'Passed valid manifest and 6 invalid-manifest checks; no flash invoked'

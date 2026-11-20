#!/bin/sh
# On-device checks use ephemeral keys and never download or flash an image.
set -eu
T=$(mktemp -d /tmp/k45p-updater-test.XXXXXX)
trap 'rm -rf "$T"' EXIT
umask 077
usign -G -s "$T/key" -p "$T/pub"
printf 'build=202611200005\n' > "$T/version"
mkdir "$T/bin"
printf '#!/bin/sh\n[ ! -f "%s/floor" ] || cat "%s/floor"\n' "$T" "$T" > "$T/bin/uci"
chmod 755 "$T/bin/uci"
export PATH="$T/bin:$PATH"
sed -e "s|key=/usr/share/chester/ota.pub|key=$T/pub|" -e "s|/etc/chester-version|$T/version|" /usr/libexec/chester-verify-manifest > "$T/verifier"
chmod 755 "$T/verifier"
awk '/^case .*status/ {exit} {print}' "${1:-/usr/sbin/chester-update}" | sed "s|/usr/libexec/chester-verify-manifest|$T/verifier|" > "$T/functions"
. "$T/functions"
FIXTURE=$T/fixture
curl() {
    case "$*" in
        *api.github.com*) printf '%s\n' '{"object":{"sha":"0123456789abcdef0123456789abcdef01234567"}}' ;;
        *latest.json.sig*) cat "$FIXTURE.sig" ;;
        *0123456789abcdef0123456789abcdef01234567/firmware/latest.json*) cat "$FIXTURE" ;;
        *) echo 'Unexpected or non-immutable fetch' >&2; return 1 ;;
    esac
}
printf '%s\n' '{"product":"K45P","board":"misectel,m02k45","version":"1.0.5","build":"202611200006","url":"https://raw.githubusercontent.com/ElReyDeHotspot/LettucePi-K45/main/firmware/LettucePi-K45P-1.0.5-sysupgrade.itb","sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","size":25000000}' > "$T/good"
sign() { usign -S -s "$T/key" -m "$FIXTURE" -x "$FIXTURE.sig"; }
cp "$T/good" "$FIXTURE"; sign
fetch_manifest "$T/out" || { echo 'FAIL valid signature'; exit 1; }
echo 'PASS valid signed manifest, immutable commit fetch'
for change in '.board="alwaylink,m01k43"' '.product="K43P"' '.build="202611200004"' '.build="INVALID"' '.sha256="INVALID"' '.url="https://example.com/other.itb"' '.size=25000000.5' '.size=999999999'; do
    jq "$change" "$T/good" > "$FIXTURE"; sign
    if fetch_manifest "$T/out"; then echo "FAIL accepted $change"; exit 1; fi
done
echo 'PASS 8 signed metadata and rollback rejection checks'
cp "$T/good" "$FIXTURE"; sign; printf '\n' >> "$FIXTURE"
if fetch_manifest "$T/out"; then echo 'FAIL accepted tampering'; exit 1; fi
cp "$T/good" "$FIXTURE"; sign; rm "$FIXTURE.sig"
if fetch_manifest "$T/out"; then echo 'FAIL accepted missing signature'; exit 1; fi
usign -G -s "$T/foreign" -p "$T/foreign.pub"
usign -S -s "$T/foreign" -m "$FIXTURE" -x "$FIXTURE.sig"
if fetch_manifest "$T/out"; then echo 'FAIL accepted foreign key'; exit 1; fi
sign; printf '202611200007\n' > "$T/floor"
if fetch_manifest "$T/out"; then echo 'FAIL ignored persistent floor'; exit 1; fi
echo 'PASS tampering, missing/foreign signature and persistent rollback floor; no flash invoked'

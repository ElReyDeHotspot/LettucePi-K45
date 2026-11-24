#!/bin/bash
# Rebuild a K45P FIT using the exact captured vendor kernel and device tree.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
BASE=${1:?Usage: build.sh base.itb [work-directory]}
WORK=${2:-/var/tmp/k45p-build}
APK=${APK_TOOLS:-/usr/local/bin/apk3}
FWTOOL=${FWTOOL:-fwtool}
BUILD=${BUILD_ID:-202611240006}
BIN=${BIN_NUMBER:-16}
VERSION=${VERSION:-1.0.$BIN}
BUILD_DATE=${BUILD_DATE:-$(date -u +%F)}
case "$BIN" in ''|*[!0-9]*) echo 'Revision must be numeric' >&2; exit 1 ;; esac
[ "${VERSION##*.}" = "$BIN" ] || { echo 'Version patch must match the revision (for example, 1.0.12 = Rev. 12)' >&2; exit 1; }
case "$WORK" in /var/tmp/k45p-*|/tmp/k45p-*) ;; *) echo 'Use a dedicated /var/tmp/k45p-* directory' >&2; exit 1 ;; esac
mkdir -p "$WORK" "$REPO/firmware"
[ ! -e "$WORK/root" ] || { echo 'Work root already exists; choose a fresh work directory' >&2; exit 1; }
for i in 0 1 2; do dumpimage -T flat_dt -p "$i" -o "$WORK/image$i" "$BASE" >/dev/null; done
unsquashfs -d "$WORK/root" "$WORK/image2" >/dev/null
R=$WORK/root
python3 "$REPO/scripts/check-wifi-calibration.py" snapshot "$R" "$WORK/vendor-wifi-calibration.json"
grep -q "r37978-cd0a06bfd3fd" "$R/etc/openwrt_release"
langs=$("$APK" --root "$R" info 2>/dev/null | grep -E '^luci-i18n-.*-zh-(cn|tw)$' || true)
[ -z "$langs" ] || "$APK" del --root "$R" --no-scripts $langs
# Vendor-only feeds are not published at this release; standard feeds remain
# pinned to the exact running release, including the matching target feed.
sed -i -e '/\/misectel\//d' -e '/\/qmodem\//d' -e '/\/video\//d' "$R/etc/apk/repositories.d/distfeeds.list"
"$APK" --root "$R" --arch aarch64_cortex-a53 --no-scripts add tc-full ttyd luci-app-ttyd usign
# Local NFQUEUE packages target only the captured vendor kernel ABI.
(cd "$REPO/integrations/zapret2/packages"; sha256sum -c SHA256SUMS)
"$APK" --root "$R" --arch aarch64_cortex-a53 --no-scripts --allow-untrusted add \
  "$REPO"/integrations/zapret2/packages/*.apk
# Add-on CAKE module for the exact vendor ABI; the kernel stays unchanged.
(cd "$REPO/integrations/sqm/packages"; sha256sum -c SHA256SUMS)
"$APK" --root "$R" --arch aarch64_cortex-a53 --no-scripts --allow-untrusted add \
  "$REPO"/integrations/sqm/packages/*.apk
(cd "$REPO/integrations/secure-web/packages"; sha256sum -c SHA256SUMS)
"$APK" --root "$R" --arch aarch64_cortex-a53 --no-scripts --allow-untrusted add \
  "$REPO"/integrations/secure-web/packages/*.apk
(cd "$REPO/integrations/cloudflare"; sha256sum -c SHA256SUMS)
python3 "$REPO/scripts/customize.py" "$R"
node "$REPO/scripts/titlecase-ui.cjs" "$R/www/luci-static/resources/view" --write
for scope in protocol tools misectel ui.js form.js; do
  [ ! -e "$R/www/luci-static/resources/$scope" ] || node "$REPO/scripts/titlecase-ui.cjs" "$R/www/luci-static/resources/$scope" --write
done
node "$REPO/scripts/titlecase-ui.cjs" "$R/usr/share/luci/menu.d" --menus --write
node "$REPO/scripts/check-payload-js.cjs" "$R" "$REPO/payload"
printf 'version=%s\nbuilt=%s\nbuild=%s\nbin=%s\nproduct=K45P\n' "$VERSION" "$BUILD_DATE" "$BUILD" "$BIN" > "$R/etc/chester-version"
python3 "$REPO/scripts/wifi_log_messages.py" "$R"
python3 "$REPO/scripts/check-wifi-calibration.py" verify "$R" "$WORK/vendor-wifi-calibration.json" "$REPO/payload"
cp "$WORK/image0" "$WORK/kernel.bin"
cp "$WORK/image1" "$WORK/k45p.dtb"
cp "$REPO/scripts/k45p.its" "$WORK/k45p.its"
mksquashfs "$R" "$WORK/rootfs.squashfs" -noappend -all-root -comp xz -b 262144 -no-xattrs -no-progress >/dev/null
(cd "$WORK"; mkimage -f k45p.its -E -B 0x1000 k45p-unmetadata.itb)
dumpimage -T flat_dt -p 0 -o "$WORK/check-kernel" "$WORK/k45p-unmetadata.itb" >/dev/null
dumpimage -T flat_dt -p 1 -o "$WORK/check-dtb" "$WORK/k45p-unmetadata.itb" >/dev/null
cmp "$WORK/image0" "$WORK/check-kernel"
cmp "$WORK/image1" "$WORK/check-dtb"
IMAGE="$REPO/firmware/LettucePi-K45P-$VERSION-sysupgrade.itb"
cp "$WORK/k45p-unmetadata.itb" "$IMAGE"
cat > "$REPO/firmware/image-metadata.json" <<'EOF'
{"metadata_version":"1.1","compat_version":"1.0","supported_devices":["misectel,m02k45"],"version":{"dist":"ImmortalWrt","version":"25.12.1","revision":"r37978-cd0a06bfd3fd","target":"mediatek/filogic","board":"misectel_m02k45"}}
EOF
"$FWTOOL" -I "$REPO/firmware/image-metadata.json" "$IMAGE"
echo 'FIT and metadata built. Run stock sysupgrade -T on the K45P before publication.'

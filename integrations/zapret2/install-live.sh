#!/bin/sh
# Run from an extracted checkout/bundle on the K45P. No flash writes or reboot.
set -eu
HERE=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO=$(CDPATH= cd -- "$HERE/../.." && pwd)
[ "$(uname -r)" = 6.12.94 ]
apk info -v | grep -qx 'kernel-6.12.94~768011ae6e81e700abee5e18322a466a-r1'
[ "$(ubus call system board | jsonfilter -e '@.board_name')" = misectel,m02k45 ]
(cd "$HERE/packages"; sha256sum -c SHA256SUMS)
want=0
if pidof tpws >/dev/null || [ "$(uci -q get zapret2.main.enabled)" = 1 ]; then want=1; fi
first=0
[ -f /etc/config/zapret2 ] || first=1
apk add --allow-untrusted "$HERE"/packages/*.apk
if [ "$first" = 1 ] && [ -s /etc/chester-video-hosts ]; then
 uci set zapret2.main.scope=hostlist
 uci set zapret2.main.host="$(grep -vE '^[[:space:]]*(#|$)' /etc/chester-video-hosts | tr '\n' ' ')"
 uci commit zapret2
fi
for file in usr/share/ucode/luci/template/header.ut www/luci-static/resources/view/chester-zapret/streaming.js usr/sbin/chester-zapret usr/sbin/chester-videotest usr/share/rpcd/ucode/misectel usr/share/luci/menu.d/luci-app-chester-zapret.json usr/share/luci/menu.d/luci-app-zapret2.json; do
 cp "$REPO/payload/$file" "/$file"
done
chmod 755 /usr/sbin/chester-zapret /usr/sbin/chester-videotest
/sbin/kmodloader
if [ "$want" = 1 ]; then
 /usr/sbin/chester-zapret install
else
 /usr/sbin/chester-zapret uninstall
fi
/etc/init.d/rpcd restart
rm -f /tmp/luci-indexcache*
/etc/init.d/uhttpd reload
/usr/sbin/chester-zapret status

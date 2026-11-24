#!/bin/sh
set -eu
root=${1:?Usage: fan-factory-defaults.sh staged-root}
[ "$(uci -c "$root/etc/config" -q get misectel.main.fan_enabled)" = 1 ]
[ "$(uci -c "$root/etc/config" -q get misectel.main.fan_mode)" = 2 ]
[ "$(uci -c "$root/etc/config" -q get misectel.main.fan_temp_threshold)" = 55 ]
[ ! -e "$root/etc/uci-defaults/98-chester-fan-temperature" ]
printf 'PASS factory fan defaults: Auto, enabled, 55 C; no first-boot override.\n'

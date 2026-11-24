#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test_dir=$(mktemp -d)
trap 'rm -f "$test_dir/pwm1" "$test_dir/pwm1_enable"; rmdir "$test_dir"' EXIT
touch "$test_dir/pwm1" "$test_dir/pwm1_enable"
. payload/usr/lib/chester/fan-speed.sh
uci() { printf '%s\n' "$test_percent"; }
for pair in '20 51' '40 102' '37 94' '60 153' '100 255' 'none 100'; do
 set -- $pair
 test_percent="$1"
 [ "$test_percent" != none ] || test_percent=''
 chester_fan_write_duty "$test_dir/pwm1_enable"
 [ "$(cat "$test_dir/pwm1")" = "$2" ]
done
for test_percent in 0 19 101 invalid 9999999999; do
 if chester_fan_write_duty "$test_dir/pwm1_enable"; then echo 'Invalid fan level accepted' >&2; exit 1; fi
done
echo 'PASS fan presets: 20/37/40/60/100% map to real PWM, legacy output preserved, invalid levels rejected.'

#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
. payload/usr/lib/chester/fan-control.sh
for pair in '20 51' '37 94' '40 102' '60 153' '100 255' 'none 100'; do
 set -- $pair
 test_percent="$1"
 [ "$test_percent" != none ] || test_percent=''
 [ "$(chester_fan_percent_duty "$test_percent")" = "$2" ]
 done
for test_percent in 0 19 101 invalid 9999999999 020; do
 if chester_fan_percent_duty "$test_percent"; then echo 'Invalid fan level accepted' >&2; exit 1; fi
 done
echo 'PASS fan presets: 20/37/40/60/100% map to real PWM, legacy output preserved, invalid levels rejected.'

#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
. payload/usr/lib/chester/fan-control.sh
test_dir=$(mktemp -d)
trap 'rm -f "$test_dir/zone/cdev0" "$test_dir/zone/policy" "$test_dir/zone/mode" "$test_dir/zone/available_policies" "$test_dir/device/type" "$test_dir/policies" "$test_dir/pwm1" "$test_dir/pwm1_enable"; rmdir "$test_dir/zone" "$test_dir/device" "$test_dir"' EXIT
mkdir "$test_dir/zone" "$test_dir/device"
printf '0\n' > "$test_dir/pwm1_enable"
printf '0\n' > "$test_dir/pwm1"
chester_fan_output "$test_dir/pwm1_enable" 255
[ "$(cat "$test_dir/pwm1_enable")" = 1 ] && [ "$(cat "$test_dir/pwm1")" = 255 ]
chester_fan_output "$test_dir/pwm1_enable" 0
[ "$(cat "$test_dir/pwm1_enable")" = 0 ] && [ "$(cat "$test_dir/pwm1")" = 0 ]
chester_fan_output "$test_dir/pwm1_enable" 51
[ "$(cat "$test_dir/pwm1_enable")" = 1 ] && [ "$(cat "$test_dir/pwm1")" = 51 ]
[ "$(chester_fan_auto_state 70 70 0)" = 1 ]
[ "$(chester_fan_auto_state 68 70 1)" = 1 ]
[ "$(chester_fan_auto_state 67 70 1)" = 0 ]
[ "$(chester_fan_boost_state 85 0)" = 1 ]
[ "$(chester_fan_boost_state 82 1)" = 1 ]
[ "$(chester_fan_boost_state 80 1)" = 0 ]
[ "$(chester_fan_percent_duty 37)" = 94 ]
printf 'cpu-frequency\n' > "$test_dir/device/type"
ln -s "$test_dir/device" "$test_dir/zone/cdev0"
printf 'step_wise\n' > "$test_dir/zone/policy"
printf 'enabled\n' > "$test_dir/zone/mode"
printf 'step_wise user_space\n' > "$test_dir/zone/available_policies"
if chester_fan_claim_policy "$test_dir/zone" "$test_dir/policies"; then echo 'Claimed a non-fan cooling zone' >&2; exit 1; fi
[ "$(cat "$test_dir/zone/policy")" = step_wise ]
printf 'pwm-fan\n' > "$test_dir/device/type"
chester_fan_claim_policy "$test_dir/zone" "$test_dir/policies"
[ "$(cat "$test_dir/zone/policy")" = user_space ]
grep -q step_wise "$test_dir/policies"
echo 'PASS fan controller: Off-to-On, exact PWM, automatic hysteresis, high-temperature override, and exclusive ownership restricted to fan-only zones.'

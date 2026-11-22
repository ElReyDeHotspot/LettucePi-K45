#!/bin/sh
# Run on OpenWrt with patched init scripts staged in a temporary directory.
# Service writes/commands are mocked; native procd JSON serialization is real.
TEST_ROOT=${1:?Pass a staged init-script directory}
initscript="$TEST_ROOT/qmodem_network"
. /lib/functions.sh
. /lib/functions/procd.sh
extra_command(){ :; }
logger(){ :; }
initscript="$TEST_ROOT/qmodem_network"
. "$initscript"
MODEM_RUNDIR="$TEST_ROOT/rundir"
rc_procd(){ local method=set; [ -n "$2" ] && method=add; procd_open_service qmodem_network "$initscript"; "$@"; procd_close_service "$method"; }
ubus(){
 [ "$1:$2:$3" = call:service:set ] || return 1
 printf '%s\n' "$4" > "$TEST_ROOT/procd-payload.json"
}
config_load(){ :; }
config_foreach(){ "$1" modem_test; }
qmodem_valid_instance(){ [ "$1" = modem_test ]; }
config_get(){
 local v=1
 [ "$3" != state ] || v=enabled
 [ "$2:$3" != main:enable_dial ] || v="$TEST_ENABLED"
 eval "$1=\$v"
}
TEST_ENABLED=1
rc_procd start_service
[ "$(jsonfilter -i "$TEST_ROOT/procd-payload.json" -e '@.name')" = qmodem_network ] || exit 1
[ "$(jsonfilter -i "$TEST_ROOT/procd-payload.json" -e '@.instances.modem_modem_test.command[2]')" = dial ] || exit 1
TEST_ENABLED=0
rc_procd start_service
[ -z "$(jsonfilter -i "$TEST_ROOT/procd-payload.json" -e '@.instances.modem_modem_test' 2>/dev/null)" ] || exit 1
# An unsupported boost device must not create a process instance.
initscript="$TEST_ROOT/misectel_modem_boost"
. "$initscript"
opened=0
procd_open_instance(){ opened=$((opened+1)); }
procd_set_param(){ :; }
procd_close_instance(){ :; }
read_boost_gpio(){ return 1; }
start_service
[ "$opened" = 0 ] || exit 1
read_boost_gpio(){ printf '/mock/gpio'; }
start_service
[ "$opened" = 1 ] || exit 1
# No ZeroTier firewall/CLI initialization when it is disabled.
initscript="$TEST_ROOT/zerotier"
. "$initscript"
config_load(){ :; }
config_get_bool(){ eval "$1=\$TEST_ENABLED"; }
ZT_CALLS=0
zerotier-fw4(){ ZT_CALLS=$((ZT_CALLS+1)); }
TEST_ENABLED=0
service_started
[ "$ZT_CALLS" = 0 ] || exit 1
TEST_ENABLED=1
service_started
[ "$ZT_CALLS" = 1 ] || exit 1
# The LED reload may remove only an existing instance.
initscript="$TEST_ROOT/qmodem_led"
. "$initscript"
service=qmodem_led
procd_kill(){ KILLS=$((KILLS+1)); }
KILLS=0
ubus(){ printf '%s\n' '{"qmodem_led":{"instances":{"watcher":{"running":true}}}}'; }
stop_led_instance_if_present modem_status_any
[ "$KILLS" = 0 ] || exit 1
stop_led_instance_if_present watcher
[ "$KILLS" = 1 ] || exit 1
echo 'PASS: valid procd startup payload; disabled dial exclusion; boost capability guard; disabled ZeroTier guard; safe LED instance removal. No live services changed.'

set -eu
good='{"enabled":"0","mode":"auto","primary":"wan","backup":"pcie0","targets":"1.1.1.1, 8.8.8.8, 9.9.9.9","interval":"5","fail_count":"3","recover_count":"6"}'
before=$(sha256sum /etc/config/failover | cut -d' ' -f1)
bad=$(printf '%s' "$good" | jq '.targets="999.1.1.1"')
ubus call failover set_config "$bad" | jq -e '.success == false' >/dev/null
[ "$before" = "$(sha256sum /etc/config/failover | cut -d' ' -f1)" ]
bad=$(printf '%s' "$good" | jq '.enabled="1"')
ubus call failover set_config "$bad" | jq -e '.success == false' >/dev/null
ubus call failover set_config "$good" | jq -e '.success == true' >/dev/null
ip -4 route show table main > /tmp/k45p-routes-before
# Automatic rollback also works if the SSH connection is lost during testing.
(sleep 20; uci set failover.main.enabled=0; uci set failover.main.mode=auto; uci commit failover; touch /tmp/failover.kick) </dev/null >/dev/null 2>&1 &
cell=$(printf '%s' "$good" | jq '.enabled="1" | .mode="cell"')
ubus call failover set_config "$cell" | jq -e '.success == true' >/dev/null
sleep 3
ip -4 rule show | grep '22222:.*lookup 222'
ip -4 route show table 222
ip -4 route show table main > /tmp/k45p-routes-during
cmp /tmp/k45p-routes-before /tmp/k45p-routes-during
ping -c 1 -W 2 1.1.1.1 >/dev/null
ubus call failover set_config "$good" | jq -e '.success == true' >/dev/null
sleep 3
if ip -4 rule show | grep -q '22222:.*lookup 222'; then echo 'FAIL: policy not removed'; exit 1; fi
ip -4 route show table main > /tmp/k45p-routes-after
cmp /tmp/k45p-routes-before /tmp/k45p-routes-after
echo 'Passed invalid-target guard, WAN-as-LAN guard, isolated cellular selection, internet reachability and route cleanup'

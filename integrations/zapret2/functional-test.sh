set -eu
cleanup() {
 nft delete table inet chester_z2_probe 2>/dev/null || true
 if [ -f /tmp/k45p-nfq-probe.pid ]; then kill "$(cat /tmp/k45p-nfq-probe.pid)" 2>/dev/null || true; rm -f /tmp/k45p-nfq-probe.pid; fi
}
trap cleanup EXIT
/opt/zapret2/nfq2/nfqws2 --qnum=65000 --daemon --pidfile=/tmp/k45p-nfq-probe.pid --debug=@/tmp/k45p-nfq-probe.log --filter-udp=65100
sleep 1
cat /proc/net/netfilter/nfnetlink_queue
nft add table inet chester_z2_probe
nft 'add chain inet chester_z2_probe output { type filter hook output priority 0; policy accept; }'
nft add rule inet chester_z2_probe output oifname lo udp dport 65100 counter queue num 65000
/tmp/k45p-queue-roundtrip 4
/tmp/k45p-queue-roundtrip 6
nft list table inet chester_z2_probe
tail -8 /tmp/k45p-nfq-probe.log

#!/bin/sh

# Interface-bound connectivity probe for the WAN/5G failover feature.
#
# Probes a single OpenWrt network interface by binding the checks to the
# interface's own address/device, so the result reflects the connectivity of
# that uplink regardless of which interface currently owns the default route.
#
# Usage:
#   wan5g-probe.sh <interface> [timeout]
#
# Exit code 0 means the interface can reach the internet, 1 otherwise.

PROBE_HTTP_TARGETS="" # No background HTTP connectivity callbacks.
PROBE_PING_TARGETS="$(uci -q get failover.main.target)"
[ -n "$PROBE_PING_TARGETS" ] || PROBE_PING_TARGETS="1.1.1.1 8.8.8.8"

# Reuse the endpoint handling from qmodem's LED connectivity helpers when
# available; otherwise provide minimal local fallbacks.
if [ -r /usr/share/qmodem/led_scripts/connectivity.sh ]; then
	. /usr/share/qmodem/led_scripts/connectivity.sh
else
	qmodem_connectivity_wget_bin()
	{
		if command -v wget-ssl >/dev/null 2>&1; then
			echo "wget-ssl"
		elif command -v wget >/dev/null 2>&1; then
			echo "wget"
		else
			return 1
		fi
	}
fi

wan5g_iface_ip()
{
	local iface="$1"

	ubus call "network.interface.${iface}" status 2>/dev/null | \
		jq -r '.["ipv4-address"][0]?.address // empty' 2>/dev/null
}

wan5g_iface_device()
{
	local iface="$1"

	ubus call "network.interface.${iface}" status 2>/dev/null | \
		jq -r '.l3_device // empty' 2>/dev/null
}

wan5g_probe_http()
{
	local bind="$1"
	local timeout="$2"
	local url wget_bin

	wget_bin="$(qmodem_connectivity_wget_bin)" || return 1
	for url in $PROBE_HTTP_TARGETS; do
		"$wget_bin" --spider --quiet --tries=1 --timeout="$timeout" \
			--bind-address="$bind" "$url" >/dev/null 2>&1 && return 0
	done
	return 1
}

wan5g_probe_icmp()
{
	local device="$1"
	local timeout="$2"
	local target

	command -v ping >/dev/null 2>&1 || return 1
	[ -e "/sys/class/net/${device}" ] || return 1
	for target in $PROBE_PING_TARGETS; do
		ping -c 1 -W "$timeout" -I "$device" "$target" >/dev/null 2>&1 && return 0
	done
	return 1
}

# wan5g_probe <interface> [timeout]
wan5g_probe()
{
	local iface="$1"
	local timeout="${2:-3}"
	local ip device

	[ -n "$iface" ] || return 1
	ip="$(wan5g_iface_ip "$iface")"
	device="$(wan5g_iface_device "$iface")"
	[ -n "$device" ] || device="$iface"

	if [ -n "$ip" ] && wan5g_probe_http "$ip" "$timeout"; then
		return 0
	fi

	wan5g_probe_icmp "$device" "$timeout"
}

if [ "$(basename "$0")" = "wan5g-probe.sh" ] && [ "${WAN5G_PROBE_SOURCED:-0}" != 1 ]; then
	wan5g_probe "$@"
	exit $?
fi

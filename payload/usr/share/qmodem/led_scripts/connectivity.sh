#!/bin/sh

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

qmodem_connectivity_wget()
{
	local url="$1"
	local timeout="${2:-3}"
	local wget_bin

	wget_bin="$(qmodem_connectivity_wget_bin)" || return 1
	"$wget_bin" --spider --quiet --tries=1 --timeout="$timeout" "$url" >/dev/null 2>&1
}

qmodem_connectivity_ping()
{
	local target="$1"
	local timeout="${2:-3}"

	command -v ping >/dev/null 2>&1 || return 1
	ping -c 1 -W "$timeout" "$target" >/dev/null 2>&1
}

# Only the configured ICMP health checks; no vendor HTTP endpoints.
qmodem_connectivity_probe()
{
    local timeout="${1:-3}" target targets
    targets="$(uci -q get failover.main.target)"
    [ -n "$targets" ] || targets="1.1.1.1 8.8.8.8"
    for target in $targets; do
        qmodem_connectivity_ping "$target" "$timeout" && return 0
    done
    return 1
}

# Independent uplink tests (pending next bin)

Apps → Failover includes **Test Primary** and **Test Secondary** on the connection
cards. Each runs M-Lab NDT7 download/upload measurements on the router, bound to
the saved interface for that role. Results show Mbps, minimum TCP latency in ms,
and the test time. These are single-connection router-to-server measurements,
not combined-link or Wi-Fi speed measurements. Results stay in RAM until reboot.

Tests are manual only, with one running at a time and a Cancel button. They do
not change the Failover configuration, connection order, WAN/LAN role or vendor
kernel. A failed selected link cannot fall back to another uplink for the test.
The UI exposes M-Lab's public-IP/results publication notice and privacy-policy
link before the test controls. No test runs on page load, boot or a schedule.

## Implementation

`main.go` wraps M-Lab's reference NDT7 runner at the immutable commit recorded
in `provenance.json`. It is compiled statically for Linux ARM64. TCP sockets,
Locate HTTPS requests and DNS resolution bind to the uplink device and its IPv4
source address. All carry socket mark `0x10000000`. Tests use verified TLS/WSS;
no certificate-verification bypass is present. DNS uses 1.1.1.1 through that same
bound path, independently of the router's active uplink resolver.

`chester-link-test` snapshots the saved role, creates a dedicated marked policy
rule at priority 22190 and table 225 (route protocol 225), and adds an unreachable
default as a guard if the selected device disappears. Only the test process's
marked sockets use these routes. Foreign routing entries cause an error rather
than replacement. Completion, cancellation, error and the worker deadline remove
the test routes and lock. Main-table routes and Load Balance rules are retained.
The engine has a 50-second context deadline; the worker has a 65-second guard.

Authenticated LuCI write permission is required for start/cancel. The RPC accepts
only fixed role values, requires the notice flag, and passes no user-provided
interface names or URLs to the shell. Saved-order changes must be applied before
testing those card labels. Offline and LAN-mode uplinks cannot start a test.

Rebuild only the engine (not a firmware image) with `scripts/build-ndt7.sh`, using
Go >= 1.25.5. The recorded build uses Go 1.27.4. Upstream's Apache license is
included here; compiled dependency licenses ship under
`payload/usr/share/chester/ndt7-licenses`.

## Live validation, 2026-11-21

With Cellular Primary, Verizon Ethernet WAN Secondary and Load Balance enabled:

| Link | Download | Upload | Minimum TCP latency |
|---|---:|---:|---:|
| Primary / Cellular | 299.9 Mbps | 5.0 Mbps | 29.0 ms |
| Secondary / Ethernet WAN | 56.3 Mbps | 10.2 Mbps | 32.4 ms |

Output packet counters matching the test socket mark showed traffic on the
selected device and **zero on the other uplink** for each test. Both completed
and removed their routing rules. Invalid role/injection inputs, missing notice,
and concurrent starts were rejected. Browser start/cancel worked. A test-only
output drop caused an explicit failure with zero test packets on the other link;
cleanup and unchanged Load Balance configuration were verified. The latest
successful measurements were restored after these cancellation/failure checks.

These measurements reflect those test times, not guaranteed link capacity.
Source and live components are updated; no new firmware image was built or
published. Include this payload in the next owner-authorized bin.

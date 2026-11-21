# Fast failover validation

The fast profile uses a two-second interval, a one-second shared probe deadline,
one failed check to switch, and three healthy checks before returning to Primary.
Targets are raced in parallel. A reply returns immediately; multiple unreachable
targets cannot multiply the timeout. This works with the vendor BusyBox, without
fractional sleep or wait-n support. Failover remains Off by default.

On 2026-11-20, ten controlled IPv4 tests were performed with Verizon connected to
Ethernet WAN and the internal cellular uplink available. Fresh TCP connections
to Google and verified HTTPS requests to Cloudflare were bound to the Windows
client's wired interface; an nftables counter confirmed transit through K45P.
Each active fault type was tested twice, followed by one standby-only failure in
each priority order. Every fault had a five-second router-side recovery watchdog.

| Simulated failure | Observed failed-request gap |
| --- | --- |
| Verizon WAN interface down | 0–0.6 seconds |
| Verizon internet blackhole with link up | 3.7 seconds |
| Cellular interface down | No failed probes |
| Cellular internet blackhole with link up | 2.7–3.8 seconds |
| Unused backup fails, either order | No failed probes |

The worst combined TCP/HTTPS gap was 3.805 seconds. Actual selection of the backup
was observed after 1.121–3.189 seconds. Primary recovery holdoff took 5.781–10.279
seconds while the backup carried traffic. Test rules were removed afterward,
Failover was returned to Off, and the owner's Cellular → WAN priority was kept.

These are finite fresh-connection measurements, not a guarantee for established
streams or VPN reconnection. IPv6 and DNS latency were not measured. A zero result
means no failed probes at the sampling resolution. Interface-down tests were
software simulations rather than physical cable pulls or modem radio resets.

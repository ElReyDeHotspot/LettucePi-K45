# LAN load balancing (pending next firmware build)

Apps → Failover has a Load Balance mode alongside Automatic, Primary only,
and Secondary only. The existing enable switch controls all four modes.
Shipping defaults remain Off / Automatic. No firmware image was built for
this change; the source and live router have been updated.

Load Balance distributes new IPv4 connections from the main LAN approximately
50/50 across healthy uplinks. It uses conntrack marks to keep a connection on
its selected uplink rather than alternating packets. A single download uses
one uplink. Equal connection counts do not imply equal bandwidth usage.
Router-originated traffic, including forwarded DNS queries, uses a healthy
uplink; device-bound health probes retain their own interface's main-table route.
IPv6 and other LAN/guest interfaces retain their existing routing.
No VPS or external bonding service is involved.

Health checks use the existing interval, timeout, failure and recovery settings
for both uplinks. New traffic uses the surviving uplink after a failure; sharing
resumes after recovery. Sessions whose uplink fails may need to reconnect.
Left/right order does not change the equal share in this mode.

The helper `usr/libexec/chester-load-balance` owns an IPv4 nftables table
`chester_balance`, policy tables 222/223 using route protocol 222, and policy
rules 22220/22221. Rules 22215/22216 keep bound probes on their devices; rule
22217 selects a healthy uplink for locally generated traffic. It reserves
connection/packet mark bits `0x0c000000`, leaving
other bits intact, including Zapret's mark. Existing foreign routes or rules
at these table/priority locations cause a visible error rather than replacement.
Main-table routes are not edited. LAN local/broadcast/multicast destinations,
incoming uplink traffic and reply-direction packets are excluded from marking.
Stopping or disabling Failover removes the owned nftables and policy rules.

On 2026-11-20, wired client tests through the K45P completed 40 verified HTTPS
connections with two public egress addresses (22/18 split). Each uplink was then
separately blackholed with a router-side recovery timer. The daemon selected the
survivor in 2.9 and 3.2 seconds; eight subsequent HTTPS requests succeeded in each
case through a single egress, and sharing returned after recovery. Router HTTPS
and uncached main-LAN DNS responses also passed during both failures. Existing
Automatic and forced modes passed API/routing checks. Invalid modes were rejected
without changing configuration. The phone interface was checked at 390px width;
Load Balance selection and saving passed. The owner's Off / Automatic setting
and Cellular → WAN order were restored afterward. Eleven WAN/LAN safety cases
and service-stop cleanup checks passed.

These checks are not a throughput benchmark or a guarantee of application
reconnection time. No kernel, Wi-Fi calibration, or firmware image was changed.

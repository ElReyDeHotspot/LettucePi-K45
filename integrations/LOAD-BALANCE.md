# Load balancing

Open **Chester Mods → Failover** and choose Load Balance.
New IPv4 LAN connections are shared across healthy cellular and WAN uplinks.
Each connection stays on one uplink; this does not combine both links into
a single faster download.

Failover is off by default. Existing sessions may reconnect when a link fails.
IPv6 keeps its existing routing.

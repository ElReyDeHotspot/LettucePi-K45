# Chester K45P

Custom firmware and OTA updates for the Chester K45P.

## Specifications

| Component | Specification |
| --- | --- |
| Processor | MediaTek MT7988D, up to 1.8 GHz |
| Memory | 1 GB RAM |
| Cellular modem | Quectel RM551E-GL |
| Cellular modes | 5G SA, 5G NSA, LTE |
| SIM slots | Dual SIM |
| WAN / LAN | 1 x 2.5Gbps, switchable WAN or LAN |
| LAN | 3 x 1Gbps |
| Wi-Fi | 2.4 GHz and 5 GHz |
| Firmware | LP-OpenWrt25 |

## Features

- Live cellular overview, dual SIM with hot-plug, and provider-aware band/tower scans.
- Failover, load balancing and isolated Guest Wi-Fi.
- Live Traffic, Block Lists, Cloudflare and DMZ.
- Built-in Ookla and M-Lab speed tests.
- Wi-Fi, VLANs, fan control, TTL/HL and terminal.
- Sun/Night themes and signed OTA updates.

## Firmware

Latest published: **Rev. 15 · v1.0.15**.

[Download firmware](firmware/LettucePi-K45P-1.0.15-sysupgrade.itb) ·
[Release manifest](firmware/latest.json)

Use **Overview → Update** to install updates.
For fresh vendor routers, run [Update-K45P.cmd](scripts/Update-K45P.cmd).
The Windows installer erases saved settings.

Router address: `192.168.100.1` · Login: `root` / `admin`.
For K45P hardware only (`misectel,m02k45`). Vendor Linux 6.12.94 is retained.

## Build

Use Linux/WSL with FIT, SquashFS, Node.js with Acorn (`node-acorn`), apk-tools 3 and OpenWrt fwtool:

```sh
APK_TOOLS=/path/to/apk3 FWTOOL=/path/to/fwtool \
  bash scripts/build.sh /path/to/K45-original-25.12.1.itb /var/tmp/k45p-build-new
```

[Base provenance](provenance.json) · [Release verification](firmware/SECURITY.md)

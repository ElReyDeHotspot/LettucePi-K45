# Chester K45P

Custom firmware and OTA updates for the Chester K45P.

## Specifications

| Component | Specification |
| --- | --- |
| Processor | MediaTek MT7988D, up to 1.8 GHz |
| Memory (RAM) | 1 GB |
| Flash Storage | 128 MiB Winbond SPI NAND |
| Default Gateway Address | 192.168.100.1 |
| Cellular modem | Quectel RM551E-GL |
| Cellular modes | 5G SA, 5G NSA, LTE |
| SIM slots | Dual SIM |
| 2.5Gbps WAN/LAN | 1 x RJ45 port, switchable WAN or LAN |
| LAN | 3 x 1Gbps |
| Wi-Fi Standard | Wi-Fi 7 (IEEE 802.11be), dual-band |
| Wi-Fi Chipset | MediaTek MT7992 |
| Wi-Fi Antennas | 4 antennas |
| 2.4 GHz Wi-Fi | 2×2 MIMO, up to 40 MHz channel width |
| 5 GHz Wi-Fi | 3×3 MIMO, up to 160 MHz channel width |
| Firmware | LP-OpenWrt25 |

## Features

- Live cellular overview, dual SIM with hot-plug, and provider-aware band/tower scans.
- Failover, load balancing and isolated Guest Wi-Fi.
- Live Traffic, Block Lists, Cloudflare and DMZ.
- Built-in Ookla and M-Lab speed tests.
- Wi-Fi, VLANs, fan control, TTL/HL and terminal.
- Sun/Night themes and signed OTA updates.

## Firmware

Latest published: **Rev. 20 · v1.0.20**.

[Download firmware](firmware/LettucePi-K45P-1.0.20-sysupgrade.itb) ·
[Release manifest](firmware/latest.json)

Use **Overview → Update** to install updates. Rev. 20 enables small signed app updates.
Earlier releases receive Rev. 20 through their existing OTA path; keep settings enabled.
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

[Changelog](CHANGELOG.md) · [Base provenance](provenance.json) · [Release verification](firmware/SECURITY.md)

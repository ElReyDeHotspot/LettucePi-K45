# LettucePi K45P

## Bin 6 — finalized build 202611200009

Version 1.0.5 / bin 6 includes the current Chester K45P UI and apps, K43P
layout, four-by-four band grid, mobile controls, fan shortcut, consistent
APN presets, SSH banner, NIC speed labels and WAN/LAN switch, plus Overview
shortcuts ordered Reboot, Software Update, Speedtest, Failover. Reboot opens
the existing confirmation page.

Carp4 Zapret2 and matching NFQUEUE modules are included in the image. The
video engine remains off until enabled through Overview or Apps. Terminal,
Failover monitoring, signed OTA verification and patched upstream uHTTPd are
included. The vendor Linux 6.12.94 kernel and device tree remain byte-identical.
Standard HTTP management is retained by owner choice; no certificate setup
is required after factory reset.

Build 202611200009 supersedes the earlier bin 6 builds, adding the
last Overview shortcuts, explicit clean-install LAN/login defaults, and the
K43P Quick Start timezone/APN steps, branding and WAN/LAN selection fix.
Skipping the password step retains the requested default login.
Fresh routers use 192.168.100.1 and root/admin. OTA uses the increasing build ID,
so existing devices can distinguish this finalized image.

For fresh vendor routers, Windows `scripts/Update-K45P.cmd` installs the
newest signed release with `sysupgrade -n`, erasing saved settings. It prompts
for SSH host-key approval and the root password. `--check` downloads and
validates without flashing. The launcher uses ash's built-in printf;
it does not require a base64 utility on the router. Its signed bootstrap
verifies the signed manifest, board, image size, SHA256 and stock image check.
See [release security](firmware/SECURITY.md) and the
[NFQUEUE build recipe](integrations/zapret2/README.md).

Version **1.0.4** fixes the top-right account menu: visible three-dot button,
positioned dropdown, keyboard focus, and links to password settings, reboot
and logout.

Firmware and over-the-air updates for the **K45P**, hardware board
`misectel,m02k45`. The repository URL remains `LettucePi-K45`.

## Included

- K43P-style Overview: cellular signal and carriers, temperature, clients,
  Ethernet ports, LED switch, TTL/HL switch and 4K/HD switch.
- Apps: Tailscale, Speedtest by Ookla, 4K/HD Video, Smart Queue, Failover.
- Cellular IPv6 tools, US APN presets, and browser terminal.
- English interface with Chinese language packages, catalogs and text removed.
- US Wi-Fi country configuration and generation defaults.
- System Update, using this repository's K45P-only manifest.

Tailscale and the official Ookla engine install on demand from their panels.
Traffic shaping and the video engine stay off until enabled by the operator.
Automatic firmware installation is off by default.

Version **1.0.3** matches the K43P theme's 232px desktop sidebar, restores a
compact 56px login logo, and adds **Apps → Failover**. Failover monitors physical
WAN and cellular health, supports automatic or manual uplink selection, and
provides configurable failure/recovery thresholds. It starts disabled.
The WAN socket must be configured as WAN before enabling automatic failover.
It manages IPv4; IPv6 keeps its existing configuration. Selection uses a
separate policy table, preserving netifd's main routes and connected LAN paths.
The monitor/backend is adapted from the user-provided `k43p-failover` source;
the page uses the current LuCI login rather than a separate sign-in.

## Base firmware

The K45P releases use the image read from the running router before modification:
ImmortalWrt **25.12.1**, revision `r37978-cd0a06bfd3fd`, Linux **6.12.94**.
The kernel and device tree are retained byte for byte. No K43P kernel, device
tree, partition-writing script, modem transport switcher or PHY LED watchdog
is installed.

The supplied May 30 image was checked first and **did not match** the router:
it contained 25.12-SNAPSHOT / Linux 6.12.85. The running base was selected
explicitly instead. See [provenance.json](provenance.json).

## Updates

Open **Overview → System Update** to check or install an update. Settings are
kept by default; the page also offers an explicit settings reset option.
The updater verifies the pinned release signature and rollback floor, board identity, manifest family, download size, SHA-256,
and stock `sysupgrade -T` validation. It uses the original K45P FIT upgrade
path and never uses `sysupgrade -F` or the K43P flash method.
The manifest and image are fetched from the same immutable Git commit.

Version **1.0.1** also fixes the vendor first-boot password script so an existing
root password hash is preserved during an upgrade. Use 1.0.1 or later.

Manifest: [`firmware/latest.json`](firmware/latest.json).

The web login accepts **root** and **admin**. Both authenticate against the same
root password, factory default **admin**; changing it changes it for both.
The login form prefills `root`. SSH uses **root**. Existing changed passwords
and network settings are preserved during OTA. Version **1.0.2** introduces
these shared-password web logins.

## Rebuilding

Use Linux or WSL with `dumpimage`, `mkimage`, `unsquashfs`, `mksquashfs`,
Python 3, apk-tools 3, and OpenWrt `fwtool`. Run as root on a Linux filesystem.
Supply the captured original FIT, not the older supplied attachment:

```sh
APK_TOOLS=/path/to/apk3 FWTOOL=/path/to/fwtool \
  bash scripts/build.sh /path/to/K45-original-25.12.1.itb /var/tmp/k45p-build-new
node scripts/check-connection.cjs
```

Build in a fresh work directory. Before publishing, run `sysupgrade -T` on a
K45P, then calculate the finished image's size and SHA-256 for the manifest.
For subsequent releases update the version, numeric build ID, filename and
manifest together. Never publish personal backups, SSH keys or credentials.

The UI payload is adapted from
[LettucePi-K43P](https://github.com/ElReyDeHotspot/LettucePi-K43P) at the commit
recorded in provenance. The K45P connection indicator uses the modem's active
netifd interface, because the vendor's QModem connection-status response can
report disconnected while that interface is up and addressed.

The K45P streaming page uses a simplified view adapted from carp4: a single
on/off control, automatic active-connection selection for streaming tests,
collapsible streaming sites, and advanced settings/diagnostics. The view is
`payload/www/luci-static/resources/view/chester-zapret/streaming.js`; the engine
and saved recipes remain carp4 Zapret2. No firmware image was generated.

The live refinement branch also adds Speedtest and Failover shortcuts below
the last two Overview sockets, uses OpenWrt display branding with the K43P-style
Chester K45P SSH banner, and synchronizes the saved APN list with the six K43P
US presets. These display changes retain the actual vendor version/revision
and kernel recorded in provenance. Vendor HTTP connectivity callbacks and
Chinese DNS probe defaults were replaced with configured ICMP health checks.
Chinese SMS integrations were removed. Tailscale factory autorun is disabled;
its Apps control can explicitly enable it. Version-matched ImmortalWrt package
feeds remain necessary for the vendor userspace; they are package sources,
not telemetry endpoints. No new firmware image was generated.

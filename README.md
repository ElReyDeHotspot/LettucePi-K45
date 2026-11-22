# LettucePi K45P

## Pending next image

Sun/Night appearance now follows the approved Overview mockup. The top-right
sun/moon switch works throughout LP-OpenWrt25, including login, and remembers
the browser preference across pages, refreshes and tabs. No firmware rebuild
has been made for these changes.

APN Config, Band Lock, Cell Lock and Software have the shared Chester styling.
Both lock pages reuse the live Overview Cellular card. Cell Lock opens on 5G
and shows its current status first. The Cellular menu is ordered APN Config,
Cellular Info, AT Commands, IPV6, Band Lock, Cell Lock, QModem, then the remaining
items at the same level. See [UI notes](integrations/CHESTER-UI.md) for validation.

Terminal is now under Chester Mods, with a styled live console, bottom
Terminal/Config navigation and themed configuration tabs. The sidebar uses
Speeds while the page heading remains Chester Speeds. Login uses one compact
card: live Cellular summary above credentials, expandable connection details,
and a visible Log in button on a 375 × 568 phone screen.

## Bin 9 — version 1.0.8, build 202611220002

The approved green-leaf Overview and navigation are included, with visible eNB,
selected network mode, measured CPU/memory, a unified login card and read-only
Cellular preview. Remember uses the browser password manager; Logout is beneath
Developer. Fan Control, Administration, System, Reboot, Software Update,
AT Commands, Cellular Info, TTL/HL and guided wired VLANs share the Chester theme.
Fan Control, VLANs and TTL/HL are available under Chester Mods.

Wi-Fi puts power, name and password first, with expandable security/radio tuning.
Shared and separate names/passwords were saved and applied on a live K45P;
shared on/off, each band alone and both bands on passed runtime checks. Power
updates both the radio and AP flags. All bands validate before changes are staged.
The test restored the original configuration byte-for-byte. TTL/HL supports
independent values and verifies actual rules; prior IPv4/IPv6 packet captures
confirmed 128 becomes 64. No CPU/memory tuning was needed or performed.

All prior apps, bundled Ookla/M-Lab engines, Quick Start, manual SIM policy,
Failover Off defaults, signed OTA, patched uHTTPd and matching NFQUEUE modules
remain included. Vendor Linux 6.12.94 and the device tree are byte-identical.
The image passed stock `sysupgrade -T`; it was built and published without
flashing the connected router. Real-port VLAN datapath validation remains pending.

## Bin 8 — version 1.0.7, build 202611220001

SIM Selection, Failover, Chester Speeds and Zapret2 share the iOS-inspired design.
Chester Mods contains Failover, SIM Selection, Chester Speeds and Zapret2. The
separate M-Lab menu entry is removed; M-Lab remains available in Chester Speeds.
Chester Speeds is centered to match the other pages, with Ookla, M-Lab and the
official browser-based Netflix FAST.com test. Ookla and NDT7 remain bundled in ROM.

Manual SIM selection keeps the chosen physical slot even without data. Automatic
selection and speed tests retain their timeout and rollback. Per-SIM IPv4 rows,
independent tests, queued-operation serialization and cancellation are included.
Factory defaults remain Manual SIM selection and Failover Off / Automatic.
All earlier apps, Quick Start, signed OTA, matching NFQUEUE modules and patched
uHTTPd are retained. Vendor Linux 6.12.94 and the device tree are byte-identical.
See [SIM Selection](integrations/sim/README.md) and
[connection-page design](integrations/CHESTER-UI.md).

## Bin 7 — version 1.0.6, build 202611210001

Both speed-test engines are bundled in the immutable image: the official Ookla
CLI 1.2.0 and the interface-bound M-Lab NDT7 engine. No engine download or install
step is required after factory reset. Ookla uses an Inseego-style light status
card with Download, Upload, Latency, Jitter, progress, cancellation and history.
Apps → Failover includes Automatic, Load Balance, Primary only and Secondary only,
plus independent Test Primary / Test Secondary buttons. Shipping defaults remain
Off / Automatic; the previous Chester UI, apps, signed OTA, patched uHTTPd and
matching NFQUEUE modules are retained. Vendor Linux 6.12.94 and DTB are unchanged.
See [load balancing](integrations/LOAD-BALANCE.md) and [link tests](integrations/ndt7/README.md).

## Previous bin 6 — finalized build 202611200013

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

Build 202611200013 includes touch-friendly Failover priority cards: Primary
on the left and Secondary on the right, drag handles and tap alternatives,
large mode buttons, and advanced details collapsed by default. Swapped
priorities retain correct WAN/LAN safety and independent health checks.
The LAN mode badge switches the socket back to WAN with one tap. Successful
port switches update in place without a notification popup.

It supersedes earlier bin 6 builds, including the
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
- Chester Mods: Failover, SIM Selection, Chester Speeds and Zapret2.
- Apps: Tailscale and Smart Queue.
- Cellular IPv6 tools, US APN presets, and browser terminal.
- English interface with Chinese language packages, catalogs and text removed.
- US Wi-Fi country configuration and generation defaults.
- System Update, using this repository's K45P-only manifest.

Tailscale can be installed from its panel. Ookla and M-Lab engines ship in ROM.
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

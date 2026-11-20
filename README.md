# LettucePi K45P

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
The updater checks board identity, manifest family, download size, SHA-256,
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

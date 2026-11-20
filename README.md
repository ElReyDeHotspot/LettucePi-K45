# LettucePi K45P

Firmware and over-the-air updates for the **K45P**, hardware board
`misectel,m02k45`. The repository URL remains `LettucePi-K45`.

## Included

- K43P-style Overview: cellular signal and carriers, temperature, clients,
  Ethernet ports, LED switch, TTL/HL switch and 4K/HD switch.
- Apps: Tailscale, Speedtest by Ookla, 4K/HD Video, Smart Queue.
- Cellular IPv6 tools, US APN presets, and browser terminal.
- English interface with Chinese language packages, catalogs and text removed.
- US Wi-Fi country configuration and generation defaults.
- System Update, using this repository's K45P-only manifest.

Tailscale and the official Ookla engine install on demand from their panels.
Traffic shaping and the video engine stay off until enabled by the operator.
Automatic firmware installation is off by default.

## Base firmware

Version 1.0.0 uses the image read from the running K45P before modification:
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

Manifest: [`firmware/latest.json`](firmware/latest.json).

The web login uses the vendor's `admin` account, mapped to the root password.
SSH uses `root`. Existing credentials and network settings are preserved.

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

# K45P vendor-kernel NFQUEUE and carp4 Zapret2

Installed and tested live on Chester K45P, 2026-11-20. No kernel, device tree,
firmware image, release manifest or flash partition was replaced.

## Compatibility

- Board: `misectel,m02k45`, ImmortalWrt 25.12.1 / Linux 6.12.94.
- Required kernel package: `6.12.94~768011ae6e81e700abee5e18322a466a-r1`.
- Source: ImmortalWrt commit `cd0a06bfd3fdbc1011e32d35348d2ee013b4daf2`, Linux 6.12.94,
  generic and MediaTek patches from that commit.
- Compiler: release SDK's OpenWrt GCC 14.3.0 with `KCFLAGS=-fno-caller-saves`.
- `kernel.config` is reconstructed from the source defaults and vendor-installed
  kernel packages, with `CONFIG_NETFILTER_NETLINK_QUEUE=m` and `CONFIG_NFT_QUEUE=m`.
  It is not an original vendor config or a claim that all kernel settings match.
- Rebuilt reference objects match the vendor's `.text`, `.rodata`, `.data`,
  `.init.text` and `.exit.text` sections byte for byte for `nfnetlink`,
  `nf_conntrack`, `nf_tables` and `nft_ct`. See `reference-validation.json`.
- New modules are ordinary external GPL modules. No vermagic override, force-load,
  kernel package replacement or public-kmod dependency bypass was used.

The public feed's ABI is different. Its queue modules are **not** included here.
These locally built APKs depend explicitly on the vendor ABI above and contain
only the two added modules and their `/etc/modules.d` startup entries.

## Rebuild modules only

Use Linux/WSL on a Linux filesystem with bash, git, curl, make, GCC for host tools,
flex, bison, zstd, xz, OpenSSL development headers and libelf development headers.

```sh
bash integrations/zapret2/build-modules.sh /var/tmp/k45p-nfqueue-fresh
python3 integrations/zapret2/verify-reference.py /path/to/vendor-modules \
  /var/tmp/k45p-nfqueue-fresh/linux-6.12.94
APK_TOOLS=/path/to/apk3 bash integrations/zapret2/package-modules.sh \
  /var/tmp/k45p-nfqueue-fresh
```

The build targets reference objects and two loadable modules only. It does not
build `Image`, `vmlinux` or a sysupgrade image. Reference vendor modules should
come from the unit's original firmware; do not publish personal router backups.

## Live package update

`packages/` contains locally built `kmod-nfnetlink-queue` and `kmod-nft-queue`,
and these unmodified [carp4 v0.2.0-r29 release packages](https://github.com/carp4/luci-app-zapret2/releases/tag/v0.2.0-r29):

- `zapret2-1.0.5.2-r2-aarch64_cortex-a53.apk` (stored as `zapret2.apk`).
- `luci-app-zapret2-0.2.0-r29-all.apk` (stored as `luci-app-zapret2.apk`).

Hashes are pinned in `packages/SHA256SUMS` and `../zapret2.json`. The installer
uses `--allow-untrusted` for these local/third-party APKs after checksum and
board/kernel checks; it does not change APK's persistent trust configuration.
Userspace dependencies come from the router's existing pinned feeds.

To prepare a small update bundle on the host without copying firmware files:

```sh
git archive HEAD integrations/zapret2 \
  payload/usr/share/ucode/luci/template/header.ut \
  payload/www/luci-static/resources/view/chester-zapret/streaming.js \
  payload/usr/sbin/chester-zapret \
  payload/usr/sbin/chester-videotest payload/usr/share/rpcd/ucode/misectel \
  payload/usr/share/luci/menu.d/luci-app-chester-zapret.json \
  payload/usr/share/luci/menu.d/luci-app-zapret2.json | gzip > k45p-zapret2-live.tar.gz
```

Extract it into a temporary directory on the matching K45P, then run
`sh integrations/zapret2/install-live.sh` from the extracted directory. Installation
briefly restarts the service and web RPC backend. It preserves the prior enabled
state and migrates the original video hostlist on first installation. It does
not reboot or flash firmware. The previously working TPWS binary is retained
for recovery, but its service is stopped/disabled when Zapret2 is active.

Apps → 4K/HD Video opens carp4's panel at `/admin/apps/zapret`. Overview's 4K/HD
control uses the same Zapret2 service, saved boot flag and actual process status.
The live router uses the existing 19-domain hostlist with TLS, HTTP and QUIC
recipes. Interface discovery follows the current default-route uplinks.

## Validation on the live unit

- Both modules loaded; an unhooked nft queue rule was accepted.
- Real nfqws2 queue 65000 round trips passed for IPv4 and IPv6 loopback UDP;
  two queued packets were received unchanged, then test hooks/process were removed.
- Production queue 300 processes packets with zero kernel/user queue drops.
- HTTPS to YouTube returned HTTP 200 over both IPv4 and IPv6.
- Overview off/on removed/recreated the queue hooks and updated saved state.
- Modules were unloaded and reloaded with the startup module loader successfully.
- Web page showed Running, one instance, three profiles and packet counters.
- Kernel stayed 6.12.94; no new dmesg warnings or taint bits. Existing taint 4096
  already came from vendor external modules.
- A full reboot and streaming-throughput comparison have not been performed.
  Packet processing and connectivity do not establish a speed improvement.

Firmware generation remains on hold. Build-script changes prepare this integration
for a future image; no image was generated or published for this update.

Upstream engine: [bol-van/zapret2](https://github.com/bol-van/zapret2).
Kernel source and patches: [ImmortalWrt](https://github.com/immortalwrt/immortalwrt/tree/cd0a06bfd3fdbc1011e32d35348d2ee013b4daf2).

The K45P streaming page uses a simplified view adapted from carp4: a single
on/off control, automatic active-connection selection for streaming tests,
collapsible streaming sites, and advanced settings/diagnostics. The view is
`payload/www/luci-static/resources/view/chester-zapret/streaming.js`; the engine
and saved recipes remain carp4 Zapret2. No firmware image was generated.

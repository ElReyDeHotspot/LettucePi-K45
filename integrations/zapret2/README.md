# Zapret2 and NFQUEUE

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

Package checksums are retained in `packages/SHA256SUMS`.

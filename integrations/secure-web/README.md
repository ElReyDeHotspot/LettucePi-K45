# Patched uHTTPd

This userspace update preserves the captured vendor Linux 6.12.94 kernel, device tree and shared-library ABIs.

Source: [OpenWrt uHTTPd](https://github.com/openwrt/uhttpd), commit `93b05e0b65d91c23c5aa8fdde378df1f174ec71d` (2026-11-05). It contains the type guard from `e76736e5676fb25536b27d45865eb4153c68aca3`, the fix for [GHSA-2mpg-6wp5-435p](https://github.com/openwrt/uhttpd/security/advisories/GHSA-2mpg-6wp5-435p).

Compiler: ImmortalWrt 25.12.1 SDK, AArch64 cortex-a53, GCC 14.3.0, musl. TLS and ubus support enabled; Lua and ucode embedding disabled. LuCI uses its existing ucode CGI. C flags include `-Os -fstack-protector-strong -D_FORTIFY_SOURCE=2`; executable and module link with `-Wl,-z,relro,-z,now`, with no build-host RPATH.

Link headers/libraries use libubox commit `7dd127841e82eb1cfb61185da37dde7b9bd9ba6d` (ABI 20260213), ubus commit `24864e7840b3a02a9ef76284a373f6b2f00b8a9b` (ABI 20251202), and json-c 0.18 (SONAME 5). Vendor stripped libraries could not be linked directly, so the matching libubox/ubus sources were rebuilt for linking only. The firmware retains its vendor runtime libraries. The existing configuration/init/upgrade keep files are packaged with the new server; the unused vendor websocket plugin is removed.

`packages/SHA256SUMS` pins the local APKs. The image builder verifies these before installation. APKs are local unsigned build inputs; release authenticity is provided by the independently signed OTA manifest and its image SHA256.

Live validation: authenticated malformed REST params of string, integer, array and boolean types all return Invalid params while the daemon remains alive. Valid legacy and REST ubus requests, LuCI login, Overview and Terminal were checked. The crashing request was never sent to the original vendor server.

HTTP management remains the shipping configuration at the owner's request. No device TLS certificate, private CA, certificate-renewal service or shared TLS private key is included.

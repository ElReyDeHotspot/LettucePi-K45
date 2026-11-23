# Cloudflare

Encrypted DNS presets, manual IPv4/IPv6 DNS, and optional WARP for the main LAN.

The standalone DNS/routing service is built from `main.go` with Go 1.25 or later using `scripts/build-cloudflare.sh`. It has no external Go dependencies. WARP uses the vendor kernel’s existing WireGuard support and wgcf v2.3.1 (MIT, https://github.com/ViRb3/wgcf/releases/tag/v2.3.1). Its upstream checksum was verified before bundling; bundled binaries are pinned in SHA256SUMS.

DNS and WARP are off by default. Registration requires accepting Cloudflare’s application terms. Every router creates its own credentials locally; no registration, private key, or account token is included in the image. Retained upgrades preserve registration; a factory reset removes it.

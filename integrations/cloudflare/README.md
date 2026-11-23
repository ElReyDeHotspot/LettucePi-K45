# Cloudflare

Encrypted DNS, manual IPv4/IPv6 DNS, Free WARP and optional WARP+ license linking.

Build the standalone service with `scripts/build-cloudflare.sh`. The account helper uses wgcf v2.3.1 at `de6bba7147dc965a1b8e4de113a709750697ccea`, plus the included structured-status and redacted-error patch; rebuild it with `scripts/build-wgcf.sh` and Go 1.26+. Both bundled binaries are pinned in SHA256SUMS. The vendor kernel remains unchanged.

Each router registers privately after accepting Cloudflare terms. WARP+ requires a verified paid entitlement. Keys are never returned by the status API or included in the image. Retained upgrades preserve registration; factory reset removes it.

# Release verification

Version 1.0.5 / bin 6 introduces a pinned usign public key in the read-only firmware at `/usr/share/chester/ota.pub`. Fingerprint: `cd177fe675673b89`. The signing private key is held outside the repository and routers.

The updater resolves main once, fetches `latest.json` and `latest.json.sig` from the same immutable Git commit, verifies the signature before parsing metadata, and fetches the image from that same commit. It then checks product, board, build, filename, size, SHA256 and stock `sysupgrade -T` compatibility. Missing or invalid signatures fail closed, with no unsigned fallback.

The manifest build cannot precede either the installed image build or the persisted minimum build. Installation requires a newer build. The persisted floor advances only after the downloaded image passes its checks. Factory reset removes the mutable floor but the installed image's build and pinned public key remain in the firmware. This prevents OTA replay of older signed releases; it is not secure boot or protection against root access or manual flashing.

`scripts/check-updater.sh` runs on-device checks with ephemeral test keys, exercising valid signatures, altered/missing/foreign signatures, wrong product/board, invalid metadata, immutable fetches and rollback floors without downloading or flashing firmware. Release signing uses `scripts/sign-release.sh` with an externally supplied key.

Older releases do not gain signature enforcement until the new updater is installed. Keep all release artifacts and signatures in the same publication commit. Protect and back up the signing key; loss prevents future updates from being authenticated by existing devices. Key rotation requires an update signed by the currently trusted key.

HTTP LuCI and browser Terminal remain enabled by owner choice. No certificates or certificate provisioning are required for factory reset. The vendor Linux 6.12.94 kernel and device tree are unchanged.

# Small App Updates

Routine System Update releases install independently signed changed files instead of reflashing firmware. Customer settings, kernel, modules and calibration are excluded. Firmware Revision and App Revision are shown separately.

The installer verifies Ed25519 signatures, exact board/kernel/ROM base, archive and individual file hashes, writable flash space and local file conflicts. Releases are cumulative against a ROM base and must retain all paths changed by previous app releases. Symlinks, traversal, configuration paths, kernel profiles and updates to the bootstrap trust mechanism are rejected. Release directories are immutable.

Files are staged and backed up on writable flash before installation. A durable journal rolls back interrupted transactions at early boot. A committed update restarts the router and the existing update window confirms its new build. Factory reset returns to the baked-in firmware and removes overlay app updates.

The bootstrap binary, public key and early recovery service ship in future full firmware. Existing devices need that bootstrap once through an authenticated deployment. The private signing key stays outside this repository. Use `scripts/make-app-update.py` against an extracted ROM and a reviewed prepared payload; `--include` restricts a release to exact reviewed files.

`chester-update firmware-status` and `firmware-install` retain the explicit full-firmware path for base changes. The normal update path never silently falls back to a full flash when an app package fails or is incompatible. UI app releases do not increase the full-firmware revision.

Each ROM build has its own signed channel under `apps/bases/<ROM build>/latest.json`. Publish a signed revision-zero baseline using `scripts/sign-app-baseline.py` with every full firmware release. Revision zero has no downloadable payload and cannot be installed.

The active client fetches `latest.signed.json`, which carries the exact manifest bytes and signature together. This prevents cached versions of separate metadata/signature files from being mixed. Each accepted install pins its verified envelope for the detached worker. Firmware rollback checks use the ROM firmware stamp, independently of overlay app revisions.

Rev.16 clients retain the original signed FIT channel. Rev.20 is the one-time migration image that bakes in the app updater, public key and recovery service; later app packages preserve settings without reflashing the vendor kernel. Resetting an older firmware with only a live bootstrap removes that bootstrap; the migration image retains it after reset.

## Validation

[Live validation results](validation-20261126.json): two signed app updates (11,753 and 12,567 bytes), invalid-release rejection, settings preservation, IPv4/IPv6 from the router and LAN, original Rev.16 OTA compatibility, and an actual settings-preserving Rev.20 full OTA with postboot checks. The shipped customer unit was not accessed.

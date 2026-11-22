# Release verification

OTA verifies a pinned usign signature, product/board compatibility, build number,
image size, SHA-256 and stock `sysupgrade -T` validation. Invalid signatures or
older builds are rejected. Manifest, signature and image use one Git commit.

Signing keys stay outside the repository and routers. The installed image keeps
its public key and build identity after factory reset. OTA verification is not
secure boot or protection against manual flashing/root access.

Sign releases with `scripts/sign-release.sh`. Keep the image and signed manifest
together when publishing.

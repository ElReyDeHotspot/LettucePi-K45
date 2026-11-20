#!/bin/bash
# Package the built modules; does not relabel or replace the kernel package.
set -euo pipefail
WORK=${1:?Usage: package-modules.sh /path/to/module-build-directory}
APK=${APK_TOOLS:-apk}
ABI=6.12.94~768011ae6e81e700abee5e18322a466a-r1
cd "$WORK"
mkdir -p packages
for item in nfnetlink-queue:nfnetlink_queue:nfnetlink:30 nft-queue:nft_queue:nft-core:40; do
 IFS=: read -r name module dependency order <<< "$item"
 root="packages/kmod-$name"
 mkdir -p "$root/lib/modules/6.12.94" "$root/etc/modules.d"
 cp "modules/$module.ko" "$root/lib/modules/6.12.94/"
 printf '%s\n' "$module" > "$root/etc/modules.d/$order-$name"
 "$APK" mkpkg --info "name:kmod-$name" --info version:6.12.94-r1 \
  --info arch:aarch64_cortex-a53 --info license:GPL-2.0-only \
  --info 'description:Chester K45P vendor-kernel NFQUEUE module built from matching source' \
  --info "depends:kernel=$ABI kmod-$dependency" --info "provides:kmod-$name-any" \
  --files "$root" --output "packages/kmod-$name-6.12.94-r1.apk"
done
sha256sum packages/*.apk

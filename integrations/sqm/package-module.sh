#!/bin/bash
set -euo pipefail
WORK=${1:?Usage: package-module.sh /path/to/module-build-directory}
APK=${APK_TOOLS:-/usr/local/bin/apk3}
ABI=6.12.94~768011ae6e81e700abee5e18322a466a-r1
cd "$WORK"
ROOT=packages/kmod-sched-cake
mkdir -p "$ROOT/lib/modules/6.12.94" "$ROOT/etc/modules.d"
cp modules/sch_cake.ko "$ROOT/lib/modules/6.12.94/"
printf 'sch_cake\n' > "$ROOT/etc/modules.d/75-sched-cake"
"$APK" mkpkg --info name:kmod-sched-cake --info version:6.12.94-r1 --info arch:aarch64_cortex-a53 \
 --info license:GPL-2.0-only --info 'description:CAKE queue for the unchanged Chester K45P vendor kernel' \
 --info "depends:kernel=$ABI kmod-sched-core kmod-nf-conntrack" \
 --info provides:kmod-sched-cake-any --files "$ROOT" --output packages/kmod-sched-cake-6.12.94-r1.apk
sha256sum packages/kmod-sched-cake-6.12.94-r1.apk

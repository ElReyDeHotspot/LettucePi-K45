#!/bin/bash
# Build add-on modules only. Never builds or replaces a kernel/image.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=${1:?Usage: build-module.sh /absolute/fresh/build-directory}
bash "$HERE/../zapret2/build-modules.sh" "$WORK"
SDK=$WORK/immortalwrt-sdk-25.12.1-mediatek-filogic_gcc-14.3.0_musl.Linux-x86_64
export PATH="$SDK/staging_dir/toolchain-aarch64_cortex-a53_gcc-14.3.0_musl/bin:$PATH"
export STAGING_DIR="$SDK/staging_dir"
cd "$WORK/linux-6.12.94"
scripts/config --module NET_SCH_CAKE
make ARCH=arm64 CROSS_COMPILE=aarch64-openwrt-linux-musl- KCFLAGS=-fno-caller-saves olddefconfig modules_prepare
make -j4 ARCH=arm64 CROSS_COMPILE=aarch64-openwrt-linux-musl- KCFLAGS=-fno-caller-saves M=net/sched sch_cake.ko sch_tbf.ko sch_ingress.ko
cp net/sched/sch_cake.ko "$WORK/modules/"
aarch64-openwrt-linux-musl-strip --strip-debug "$WORK/modules/sch_cake.ko"

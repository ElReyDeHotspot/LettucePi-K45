#!/bin/bash
# Build loadable modules and reference objects only; never builds a kernel/image.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=${1:?Usage: build-modules.sh /absolute/fresh/build-directory}
[[ "$WORK" = /* && ! -e "$WORK" ]] || { echo 'Choose a fresh absolute work directory' >&2; exit 1; }
mkdir -p "$WORK"
cd "$WORK"
SDK=immortalwrt-sdk-25.12.1-mediatek-filogic_gcc-14.3.0_musl.Linux-x86_64
curl -fL --retry 2 -o sdk.tar.zst "https://downloads.immortalwrt.org/releases/25.12.1/targets/mediatek/filogic/$SDK.tar.zst"
curl -fL --retry 2 -o linux.tar.xz https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.12.94.tar.xz
printf '%s\n' \
 '1dede7c6afa3184eda37511e47a628f6674d2da2ce99a65f788f910ec57c9e5a  sdk.tar.zst' \
 'e998a232b9418db3301cb58468e291a4f41d6ab8306029b30d991f56251dc8d2  linux.tar.xz' | sha256sum -c -
tar --zstd -xf sdk.tar.zst
tar -xf linux.tar.xz
git init -q source
git -C source remote add origin https://github.com/immortalwrt/immortalwrt.git
git -C source fetch --depth 1 origin cd0a06bfd3fdbc1011e32d35348d2ee013b4daf2
git -C source checkout --detach FETCH_HEAD
for dir in source/target/linux/generic/files source/target/linux/mediatek/files source/target/linux/mediatek/files-6.12; do
 cp -a "$dir/." linux-6.12.94/
done
for dir in source/target/linux/generic/backport-6.12 source/target/linux/generic/pending-6.12 source/target/linux/generic/hack-6.12 source/target/linux/mediatek/patches-6.12; do
 source/scripts/patch-kernel.sh linux-6.12.94 "$dir"
done
cp "$HERE/kernel.config" linux-6.12.94/.config
cp "$SDK/build_dir/target-aarch64_cortex-a53_musl/linux-mediatek_filogic/linux-6.12.94/Module.symvers" linux-6.12.94/Module.symvers
export PATH="$WORK/$SDK/staging_dir/toolchain-aarch64_cortex-a53_gcc-14.3.0_musl/bin:$PATH"
export STAGING_DIR="$WORK/$SDK/staging_dir"
cd linux-6.12.94
MAKE=(make ARCH=arm64 CROSS_COMPILE=aarch64-openwrt-linux-musl- KCFLAGS=-fno-caller-saves)
"${MAKE[@]}" olddefconfig modules_prepare
"${MAKE[@]}" -j"${JOBS:-4}" net/netfilter/nfnetlink.o net/netfilter/nf_conntrack.o net/netfilter/nf_tables.o net/netfilter/nft_ct.o
"${MAKE[@]}" -j"${JOBS:-4}" M=net/netfilter nfnetlink_queue.ko nft_queue.ko
mkdir -p "$WORK/modules"
cp net/netfilter/{nfnetlink_queue,nft_queue}.ko "$WORK/modules/"
aarch64-openwrt-linux-musl-strip --strip-debug "$WORK/modules/"*.ko
sha256sum "$WORK/modules/"*.ko
echo "Built modules in $WORK/modules. Verify against vendor references before installing on another unit."

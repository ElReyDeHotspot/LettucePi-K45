#!/bin/sh
# Use the prepared, matching vendor-ABI kernel build tree and toolchain.
set -eu
: "${KERNEL_BUILD:?Set KERNEL_BUILD to the prepared Linux 6.12.94 build tree}"
: "${CROSS_COMPILE:?Set CROSS_COMPILE to the matching aarch64 toolchain prefix}"
repo=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d /var/tmp/k45p-wifi-check.XXXXXX)
cp "$repo/integrations/wifi-check/chester_wifi_check.c" "$repo/integrations/wifi-check/Makefile" "$work/"
printf '0x00000000\tmt76_mcu_send_and_get_msg\tmt76\tEXPORT_SYMBOL_GPL\t\n' >"$work/vendor.symvers"
make -C "$KERNEL_BUILD" ARCH=arm64 CROSS_COMPILE="$CROSS_COMPILE" KCFLAGS=-fno-caller-saves KBUILD_EXTRA_SYMBOLS="$work/vendor.symvers" M="$work" modules
cp "$work/chester_wifi_check.ko" "$repo/payload/usr/lib/chester/wifi-check/chester_wifi_check.ko"
(cd "$repo/payload/usr/lib/chester/wifi-check"; sha256sum chester_wifi_check.ko >SHA256SUMS)

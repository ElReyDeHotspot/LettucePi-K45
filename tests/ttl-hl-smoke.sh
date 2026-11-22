#!/bin/sh
# Read-only validation on a K45P with the new helper installed.
set -eu
work=$(mktemp -d /tmp/ttl-hl-test.XXXXXX)
trap 'rm -rf "$work"' EXIT
{ echo 'table inet chester_ttl_test {'; /usr/sbin/chester-ttl render 65 66; echo '}'; } >"$work/check.nft"
nft -c -f "$work/check.nft"
for value in 0 256 '64x' '64;echo'; do
 if /usr/sbin/chester-ttl render "$value" 64 >/dev/null 2>&1; then echo 'Invalid TTL accepted'; exit 1; fi
 if /usr/sbin/chester-ttl render 64 "$value" >/dev/null 2>&1; then echo 'Invalid HL accepted'; exit 1; fi
done
/usr/sbin/chester-ttl status
printf 'Independent TTL/HL syntax and range validation passed; no rules were applied.\n'

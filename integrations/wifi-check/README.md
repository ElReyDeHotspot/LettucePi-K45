Read-only boot verification for the pinned K45P Linux 6.12.94 / vendor MT7992 driver, variant 0x11.

The helper reads five valid eFuse blocks and compares the 19 mapped override bytes with the driver's active EEPROM. It logs success only if all 19 match. Missing blocks, query failures, mismatches and unsupported variants remain unverified. It does not program eFuse, alter EEPROM or replace calibration.

The boot worker checks the driver and helper hashes, waits for radio registration, runs once, then unloads the helper. It has no resident polling. The underlying kernel, vendor driver instructions and generic templates remain unchanged; two driver diagnostic strings are clarified separately.

This checks active calibration data against eFuse; it does not certify RF performance. Build using `build.sh` with the prepared matching vendor-ABI kernel tree and toolchain.

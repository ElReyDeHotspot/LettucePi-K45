# M-Lab NDT7

The ARM64 engine is bundled; no first-use installation is required.
Failover and SIM Selection offer independent tests for their selected link.
Tests use one TCP connection and show download, upload and latency.

Tests are manual and cancellable. They consume data, and M-Lab publishes
results/public IPs under its policy. Failed link tests do not fall back to a
different uplink. Temporary test routes are removed when the test ends.

Build with `scripts/build-ndt7.sh`. Source provenance and licenses are retained
alongside the implementation.

# Built-in Ookla Speedtest (bin 7)

The image includes the official Ookla CLI 1.2.0 Linux AArch64 executable at
`/usr/bin/speedtest`. The upstream archive was retrieved from
`https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-aarch64.tgz`
and verified against SHA-256
`3953d231da3783e2bf8904b6dd72767c5c6e533e163d3742fd0437affa431bd3`.
Executable provenance and the upstream documentation ship under
`/usr/share/chester/ookla`. The engine is immutable firmware content, with no
first-use download or installation. The old install RPC is retained only as a
compatibility availability response; it does not fetch or install anything.

The UI follows the Inseego/QManager reference supplied by the owner: a light
card, blue Run button, four clear readings (Download, Upload, Latency, Jitter),
progress, server/provider details and recent results. Phone metric cards use
two columns, and history adapts without a wide scrolling table. Engine status
is parsed in one ucode process to avoid launching many jsonfilter processes
while the test is running. Cancellation stops the worker and its CLI child.

This is a router-originated multi-connection Ookla test using active routing.
The separate M-Lab buttons in Failover explicitly test each saved uplink.
Tests are manual; opening either page does not start a test.

Bin 7 / 1.0.6 / build 202611210001 was installed with stock `sysupgrade -n` on
2026-11-21. Both engine hashes matched `/rom` and their active paths, with no
overlay engine installs. Ookla completed and recorded jitter/history; both NDT7
roles completed with zero marked packets on the other uplink. Factory default
Failover was Off / Automatic, the Quick Start appeared, and US region and
Chester-K45P hostname were verified. Owner APN, timezone and Load Balance
preferences were restored on the test router afterward. Shipping defaults are
unchanged. Linux 6.12.94 and the original vendor device tree remain byte-identical.

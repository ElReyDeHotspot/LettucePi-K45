# K45P SIM Selection

The existing Cellular > SIM Selection route now uses two SIM cards, clear active
and standby labels, Manual / Auto-Select / Auto-Switch modes, per-SIM APNs,
progress, cancellation and recent activity. Manual is the factory default.

Auto-Select runs once at the next startup, after modem control is ready, using
the already bundled interface-bound M-Lab NDT engine. Users explicitly allow
startup tests; these consume mobile data and publish results and public IPs under
M-Lab's policy. Criteria are download, upload, or their sum, with minimum speeds,
included slots, preferred slot, compare-both and minimum-only options.
Auto-Switch uses serving-cell RSRP and/or bound Internet checks, dwell, cooldown,
rate limits and optional preferred-slot failback. Modes are mutually exclusive.

Native QModem APIs discover capabilities, read and set the real modem slot.
Manual selection verifies the physical slot, saves its APN and leaves it selected
without waiting for data. Automatic selection and speed tests also verify SIM
readiness and cellular connectivity; a failed or cancelled test or automatic
operation restores its original slot and APN. A private,
root-owned runtime journal supports recovery after service interruption. Existing
network monitoring conflicts are rejected. SIM operations and speed tests share
locks. No modem reset, kernel, device tree or hot-plug setting is changed.

## Inseego reference and presence limitations

The supplied FX4200 reference informed behavior; no Inseego executable or code
was copied. The native slot manager retained cached inactive-card records during
the user's quick and 10–15 second SIM1 removal/reinsertion tests. No corresponding
ubus transition was captured. A distinct read-only physical reader was identified:
`modem2_cli uim_get_physical_slot_status`. After reinsertion it reported both
cards PRESENT, SIM1 INACTIVE and SIM2 ACTIVE. An absent/present transition through
that reader remains unverified. See the sanitized presence capture alongside this file.

On this K45P RM551E-GL, QSIMSTAT reports the active card, but hardware QSIMDET is
disabled. Standby data is explicitly unknown or last checked, never claimed live.
Do not enable hot-plug detection without validating board SIM_PRESENCE wiring and
polarity. QMI UIM state was unavailable on the exposed endpoint. No subscriber
identifiers are persisted except the masked ICCID last four digits; an internal
hash invalidates stale measurements when a different card is observed.

## Validation on 2026-11-21

Go unit tests cover criteria, required measurements and presence parsing. Live
validation covered input rejection, mode roundtrips, same-slot operations,
real NDT selection, native SIM2 selection with empty-card detection and rollback,
a forced weak-signal automatic attempt with cooldown, cancellation and route
cleanup, private runtime permissions, same-slot journal recovery and browser
save/readback. Startup execution was tested by a fresh RAM marker and service
start, once only; no physical router reboot was performed. Phone layout at
390x844 has no horizontal overflow. Two working SIMs were not available, so a
successful two-carrier comparison and failback remain unvalidated.

The router was returned to Manual, SIM1, its original APN and unchanged Failover
load-balance settings. No firmware image was built or flashed for this change.
These source/payload changes are pending the next image; published bin7 is intact.

## Build

Run `scripts/build-sim.sh` with Go 1.25 or later. The daemon uses only the Go
standard library and is compiled statically for linux/arm64. Binary provenance
is in `provenance.json`; the Go license is installed with the payload.

## Dual-card follow-up on 2026-11-22

With T-Mobile in SIM1 and Verizon in SIM2, switching exposed a transient absent
response during SIM initialization. The daemon now allows the full attachment
window before treating absence as final, including during rollback. Unit tests
and the native ARM64 build passed. Live SIM2 readback then confirmed a ready card
registered on Verizon (311480), LTE, but its data session did not connect with
vzwinternet. The vendor dialer logged QMI errors 0xe/0xf and verbose reason 2001;
these alone do not establish the carrier/account cause. Dual-card speed comparison
was not run because it requires a working data session on each SIM. The test
returns to SIM1 and Manual mode; per-SIM APNs are retained on the test router.

## Independent per-SIM tests

Each SIM card has an M-Lab NDT Test speed button, using the same bundled,
interface-bound engine and locks as Failover. Manual mode and saved settings are
required. An inline notice explains mobile data/public IP publication and the
cellular interruption; tests start directly without a popup. The daemon tests only the requested slot and restores the
original slot/APN on success, failure or cancellation. It does not change the
preferred SIM or choose a winner. Progress and cancellation share the page status;
download/upload results appear on the tested card. Results are runtime-only and
invalidated when a different card is observed. Temporary initialization absence
no longer discards a previous measurement.

The owner's MBN AutoSel=0 and deactivate commands both returned OK on November 22;
readback confirmed AutoSel=0. Verizon data still failed on retry. These modem
settings were applied to the live device only, not silently added as factory defaults.
SIM1's independent NDT test completed at 365.8/5.5 Mbps. SIM2's button was verified
to select the physical slot; a successful Verizon NDT result remains blocked by
its data-session failure. No firmware image was built or flashed.

Final-build live checks: SIM1 measured 360.8/5.3 Mbps; the SIM2 test button
selected slot2, cancellation restored SIM1/APN and retained its previous result.
Invalid slot, missing notice and automatic-mode requests were rejected.
No operation or link-test lock remained; Failover configuration was unchanged.

The per-SIM controls now match Failover: blue Test SIM buttons become Cancel test
while running, with inline progress and Download/Upload/Latency rows plus the
M-Lab timestamp. Live verification recorded 281.4/6.2 Mbps and 22.0 ms on SIM1.

## Chester Mods navigation and Manual selection

Chester Mods appears above Cellular with a crown icon and links to Failover,
SIM Selection, Ookla Speedtest and M-Lab NDT. Existing URLs remain usable while
old duplicate sidebar entries are hidden. M-Lab NDT has a dedicated page for
independent primary/secondary tests using the existing Failover RPC and locks.

Manual selection no longer uses the data-attachment deadline. It confirms the
requested physical slot, commits its APN and preferred slot, starts data setup,
and releases the controls. The modem stays on that SIM even if it is empty or
has no working data. Recovery records the requested Manual context, so a service
restart cannot revert a confirmed offline selection. Low-level command timeouts
still bound unresponsive hardware calls; they are not connectivity deadlines.
Automatic switching, startup comparison and speed tests retain their attachment
timeouts and original-slot/APN rollback. No image is built for these changes.

The Manual regression test executes the real dispatcher against a mocked offline
modem and verifies slot2 remains selected, no connectivity probe is required,
the preferred slot is saved and the rollback journal/lock are removed. Go tests
pass. Live selection was observed, but the attempted live offline-hold interval
was inconclusive because user SIM tests overlapped; data dialing was restored
to enabled. Subsequent verification avoids switching the owner's SIM.

Accepted requests now count as busy while still queued. The daemon publishes
ownership before removing the queued file, so a rapid test click cannot replace
a pending manual selection. Busy responses are silent and retain current
progress. Queued cancellation is honored before touching the modem. The queue
exclusion check was validated live with a paused policy daemon and read-only
refresh request; no SIM or APN changed. Independent test progress/cancellation
appears only inside its card, with no duplicate top test banner. Both cards have
an IPv4 row: the active connected slot shows its validated netifd IPv4 address;
inactive cards say Not active rather than displaying a stale address.

After the owner's reboot, Verizon data was observed connected and its completed
NDT result was 49.6/4.3 Mbps. This supersedes the earlier pre-reboot failure; no
additional MBN writes were made. Published bin7 and the vendor kernel remain
unchanged. These changes are committed as pending the next firmware image.


Final queue/cancel verification also confirmed a queued test can be cancelled
before any hardware action. All four Chester Mods routes, crown placement, IPv4
rows and absence of the top individual-test banner were verified in the browser.

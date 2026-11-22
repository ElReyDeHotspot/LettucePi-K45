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
Each operation verifies readback, SIM readiness and cellular connectivity. A
failed or cancelled operation restores its original slot and APN. A private,
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

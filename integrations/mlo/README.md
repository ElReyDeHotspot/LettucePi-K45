# K45P separate MLO network

The existing Wi-Fi page adds an optional, separately saved MLO network. It is
disabled by default. Existing main and guest APs retain their configuration.
The MLO AP joins LAN; it is not an isolated guest network.

## Configuration

The page owns only the `wireless.chester_mlo` wifi-iface section, marked
`chester_managed=mlo-v1`. It uses a **list of devices** containing the 2.4 GHz
and 5 GHz radios, rather than two independent interfaces with matching SSIDs.
The installed K45P netifd ucode expands this list into one AP MLD.

Security is `sae+gcmp256`, PMF required (`ieee80211w=2`), SAE H2E
(`sae_pwe=1`), and fixed `hostapd_bss_options` enabling `SAE SAE-EXT-KEY`.
`mlo=1` and `rnr=1` enable MLO and neighbor reporting. The page never accepts
arbitrary hostapd options from a text field.

The read-only `chester.mlo.status` RPC verifies the board and required installed
netifd/hostapd configuration code. The browser additionally verifies actual
iwinfo EHT capabilities, a common PHY/device path and distinct radio indices.
Both radios must already be enabled, use EHT modes, fixed channels and a common
country. These restrictions avoid silently changing the main network or relying
on untested automatic channel selection during MLO startup.

The MLO SSID must differ from existing SSIDs. Reserved-name collisions, foreign
MLO configurations, pending UCI changes, invalid byte lengths and unmet radio
prerequisites are rejected before any writes. Saving uses LuCI's checked apply
with a 30-second rollback timeout. Disabling preserves the MLO name/password.
The regular Wi-Fi save validates enabled MLO radio dependencies before staging
changes, preventing a silent downgrade or power-off of a participating radio.

## Live evidence — November 26, 2026

Tested on `misectel,m02k45`, kernel 6.12.94, Rev. 20 / App Revision 1, with a
Windows 11 RZ717 WiFi 7 160MHz adapter, driver 5.7.0.5659.

- A temporary AP MLD retained the existing main APs. Its links used channel 1
  (2.4 GHz, EHT20) and channel 36 (5 GHz, EHT80).
- Plain SAE/CCMP initially produced a single-link connection. The final tested
  configuration negotiated SAE extended key (AKM 24) and GCMP-256.
- After disconnecting, performing a full scan and reconnecting, Windows
  explicitly reported an MLD AP with both link IDs. Hostapd confirmed the peer
  addresses on both links. A Wi-Fi 7 label alone was not treated as proof.
- TLS-verified HTTPS returned HTTP 200 over IPv4 and IPv6 using sockets pinned
  to the Wi-Fi interface. Ethernet remained available for management.
- Windows reported a 1441.2 Mbps PHY rate. This is **not measured throughput**.
  The client's encoded maximum simultaneous links was zero; simultaneous
  transmission over both links and aggregate performance were not demonstrated.
- Windows incorrectly displayed an 80 MHz width on its 2.4 GHz link. Router
  status confirmed the actual width was 20 MHz.
- Hostapd logged interface-creation error -23 during setup, followed by both
  links becoming enabled. This was recorded, not suppressed. Long-duration,
  congested-channel, DFS, ACS and additional-client testing remain unverified.
- The temporary network and PC profile were removed. The router's wireless
  configuration was restored byte-for-byte and the PC Wi-Fi radio returned off.

The three UI/RPC files were subsequently copied to the local development unit
for browser verification, leaving the MLO network off. This is a **development
overlay**, not a published signed app update or a change baked into Rev. 20.
Desktop Night/mobile Sun layouts, missing-password validation and read-only
capability RPC were checked live. The successful save/apply path has fixture
coverage; the live connection test used direct UCI configuration.

Tests: `node tests/mlo.cjs`, existing `wifi-save.cjs`/`wifi-enable.cjs`, and
`python tests/mlo-native.py` emitted to native ucode. The capability fixtures
run with mocked reads and make no configuration changes.

## Full firmware Rev. 21

Rev. 21 (`1.0.21`, ROM build `202611270021`) includes these controls in the
immutable full image, with MLO disabled by default. Existing main/guest Wi-Fi
settings are retained during normal upgrades. It includes the signed
revision-zero app baseline for this exact ROM build.

The final image passed extraction/payload/trust/calibration checks and stock
`sysupgrade -T` on the K45P. It was not flashed or boot-tested during release
preparation; the live association evidence above remains a Rev. 20 overlay
test. See `rev21-validation.json` and the repository changelog.

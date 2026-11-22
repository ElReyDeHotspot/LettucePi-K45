# Chester connection-page design

SIM Selection, Failover and Chester Speeds share the scoped iOS-inspired style
in `payload/www/luci-static/resources/chester-ui/ios.css`: grouped light gray
backgrounds, white rounded cards, blue segmented controls, clear type and generous
touch targets. SIM and connection cards stack on phones. Technical SIM information
remains available under SIM details. Save actions no longer cover card controls.
The stylesheet is applied only to `.chester-ios` page roots. The initial page-only restyle left the sidebar untouched; the owner-approved
bin 8 menu refinements are described below.

Chester Speeds uses the existing Ookla page URL so Overview shortcuts continue
to work. Its sidebar entry is now named Chester Speeds. Its top selector offers:

- Ookla: the bundled official CLI, running on the router's current routing.
- M-Lab: the bundled NDT7 engine and existing Failover RPC, with an explicit
  Primary/Secondary choice. Existing interface binding, cancellation and routing
  cleanup are retained. The page reads existing results and offers native history.
- Netflix: the official https://fast.com/ page embedded only after Run is pressed.
  This measures the browser device, including its Wi-Fi/Ethernet path; it is labeled
  distinctly from router-native tests. FAST.com owns the test UI and results.
  Closing the test or changing providers removes the frame. There is no private
  API scraping, third-party package installation, background Netflix request or
  cross-origin result interception. A direct FAST.com link is also available.

The provider selector remains usable while a native test runs, so users can find
and cancel its progress. Starting another test is blocked until the current native
test finishes. M-Lab follows the running role when its tab is selected. Errors are
inline. No SIM, APN, Failover policy, kernel or firmware image changes are required.

Validation on November 22, 2026: JavaScript syntax and diff checks passed. Browser
checks covered desktop and 390x844 phone layouts, all three provider tabs, SIM
technical disclosures, and actual completed Ookla and secondary-WAN M-Lab tests.
Netflix's embedded official test loaded and displayed a completed speed. The
Netflix frame was closed afterward. No horizontal overflow was observed. The
selected SIM, Manual mode and owner Failover configuration were unchanged, both
native test engines were idle, and temporary test routing rule 22190 was absent.
These live checks did not flash firmware. The changes are included in bin 8.

## Bin 8 final menu and Zapret2

The owner requested the standalone M-Lab sidebar entry removed and the existing
Ookla entry renamed Chester Speeds. M-Lab remains a provider inside that page.
All connection-page containers use the same centered maximum width (1120px);
large-desktop browser measurement confirmed a zero-pixel center difference.
Zapret2 now joins Chester Mods and uses the same shared stylesheet, white cards,
blue actions, grouped settings and native-style switch. Its service handlers,
configuration, site lists, strategies and A/B streaming test are unchanged. The
previous Apps URL remains usable for existing Overview shortcuts; its duplicate
menu entry is hidden. Desktop and phone layouts were visually checked without
starting a streaming A/B test or changing the running service/settings.
These refinements are included in bin 8 / 1.0.7, not a separate image.

The final bin 8 artifact passed stock `sysupgrade -T` and signed-manifest
verification. Its packed payload was compared to source, and its kernel/DTB
were compared byte-for-byte with the original vendor capture. It was not flashed
as part of this release task.


## Pending next image: approved Overview

Implemented the approved grouped-card Overview with live carrier/SIM, connection
policy, clients and Wi-Fi summaries. The four top cards navigate respectively to
Chester Mods / SIM Selection, Chester Mods / Failover, Client List and Wi-Fi
settings. Wi-Fi sits immediately beside Clients. Scoped overview.css leaves the
sidebar and other pages unchanged. Cellular details remain available under a
disclosure; polling preserves its open state. Four carrier columns, network mode
buttons, Ethernet port role action, quick controls and the system metrics remain.

Validated on the live router at desktop width and 390px phone width: all four top
links opened the expected pages, modem disclosure opened, live telemetry refreshed,
and the Overview container had no horizontal overflow. Existing mutation handlers
were retained; mode changes, WAN role changes, reboot, service toggles and speed
runs were not executed for this appearance/navigation check. These remain subject
to the owner's function review before release. No image was built or flashed, and
the published signed bin 8 manifest/artifact are unchanged.


## Pending next image: match approved Overview reference

The owner rejected the initial approximation and explicitly expanded scope to
match the approved image's left navigation, including the green leaf. The revised
Overview uses the reference's inline Online pill, stronger typography, pale page
background, compact segmented network modes, inline desktop band rows, white
quick-control tiles, blue icons, and five-column system strip. Four carrier slots
stay visible; unreported carriers display dashes, and additional carriers wrap.
The requested fourth Wi-Fi summary card and all four direct destinations remain.

Shared navigation now uses a native SVG green leaf, navy background, white line
icons, red selected Overview, and tree branches under Chester Mods. The Overview
submenu stays hidden on the home screen and its top link returns home; other
pages retain that submenu and the top-card shortcuts retain access to Clients and
Update. Chester Mods opens initially on Overview and can be collapsed/reopened.
The header retains its functioning account menu and now has an accessible mobile
menu button. Fixed the existing resize listener to call the viewport handler
directly instead of using a click-spinner wrapper on window, which previously
raised a classList error during resize.

Live checks: compared at the approved reference dimensions (1672 x 941), checked
390px phone viewport, clicked all four top shortcuts through to their destination
pages, collapsed/reopened Chester Mods, opened/closed the mobile drawer, and
opened/closed the account menu. The phone Overview had equal client/scroll widths
(351px) and four equal carrier columns. No browser errors appeared in the final
session. JS syntax and git whitespace checks passed. No service/network toggles,
radio-mode changes, speed tests, reboot or image build/flash were performed.
Saved previews: K45P-Approved-Overview-Desktop.jpg and
K45P-Approved-Overview-Phone.jpg in the task outputs directory.


## Pending next image: settings, login and controls

Applied the Overview styling to Fan Control, Administration, System, Reboot,
Software Update, AT Commands, Cellular Info and TTL/HL. Fan Control and TTL/HL
are under Chester Mods. Logout is directly beneath Developer. AT Commands sends
on Enter and offers the owner's six fill-only command shortcuts; only the
read-only AT command was sent during browser validation.

Fan display supports Celsius/Fahrenheit with a browser-local preference and
canonical Celsius thresholds. The visible "Temperature units" label was removed
as requested. Vendor fan mode 1 is correctly described as Always on. No fan
configuration was saved during these checks.

Login now has two aligned white cards: a unified green-leaf/credentials card and
a read-only Cellular card. At phone widths the cards stack. Remember is visibly
labelled beside its checkbox and enables native browser password-manager
behavior; the browser may require its own save confirmation. Only the checkbox
preference is stored locally, never the password. The public GET-only CGI exposes
a strict radio-metric whitelist, excludes SIM/device identifiers and IP/APN data,
and refreshes through a private root-owned runtime directory at most every 30
seconds. Tests cover allowed fields, ignored query arguments and POST rejection.

Wi-Fi now distinguishes Use One Name & Password (Shared/Separate) from Wi-Fi
Power (On/Off), with explanations and a Save & Apply reminder for radio power.
Removed obsolete script-injected controls that could duplicate native switches.
Both bands remain US; no radio, name, password or encryption settings were applied.

The new guided wired IPv4 VLAN page supports network creation, DHCP, Internet
access, isolated firewall zones, native port assignment and advanced tagged
networks. Management VLAN 1 must retain an untagged port. Changes are staged,
reviewed and applied through LuCI's rollback mechanism. Planner tests and draft
browser checks passed; a temporary disconnected bridge verified kernel VLAN
filtering. Real-port VLAN changes and traffic isolation still require field
validation; no real port configuration was applied.

TTL/HL now saves independent values through a validated, locked backend with
configuration rollback and actual nftables readback. Includes LAN VLAN bridges,
preserves IPv6 neighbor discovery and multicast listener control traffic, and
reports success only when both rules match. Existing enabled 64/64 values were
retained. Live packet captures verified client TTL 128 -> 64 and IPv6 hop limit
128 -> 64 on cellular egress. HTTPS succeeded over IPv4 and IPv6. Syntax/range
checks and fw4 validation passed.

Overview CPU uses a one-second /proc/stat delta; memory uses MemTotal minus
MemAvailable. Observed roughly 4-10% CPU and 22-23% memory with about 760 MiB
available. No tuning was needed or performed; optional polling optimizations
were reverted at the owner's request. Selected SA/NSA/LTE mode, NSA metrics,
SIM status and requested label capitalization were corrected.

Final validation: changed JS/JSON/Python syntax, VLAN planner, temperature
conversions, selected-mode parsing, public preview contract and read-only live
TTL/HL smoke checks passed. All 35 changed payload files matched the live router.
Desktop Wi-Fi and desktop/390px login checks confirmed labels and layout; Logout
position and destination were verified without signing the user out. No reboot,
reset, firmware upload or image build/flash was performed. Published bin 8 and
its release manifest remain unchanged.


## Pending next image: visible station ID and simpler Wi-Fi

Overview now shows the existing calculated station ID directly below the signal
metrics, outside collapsed Modem details. LTE/NSA uses eNB; the existing SA gNB
calculation remains unchanged. Live NSA displayed eNB 54712.

Wi-Fi now uses the shared settings theme with two clear sections: Network setup
(shared versus separate band credentials) and Your Wi-Fi network (power, name,
password). Security and per-band radio tuning are expandable. Channel, width,
standard, region and transmit power remain available; transmit power is now a
native view control instead of depending on the legacy injected layout. Existing
load/save behavior is retained, including configured regulatory values. The
password input has an accessible label. A persistent desktop Save & Apply bar
explains the brief possible Wi-Fi interruption; phone controls stack naturally.

Validated JS syntax, opened radio tuning, switched between shared/separate draft
layouts and restored Shared without saving. The 390px phone view has no horizontal
overflow. Live wireless/misectel UCI changes remained empty. No power toggle,
password reveal, Save & Apply, radio reconfiguration or firmware build/flash was
performed. Saved previews: K45P-WiFi-Simple-Desktop.jpg,
K45P-WiFi-Simple-Phone.jpg and K45P-Overview-eNB.jpg in task outputs.

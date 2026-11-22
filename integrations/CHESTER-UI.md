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

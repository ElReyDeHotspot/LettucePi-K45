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

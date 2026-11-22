# Chester connection-page design

SIM Selection, Failover and Chester Speeds share the scoped iOS-inspired style
in `payload/www/luci-static/resources/chester-ui/ios.css`: grouped light gray
backgrounds, white rounded cards, blue segmented controls, clear type and generous
touch targets. SIM and connection cards stack on phones. Technical SIM information
remains available under SIM details. Save actions no longer cover card controls.
The stylesheet is applied only to `.chester-ios` page roots. Sidebar definitions,
menu rendering, crown, global theme CSS and menu labels are unchanged.

Chester Speeds replaces the content at the existing Ookla page URL, retaining the
existing sidebar entry as requested. Its top selector offers:

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
No firmware image was built or flashed; these changes are pending the next bin.

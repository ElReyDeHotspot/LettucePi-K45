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


## Bin 9 release: 1.0.8 / 202611220002

All preceding pending-next-image sections are now included in bin 9. The Wi-Fi
save path additionally validates every band before staging any changes and
handles both wifi-device.disabled and wifi-iface.disabled. Initial enabled state
also respects both flags. A disabled parent radio can therefore be enabled again.
The source-handler regression test covers distinct/shared credentials, all power
combinations and an invalid second-band password without partial staging.

Live verification invoked the actual view save handler and vendor apply helper
with an instrumented UCI adapter, then committed/reloaded the resulting changes
on the connected K45P over Ethernet. Saved SSIDs/keys and enabled runtime SSIDs/keys
matched. Shared on/off, separate 2.4-only, separate 5-only and separate both-on
passed. Disabled radios had their disabled flag set and no running interfaces;
this vendor's netifd can still report up=true on a disabled radio, so up alone
was not treated as proof of active Wi-Fi. Original wireless and misectel config
files were restored byte-for-byte and both radios returned to service. No
credential is included in the validation report. This checked configuration and
running access points; it did not include a separate wireless client's join test.

The packed image matches the updated Wi-Fi and Overview source and new settings
assets/helpers. Executable modes, bundled speed-test engines, SIM boot link,
release version, kernel/DTB identity, manifest signature, image SHA256 and stock
sysupgrade compatibility were checked. The connected router was not flashed.


## Pending next image: LP-OpenWrt25 design name

System > Language and Style > Design now shows the Chester theme once as
LP-OpenWrt25. Duplicate theme paths are collapsed even on retained configurations.
Factory defaults remove the OEM/LettucePi aliases and register LP_OpenWrt25 with
the existing misectel asset path, preserving theme compatibility. The live theme
registry was migrated; Design options were visually checked without applying a
different active design. No firmware image was rebuilt for this label change.


## Pending next image: approved Sun/Night appearance and modem pages

Sun/Night is a shared top-right sun/moon pill in LP-OpenWrt25. The early head
script restores the browser's explicit choice before the page renders; Sun is
the default. Only the appearance enum is stored. Storage events synchronize open
tabs; arrow keys and pressed-state labels support keyboard/screen-reader use.
The anonymous login uses the same control at the top right. No theme package,
external asset, server setting or authentication permission was added.

The Night palette matches the approved navy page/cards, restrained borders,
off-white headings, muted text and blue/green/amber accents. Layout, green leaf,
sidebar icons and red active navigation remain. Overrides cover shared Chester
pages, native forms/tables/tabs, account menus, dialogs, loading states, IPv6,
Smart Queue and login. Images and chart/terminal content are not color-inverted.
Sun retains the existing light surfaces. Native body/ID rules required explicit
specificity overrides; the account button hover no longer creates a pale box.

APN Config now starts with target SIM, carrier preset, a prominent APN field and
Save & Apply. Authentication, connection type and preset management are collapsed.
Existing per-SIM qmodem writes, preset backend and dial-service apply path remain.
The table omits credential columns. Merely loading the page no longer saves the
in-memory preset list. Browser checks selected Verizon/T-Mobile presets without
applying them; authentication and PDP controls remain available. No APN or modem
profile change was applied during this task.

Band Lock has LTE/NSA/SA tabs, large checkbox tiles, selected counts, Select all,
Clear and Restore current draft controls. Currently selected bands missing from
the advertised list remain visible, rather than being silently dropped. A modem
special mask such as 0 is preserved until the user explicitly selects and saves
bands. Empty selections cannot be applied. Saves reject reported modem errors
and compare readback before claiming success. The touch UI and draft restoration
were checked without issuing a set_lockband command.

Band Lock and Cell Lock use the actual Overview fetch/render methods via
chester-ui/overview-core.js and chester-ui/live-cellular.js. Overview itself is a
small view wrapper around those same unchanged methods. A source comparison
confirmed the extracted core preserves the pre-refactor implementation exactly.
The embedded card refreshes modem/interface data every 15 seconds; it does not
start the full Overview metrics/client/service poll. Existing network-mode
buttons, signal readings, eNB and four carrier columns are retained.

Cell Lock has the same settings styling, the live Cellular card above its controls,
and a 5G-first status panel. The editor opens on 5G immediately, exposing Band and
SCS; existing 5G lock values and the reboot-hook preference are prefilled when
reported. LTE remains selectable. Numeric input validation and reported-error/
lock-state readback prevent a false success message. No lock, unlock, reboot hook
or network-mode change was applied during visual checks; physical lock mutation
still needs an intentional operational test.

Software opens on Installed packages, with actual package counts/storage, search,
clear, paging and Installed/Available/Updates navigation. Manual install, upload,
sources and translation filters are under Advanced package tools. Native package
operation, dependency and confirmation handlers are preserved. Missing cached
available lists show Refresh to browse. Search for ttyd, clear, paging and tab
changes passed. No package refresh/install/remove/update or source write was run.
The phone table scrolls inside its card; the root no longer expands to table width.

Cellular navigation is APN Config, Cellular Info, AT Commands, IPV6, Band Lock,
Cell Lock, QModem, followed by IP Passthrough, SMS, Network Monitoring and Traffic
statistics. These remain siblings, explicitly not children of QModem.

Validation: all changed JavaScript syntax passed; appearance persistence,
selection state, cross-tab updates, keyboard use and blocked storage tests passed.
Modem helper tests cover band identity comparison, numeric cell-lock validation
and SIM-specific APN writes. Existing selected-mode and Wi-Fi save regressions
passed. Desktop checks covered Overview, APN, both lock pages, Software and login.
390px checks covered APN, the initial 5G editor, Wi-Fi and Software; additional
Night views checked Failover, SIM Selection, Chester Speeds, Zapret2, Fan,
System and IPv6. Phone headers fit with the toggle;
Software has 375px root scroll width with a 760px table contained in its own
251px scroll area. Login's two cards share the same Night gradient and readable
heading colors. Account menu open/close worked. No bin was built/flashed and
published bin 9, its manifest and signature remain unchanged.


## Pending next image: Terminal navigation and compact login

Terminal moved into Chester Mods; the System Settings entry is hidden and old
URLs remain compatible. A navy/cyan frame wraps the existing ttyd client with
its real login/session, full-screen support and an Open in tab shortcut.
Presentation URL options respect saved client options and explicit URL overrides.
Terminal and Config links appear beneath the content; native top navigation is
hidden on both views. Config retains all 25 native option keys, dependencies,
UCI bindings and Save/Apply behavior, grouped into Connection, Access and Advanced.
The credential field is masked. No ttyd configuration or daemon restart was needed.

Live checks loaded the embedded ttyd login prompt. A separate console session
accepted root login, ran a harmless printf and exited. Config tabs and inactive
SSL/UNIX-socket field hiding were verified without saving configuration. Source
checks confirmed all native option names remain. Terminal URL tests cover IPv6,
HTTPS, explicit URL queries and saved client presentation preferences.

Login has one outer card with Cellular first and leaf/credentials beneath it.
The default view shows carrier, mode, four signal metrics and active band badges.
Connection details expands the full carrier table and retains its expanded state
across status polling. The Log in button fits at 375 × 568, 390 × 667 and
1280 × 720 without scrolling; 844 × 390 uses two columns inside the same card.
Inputs remain 16px with 44px touch targets. Scrolling remains available for
expanded details, the software keyboard, browser zoom or validation messages.
Remember stays labeled and uses the existing browser password manager behavior.
No new public fields or credentials were exposed. Both Sun and Night were checked.

The Chester Mods sidebar entry is Speeds; the page title remains Chester Speeds.
These changes were deployed as live UI files, with source retained for the next
image. No new firmware was built, flashed or published for this work.

# Changelog

## November 26, 2026 — MLO development update

- Added an optional separate Wi-Fi 7 MLO network to the existing Wi-Fi page.
  It defaults off and preserves the main and guest networks' names/passwords.
  The new AP uses LAN access, WPA3 SAE extended key, GCMP-256, required protected
  management frames and neighbor reporting across the 2.4 GHz and 5 GHz links.
- Added a read-only, board-specific installed-stack capability probe and checked
  save/apply with rollback. Invalid credentials, configuration-name conflicts,
  foreign MLO configurations, pending UCI changes and incompatible radio settings
  are rejected before writing. Regular Wi-Fi saves protect active MLO radio
  dependencies. Disabling MLO retains its saved credentials.
- Verified a two-link MLD association on a Windows RZ717 Wi-Fi 7 client and
  interface-bound IPv4/IPv6 HTTPS. A disconnected full scan and reconnect were
  needed to refresh discovery before both links negotiated.
- Tested frontend validation and settings preservation, native capability
  fixtures, desktop Night and mobile Sun layouts. Temporary test networking was
  removed and the router's original wireless configuration restored byte-for-byte.
- No claim of aggregate or simultaneous dual-link throughput: the displayed
  1441.2 Mbps value was a PHY rate, and the client did not establish simultaneous
  transmission performance. Long-duration and additional-client testing remain
  unverified. The live successful association used direct UCI configuration;
  the positive UI save path has fixture coverage.

These are source and local development-overlay changes. They are not baked
into published Rev. 20 and no new K45P full firmware or signed app update is
published by this change.

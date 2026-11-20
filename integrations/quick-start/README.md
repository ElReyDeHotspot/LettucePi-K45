# K43P Quick Start port

The K45P payload includes the patched wizard view and `misectel_setup_wizard` backend. The patch recipes originate from the K43P wrapper, adapted to the K45P vendor wizard and US preset defaults.

Internet Setup includes APN and Time Zone selectors. The backend serves sanitized APN presets and the LuCI timezone table through the existing first-run context, so the controls work before login without synchronous rpcd calls back into itself. Applying the wizard writes both the readable zone name and POSIX timezone, reloads the system clock configuration, and saves the selected APN to detected modem sections. Existing network reload handles redial.

The view also carries K43P branding, removes the literal null subtitle, and retains a changed WAN/LAN selection through step rerenders. The original Wi-Fi and password steps remain. K45P intentionally preserves the current/default password when that step is skipped, following the owner's requested root/admin behavior; it does not import K43P's password-clearing skip behavior.

These files are copied into every image by `scripts/customize.py`, including fresh installations and factory resets. No client configuration or private device data is bundled.

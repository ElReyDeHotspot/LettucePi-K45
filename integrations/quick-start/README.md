# Chester K45P Quick Start

The pending flow starts directly at SIM Selection, then APN Selection, WAN Port,
TTL/HL, Root Password, Timezone and Wi-Fi, followed by a review before Apply.
It uses the Chester Sun/Night appearance and supports phones without horizontal
scrolling. Choices remain in the draft when moving Back; no setting is written
while navigating. The review never prints root or Wi-Fi passwords.

SIM selection saves Manual mode and the selected slot. The APN is saved to that
slot's Chester policy and QModem profile; the existing serialized SIM daemon
performs selection after Apply. Manual selection retains the chosen SIM even
without data. Quick Start does not run speed tests or enable automatic selection.

TTL/HL uses the existing chester-ttl helper, which verifies both live firewall
values. Timezone uses two linked selectors: Region (America, Europe, Africa, etc.),
then City / timezone. Only that region's cities are listed; changing region
clears the previous city, and Back preserves a completed selection. The stored
IANA name and server timezone mapping stay unchanged. Keep current timezone
is available when no change is wanted. A blank root
password keeps the existing password; root/admin continue sharing root's password.
Wi-Fi supports shared or separate names/passwords and an explicit Disable choice.
Disable writes both radio and AP flags, retaining saved credentials for later use.

The existing first-run RPC object and ACL are retained. Completed setup refuses
context and Apply requests. All new fields and known network/radio identities
are validated before writes. The backend is still a sequence of persistent
operations: an operating-system failure during Apply may require retrying;
validation is not a claim of transactional rollback across every subsystem.

Validation: frontend draft tests cover SIM/APN, WAN, TTL/HL bounds, password
confirmation, timezone and disabled/shared/separate Wi-Fi. The backend harness
extracts the real helpers and runs under ucode with all system operations mocked.
It checks validation before writes, SIM/APN policy, verified TTL helper use,
both radio/AP disable flags, server timezone mapping and password whitespace.
Live browser checks traversed all steps, exercised invalid TTL, Back navigation,
Wi-Fi Off and Review, and checked Sun/Night plus a 390px phone viewport. Apply
was not submitted during the UI review, and no new root password was entered.

The new flow is deployed live and committed for the next image. Bin 10 was built
and flashed before this redesign; its original Quick Start remains in /rom.

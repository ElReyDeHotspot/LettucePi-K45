# SIM Selection

Open **Chester Mods → SIM Selection**.

- Manual keeps the chosen SIM even without a data connection.
- Auto-Select compares included SIMs after startup with permission.
- Auto-Switch monitors connection/signal health and supports failback.

Each SIM has its own APN and an independent M-Lab test. Tests can interrupt
cellular service and use mobile data. M-Lab publishes results/public IPs under
its policy. Inactive-card presence is last checked or unknown, not live detection.

Automatic operations and tests retain timeout/recovery handling. Manual is
the factory default.

Build the ARM64 daemon with `scripts/build-sim.sh` and Go 1.25 or later.
Source provenance and licenses are retained alongside the implementation.

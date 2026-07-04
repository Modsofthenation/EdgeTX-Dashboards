# Companion scripts (Tools & Telemetry)

When the user asks for **battery selection**, **flight logging**, **log viewing**, or similar workflow features, generate companion Lua scripts alongside the main dashboard widget.

## Output layout (under `generated/<DashboardName>/`)

| Path | SD card destination | Purpose |
|------|---------------------|---------|
| `main.lua` | `WIDGETS/<DashboardName>/main.lua` | Full-screen dashboard (always required) |
| `tools/*.lua` | `SCRIPTS/TOOLS/<name>.lua` | Configuration wizards, battery picker, log browser |
| `telemetry/*.lua` | `SCRIPTS/TELEMETRY/<name>.lua` | Background loggers, session timers tied to arm switch |
| `INSTALL.md` | `WIDGETS/<DashboardName>/INSTALL.md` | Auto-generated — must document **every** file |

## Battery selector tool (`tools/batt_select.lua`)

- EdgeTX **Tool script** run from SYS → Tools.
- Let user pick pack label, cell count (4S–12S), or mAh preset.
- Persist choice via `model.setGlobalVariable()` or a dedicated source the dashboard reads.
- Dashboard `refresh()` shows selected pack name in footer or battery card subtitle.

## Flight logger (`telemetry/flight_log.lua`)

- EdgeTX **Telemetry script** assigned to a telemetry screen or invoked via long-press TELE.
- On arm (throttle or arm switch), append CSV/line records to `/LOGS/<model>_YYYYMMDD.log` on SD.
- Log: timestamp, RxBt, Curr, Alt, GSpd, RSSI, Bat% (only sensors available in catalog).
- Dashboard shows **last flight duration** and **mAh used** from the log tail when disarmed.

## Log viewer tool (`tools/log_view.lua`)

- Scrollable list of recent log files; show last N lines of selected file on screen.
- Keep UI simple (SMLSIZE lines, PAGE to scroll) — monochrome-friendly patterns.

## Rules

1. **Always** generate `main.lua` dashboard even when companions are requested.
2. Companion scripts must use only catalog telemetry names and EdgeTX APIs from stubs.
3. **Always** call `writeInstallGuide` after validation — INSTALL.md must list widget + each companion with install steps.
4. Do not use `require()` across files; each script is standalone.
5. Name tool files ≤10 chars where possible (EdgeTX script name limits on some radios).

## Install guide requirements (agent must verify)

INSTALL.md must include:

1. Copy `WIDGETS/<name>/` folder to SD card.
2. For each `tools/*.lua`: copy to `SCRIPTS/TOOLS/` and how to run (SYS → Tools).
3. For each `telemetry/*.lua`: copy to `SCRIPTS/TELEMETRY/` and how to assign (Model → Telemetry/Display → Script).
4. Order of setup: discover sensors → install companions → add dashboard widget → full-screen mode.
5. How dashboard and companions interact (e.g. "run Batt Select once per model").

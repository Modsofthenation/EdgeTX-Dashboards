# 212×64 Taranis dashboard design guide

Applies to **X9D+**, **X9E**, and similar **212×64** monochrome radios.

## Constraints

- Only **2–4 metrics** visible at once. No card panels — use simple rows.
- `pad = 4`. Row height **14–16px**.
- Prefer `SMLSIZE` only; avoid `DBLSIZE` unless one hero value.
- Single-column layout; optional two rows stacked.

## Layout sketch

```
┌──────────────────────────┐
│ RQ 92%  RSSI -67         │  y=4
│ Bat 16.2V  12.4A         │  y=20
│ FM: ACRO                 │  y=48
└──────────────────────────┘
```

- Use `LCD_W` / `LCD_H`. Cache telemetry in `create()`.
- All `lcd.*` calls directly in `refresh()`.

## Anti-patterns

- Multi-column cards, progress bars, or more than 4 text lines.
- Color names other than `WHITE`, `BLACK`, `INVERS` (monochrome).

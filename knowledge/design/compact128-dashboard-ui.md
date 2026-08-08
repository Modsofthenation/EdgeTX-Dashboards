# 128×64 compact dashboard design guide

Applies to **Zorro**, **Pocket**, **X7**, **MT12**, and similar **128×64** radios.

## Constraints

- **2–3 metrics max** on screen.
- `pad = 2`. One or two rows of `SMLSIZE` text only.
- No `DBLSIZE`, no filled rectangles unless a single 1px divider.
- Example: `RQ 92%` on line 1, `16.2V` on line 2, `ACRO` on line 3.

## Rules

- Use `LCD_W` / `LCD_H`.
- BOOL option to toggle a second sensor if needed.
- Keep widget names ≤ 8 characters when possible.

## Anti-patterns

- Card layouts, progress bars, or multi-column grids.
- More than 3 `drawText` calls visible at once.

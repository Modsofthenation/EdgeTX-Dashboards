# 480×272 color dashboard design guide

Applies to TX16, TX12, Boxer, Horus X10/X12, Tandem X18/X20, Jumper T16/T18/T20, and similar **480×272** EdgeTX radios.

## Layout (480×272 full-screen)

- Header **36px**, footer **24px**, card row **~100px** tall (shorter than TX15).
- Use `LCD_W` / `LCD_H` for all sizing — never hardcode 480/272.
- Two-column cards: `colW = math.floor((w - pad * 3) / 2)` with `pad = 10`.
- Show **4–6 metrics max** on one screen; hide extras behind BOOL options.

## Typography

- One **DBLSIZE** hero value only.
- Labels `SMLSIZE`, values `MIDSIZE` or one `DBLSIZE`.
- Minimum **14px** gap between label and value lines.

## Colors & cards

- `BLACK` background, `DARKGREY` cards, `GREY` borders.
- Two accent colors max (`GREEN` link, `YELLOW` battery).
- Cache formatted strings as locals before `lcd.drawText` (web preview requirement).

## Anti-patterns

- TX15-sized layouts copied verbatim (cards too tall — content clips at bottom).
- More than 10 `drawText` lines without BOOL toggles.
- Inline `fmtNum()` / `telem()` inside `drawText` arguments.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bboxForRecord, boxesOverlap } from "./bbox.ts";
import {
  COLOR_LCD_FONT_SIZES,
  edgeTxTextSize,
  fontSizeToFlag,
  resolveFontSize,
} from "./fontMetrics.ts";

describe("bboxForRecord", () => {
  it("computes annulus outer circle bbox from rIn/rOut", () => {
    const box = bboxForRecord({
      kind: "annulus",
      x: 240,
      y: 160,
      rIn: 40,
      rOut: 52,
    });
    assert.ok(box);
    assert.equal(box!.x, 240 - 52);
    assert.equal(box!.y, 160 - 52);
    assert.equal(box!.w, 104);
    assert.equal(box!.h, 104);
  });

  it("computes right-aligned text bbox with color-LCD advances", () => {
    const box = bboxForRecord({
      kind: "text",
      x: 100,
      y: 50,
      text: "78%",
      fontSize: COLOR_LCD_FONT_SIZES.SMLSIZE,
      textAlign: "right",
    });
    assert.ok(box);
    // SMLSIZE cw=7 → 3*7=21
    assert.equal(box!.w, 21);
    assert.equal(box!.h, 17);
    assert.equal(box!.x, 79);
  });

  it("sizes MIDSIZE text close to WASM lcd.sizeText footprint", () => {
    const box = bboxForRecord({
      kind: "text",
      x: 12,
      y: 10,
      text: "98%",
      fontSize: COLOR_LCD_FONT_SIZES.MIDSIZE,
    });
    assert.ok(box);
    // Color MIDSIZE: h=29, cw=14 → 42×29 (firmware "98%" ≈ 44.6×29)
    assert.equal(box!.w, 42);
    assert.equal(box!.h, 29);
  });

  it("detects overlapping rects", () => {
    const a = bboxForRecord({ kind: "filledRect", x: 0, y: 0, w: 100, h: 50 })!;
    const b = bboxForRecord({
      kind: "filledRect",
      x: 50,
      y: 25,
      w: 100,
      h: 50,
    })!;
    assert.equal(boxesOverlap(a, b), true);
  });
});

describe("color LCD font metrics", () => {
  it("resolves Lua size flags to LVGL line heights", () => {
    assert.equal(resolveFontSize("SMLSIZE + GREY"), 17);
    assert.equal(resolveFontSize("MIDSIZE + GREEN"), 29);
    assert.equal(resolveFontSize("DBLSIZE + YELLOW"), 40);
    assert.equal(resolveFontSize("XXLSIZE + WHITE"), 69);
    assert.equal(resolveFontSize("BOLD + WHITE"), 20);
    assert.equal(resolveFontSize("WHITE"), 21);
  });

  it("maps pixel heights back to flags without collapsing TIN/BOLD/STD", () => {
    assert.equal(fontSizeToFlag(17), "SMLSIZE");
    assert.equal(fontSizeToFlag(29), "MIDSIZE");
    assert.equal(fontSizeToFlag(40), "DBLSIZE");
    assert.equal(fontSizeToFlag(69), "XXLSIZE");
    assert.equal(fontSizeToFlag(12), "TINSIZE");
    assert.equal(fontSizeToFlag(20), "BOLD");
    assert.equal(fontSizeToFlag(21), null);
  });

  it("round-trips resolveFontSize ↔ fontSizeToFlag for each Lua mode", () => {
    const cases: Array<{ flags: string; size: number; flag: string | null }> = [
      { flags: "TINSIZE + WHITE", size: 12, flag: "TINSIZE" },
      { flags: "SMLSIZE + GREY", size: 17, flag: "SMLSIZE" },
      { flags: "BOLD + WHITE", size: 20, flag: "BOLD" },
      { flags: "WHITE", size: 21, flag: null },
      { flags: "MIDSIZE + GREEN", size: 29, flag: "MIDSIZE" },
      { flags: "DBLSIZE + YELLOW", size: 40, flag: "DBLSIZE" },
      { flags: "XXLSIZE + WHITE", size: 69, flag: "XXLSIZE" },
    ];
    for (const c of cases) {
      assert.equal(resolveFontSize(c.flags), c.size, c.flags);
      assert.equal(fontSizeToFlag(c.size), c.flag, String(c.size));
    }
  });

  it("edgeTxTextSize matches calibrated advances", () => {
    assert.deepEqual(edgeTxTextSize("98%", 29), { w: 42, h: 29 });
    assert.deepEqual(edgeTxTextSize("LINK", 17), { w: 28, h: 17 });
  });
});

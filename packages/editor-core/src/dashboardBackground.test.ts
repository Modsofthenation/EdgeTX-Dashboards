import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STARTER_WIDGET_SOURCE } from "./starterSource.ts";
import {
  DEFAULT_BG_IMAGE_PATH,
  applyDashboardBackground,
  detectDashboardBackground,
} from "./dashboardBackground.ts";

describe("dashboardBackground", () => {
  it("detects solid color on the starter widget", () => {
    const state = detectDashboardBackground(STARTER_WIDGET_SOURCE);
    assert.equal(state.mode, "color");
    assert.equal(state.clearArg, "bg");
  });

  it("applies a solid color literal", () => {
    const next = applyDashboardBackground(STARTER_WIDGET_SOURCE, {
      mode: "color",
      color: "DARKBLUE",
    });
    assert.match(next, /lcd\.clear\(bg\)/);
    assert.match(next, /\{\s*"BgColor"\s*,\s*COLOR\s*,\s*DARKBLUE\s*\}/);
    assert.equal(detectDashboardBackground(next).mode, "color");
  });

  it("switches to model bitmap fullscreen draw", () => {
    const next = applyDashboardBackground(STARTER_WIDGET_SOURCE, {
      mode: "model",
    });
    assert.match(next, /function\s+loadModelBitmap\s*\(/);
    assert.match(next, /modelBmp\s*=\s*modelBmp/);
    assert.match(
      next,
      /if\s+widget\.modelBmp\s+then\s*\n\s*lcd\.drawBitmap\(widget\.modelBmp,\s*0,\s*0\)/,
    );
    assert.equal(detectDashboardBackground(next).mode, "model");
  });

  it("switches to custom image and back to color", () => {
    const withImage = applyDashboardBackground(STARTER_WIDGET_SOURCE, {
      mode: "image",
      imagePath: DEFAULT_BG_IMAGE_PATH,
    });
    assert.match(withImage, /local\s+BG_IMG\s*=\s*"\/IMAGES\/dashbg\.png"/);
    assert.match(withImage, /bgBmp\s*=\s*Bitmap\.open\(BG_IMG\)/);
    assert.match(
      withImage,
      /if\s+widget\.bgBmp\s+then\s*\n\s*lcd\.drawBitmap\(widget\.bgBmp,\s*0,\s*0\)/,
    );
    assert.equal(detectDashboardBackground(withImage).mode, "image");
    assert.equal(
      detectDashboardBackground(withImage).imagePath,
      DEFAULT_BG_IMAGE_PATH,
    );

    const back = applyDashboardBackground(withImage, {
      mode: "color",
      color: "BLACK",
    });
    assert.doesNotMatch(back, /local\s+BG_IMG\s*=/);
    assert.doesNotMatch(back, /bgBmp\s*=/);
    assert.doesNotMatch(back, /drawBitmap\(widget\.bgBmp/);
    assert.equal(detectDashboardBackground(back).mode, "color");
  });

  it("replaces model draw when switching to custom image", () => {
    const model = applyDashboardBackground(STARTER_WIDGET_SOURCE, {
      mode: "model",
    });
    const image = applyDashboardBackground(model, {
      mode: "image",
      imagePath: "/IMAGES/dashbg.png",
    });
    assert.doesNotMatch(image, /drawBitmap\(widget\.modelBmp,\s*0,\s*0\)/);
    assert.match(image, /drawBitmap\(widget\.bgBmp,\s*0,\s*0\)/);
  });
});

/**
 * Bake Insert-menu prefab section thumbnails (cropped to defaultBounds).
 *
 * Usage: npm run render:prefab-thumbs
 *
 * Output: apps/web/public/prefabs/<prefab-id>.png
 * Also writes board composites for full-board Insert actions under
 * apps/web/public/prefabs/boards/<board-id>.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DENSE_CRSF_LAYOUT_ORDER,
  FREESTYLE_LAYOUT_ORDER,
  insertPrefabSections,
  listPrefabSections,
  MINIMAL_QUAD_LAYOUT_ORDER,
  ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
  ROTORFLIGHT_NITRO_LAYOUT_ORDER,
  WHOOP_LAYOUT_ORDER,
} from "../packages/editor-core/src/index.ts";
import {
  PREFAB_SHELL,
  renderLuaCroppedPng,
  renderLuaToPng,
} from "./lib/previewCanvas.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "apps", "web", "public", "prefabs");
const BOARD_DIR = join(OUT_DIR, "boards");

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(BOARD_DIR, { recursive: true });

const sections = listPrefabSections();
for (const prefab of sections) {
  const { source } = insertPrefabSections(PREFAB_SHELL, [prefab.id]);
  const png = renderLuaCroppedPng(source, prefab.defaultBounds, {
    pad: 10,
    maxWidth: 168,
  });
  const out = join(OUT_DIR, `${prefab.id}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}

const BOARDS: { id: string; order: readonly string[] }[] = [
  { id: "rf-heli-electric", order: ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER },
  { id: "rf-heli-nitro", order: ROTORFLIGHT_NITRO_LAYOUT_ORDER },
  { id: "whoop", order: WHOOP_LAYOUT_ORDER },
  { id: "freestyle-quad", order: FREESTYLE_LAYOUT_ORDER },
  { id: "minimal-quad", order: MINIMAL_QUAD_LAYOUT_ORDER },
  { id: "dense-crsf", order: DENSE_CRSF_LAYOUT_ORDER },
];

for (const board of BOARDS) {
  const { source } = insertPrefabSections(PREFAB_SHELL, [...board.order]);
  const png = renderLuaToPng(source);
  const out = join(BOARD_DIR, `${board.id}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}

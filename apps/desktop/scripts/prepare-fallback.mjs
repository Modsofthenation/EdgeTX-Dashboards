import { mkdirSync, cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src-tauri", "fallback");
const dest = join(root, "fallback");

mkdirSync(dest, { recursive: true });
if (!existsSync(join(src, "index.html"))) {
  throw new Error("Missing src-tauri/fallback/index.html");
}
cpSync(src, dest, { recursive: true });
console.log("Prepared Tauri frontendDist fallback at", dest);

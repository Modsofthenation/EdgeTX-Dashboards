#!/usr/bin/env node
/**
 * Patch @edgetx/simulator-ui to stub simuAuxSerial* env imports required by
 * EdgeTX 2.11 WASM but missing from simulator-ui 0.1.0 (Dev Kit Node host has them).
 * Run automatically after npm install.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "node_modules", "@edgetx", "simulator-ui", "dist");

const AUX_STUBS_PLAIN = `,
        simuAuxSerialStart: () => {},
        simuAuxSerialStop: () => {},
        simuAuxSerialSetBaudrate: () => {},
        simuAuxSerialSendBuffer: () => {}`;

const AUX_STUBS_MIN = `,simuAuxSerialStart:()=>{},simuAuxSerialStop:()=>{},simuAuxSerialSetBaudrate:()=>{},simuAuxSerialSendBuffer:()=>{}`;

const WORKER_MARKER = "simuAuxSerialStart:()=>{}";

function patchMainEnv(source) {
  if (source.includes("simuAuxSerialSendBuffer")) return source;

  const plainNeedle = `simuLcdNotify: () => {
          Atomics.add(this.lcdSync, 0, 1), Atomics.notify(this.lcdSync, 0);
        }`;
  if (source.includes(plainNeedle)) {
    return source.replace(plainNeedle, plainNeedle + AUX_STUBS_PLAIN);
  }

  const minNeedle =
    "simuLcdNotify:()=>{Atomics.add(this.lcdSync,0,1),Atomics.notify(this.lcdSync,0)}";
  if (source.includes(minNeedle)) {
    return source.replace(minNeedle, minNeedle + AUX_STUBS_MIN);
  }

  throw new Error("Could not find main-thread env block in simulator-ui bundle");
}

function patchWorkerBlob(source) {
  const re = /["']([A-Za-z0-9+/=]{800,})["']/g;
  let m;
  let patched = source;
  let found = false;
  let already = false;

  while ((m = re.exec(source))) {
    let dec;
    try {
      dec = Buffer.from(m[1], "base64").toString("utf8");
    } catch {
      continue;
    }
    if (!dec.includes("simuLcdNotify")) continue;
    if (dec.includes(WORKER_MARKER)) {
      already = true;
      continue;
    }

    const workerNeedle = `simuLcdNotify: () => {
          Et && (Atomics.add(Et, 0, 1), Atomics.notify(Et, 0));
        }`;
    if (!dec.includes(workerNeedle)) {
      throw new Error("Could not find worker env block in simulator-ui WASM worker blob");
    }

    const patchedDec = dec.replace(workerNeedle, workerNeedle + AUX_STUBS_MIN);
    const patchedB64 = Buffer.from(patchedDec, "utf8").toString("base64");
    patched = patched.replace(m[1], patchedB64);
    found = true;
    break;
  }

  if (already && !found) return source;
  if (!found) {
    throw new Error("Could not locate WASM worker blob in simulator-ui bundle");
  }

  return patched;
}

function patchFile(path) {
  if (!existsSync(path)) {
    console.warn(`skip (missing): ${path}`);
    return false;
  }

  let source = readFileSync(path, "utf8");
  const before = source;
  source = patchMainEnv(source);
  source = patchWorkerBlob(source);

  if (source === before) {
    console.log(`already patched: ${path}`);
    return false;
  }

  writeFileSync(path, source);
  console.log(`patched: ${path}`);
  return true;
}

function main() {
  if (!existsSync(PKG)) {
    console.warn("@edgetx/simulator-ui not installed — skip patch");
    return;
  }

  patchFile(join(PKG, "index.js"));
  patchFile(join(PKG, "index.cjs"));
  console.log("simulator-ui env stubs applied");
}

main();

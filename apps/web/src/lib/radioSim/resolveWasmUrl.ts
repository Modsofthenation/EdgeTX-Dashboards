import type {
  SimFirmwareResolution,
  SimManifest,
} from "~/lib/radioSim/simFirmware";

/** Prefer local /sim blobs; fall back to manifest CDN when dev server has no public/sim yet. */
export async function resolveReachableWasmUrl(
  resolved: SimFirmwareResolution,
  manifest: SimManifest,
): Promise<string> {
  const local = resolved.wasmUrl;
  const candidates = [local];

  if (manifest.source) {
    const base = manifest.source.replace(/\/$/, "");
    const file = local.replace(/^\/sim\//, "");
    candidates.push(`${base}/${file}`);
    candidates.push(`${base}/edgetx-tx15-simulator.wasm`);
  }

  for (const url of candidates) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return url;
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    "EdgeTX WASM firmware is not available. Restart the dev server (npm run dev) to auto-download sim assets.",
  );
}

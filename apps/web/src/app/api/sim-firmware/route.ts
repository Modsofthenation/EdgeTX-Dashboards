import { NextRequest, NextResponse } from "next/server";
import {
  downloadSimFirmware,
  formatBytes,
  getSimFirmwareStatus,
} from "~/server/simFirmware";
import { checkApiAuth, checkRateLimit } from "~/lib/apiSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toClientStatus(status: ReturnType<typeof getSimFirmwareStatus>) {
  return {
    ready: status.ready,
    reason: status.reason,
    defaultVersion: status.defaultVersion ?? null,
    syncedAt: status.syncedAt ?? null,
    source: status.source ?? null,
    radios: status.radios.map((radio) => ({
      id: radio.id,
      name: radio.name,
      flavour: radio.flavour,
      wasm: radio.wasm,
      display: radio.display,
      present: radio.present,
      size: radio.size,
      ok: radio.ok,
      sizeLabel: formatBytes(radio.size),
    })),
    files: status.files.map((file) => ({
      name: file.name,
      present: file.present,
      size: file.size,
      ok: file.ok,
      sizeLabel: formatBytes(file.size),
    })),
  };
}

export async function GET(request: NextRequest) {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  try {
    const status = getSimFirmwareStatus();
    return NextResponse.json(toClientStatus(status));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;
  const rateErr = checkRateLimit(request);
  if (rateErr) return rateErr;

  try {
    const status = await downloadSimFirmware();
    return NextResponse.json({
      ...toClientStatus(status),
      downloaded: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

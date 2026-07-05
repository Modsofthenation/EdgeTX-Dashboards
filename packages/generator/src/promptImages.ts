import type { SDKUserMessage } from "@cursor/sdk";
import type { PromptImage } from "@widget-gen/shared";
import { MAX_PROMPT_IMAGE_BYTES, MAX_PROMPT_IMAGES } from "@widget-gen/shared";

export { MAX_PROMPT_IMAGES, MAX_PROMPT_IMAGE_BYTES };

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function buildReferenceImagesSection(imageCount: number, radioName: string): string {
  if (imageCount <= 0) return "";

  const noun = imageCount === 1 ? "image" : "images";
  return `## Reference ${noun} (${imageCount})

The user attached ${imageCount} reference ${noun} to this message (included as multimodal context). Study them for:

- Layout structure (zones, columns, hero areas, metric strips, header/footer)
- Color palette, contrast, and border treatments
- Typography hierarchy (title vs value vs label sizes)
- Spacing rhythm and card/panel grouping

Recreate the **functional dashboard layout and visual intent** on the ${radioName} LCD (${imageCount}×480×320 class screen). Ignore unrelated chrome in the screenshot (browser frames, desktop apps, radio bezels outside the widget area).`;
}

export function buildSdkUserMessage(text: string, images?: PromptImage[]): string | SDKUserMessage {
  if (!images?.length) return text;
  return {
    text,
    images: images.map((img) => ({
      data: img.data,
      mimeType: img.mimeType,
    })),
  };
}

function decodeBase64ByteLength(data: string): number | null {
  const trimmed = data.trim();
  if (!trimmed || trimmed.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return null;
  const padding = trimmed.endsWith("==") ? 2 : trimmed.endsWith("=") ? 1 : 0;
  return Math.floor((trimmed.length * 3) / 4) - padding;
}

export function validatePromptImages(
  raw: unknown
): { ok: true; images: PromptImage[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, images: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "images must be an array" };
  }
  if (raw.length > MAX_PROMPT_IMAGES) {
    return { ok: false, error: `At most ${MAX_PROMPT_IMAGES} reference images allowed` };
  }

  const images: PromptImage[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      return { ok: false, error: `images[${i}] must be an object` };
    }
    const record = item as Record<string, unknown>;
    const mimeType = typeof record.mimeType === "string" ? record.mimeType.trim().toLowerCase() : "";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return { ok: false, error: `images[${i}] has unsupported type (use PNG, JPEG, WebP, or GIF)` };
    }
    const data = typeof record.data === "string" ? record.data.trim() : "";
    if (!data) {
      return { ok: false, error: `images[${i}] data is required` };
    }
    const byteLength = decodeBase64ByteLength(data);
    if (byteLength === null) {
      return { ok: false, error: `images[${i}] data must be valid base64` };
    }
    if (byteLength > MAX_PROMPT_IMAGE_BYTES) {
      return { ok: false, error: `images[${i}] exceeds ${MAX_PROMPT_IMAGE_BYTES / (1024 * 1024)}MB limit` };
    }
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 120) : undefined;
    images.push({ data, mimeType, ...(name ? { name } : {}) });
  }

  return { ok: true, images };
}

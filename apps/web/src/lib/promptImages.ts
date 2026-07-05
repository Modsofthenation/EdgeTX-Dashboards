import type { PromptImage } from "@widget-gen/shared";
import { MAX_PROMPT_IMAGES, MAX_PROMPT_IMAGE_BYTES } from "@widget-gen/shared";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export interface PendingPromptImage {
  id: string;
  name: string;
  mimeType: string;
  /** Raw base64 (no data-URL prefix) for API payload. */
  data: string;
  /** Data URL for thumbnails in the composer and chat history. */
  previewUrl: string;
}

export function isAllowedPromptImageType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export async function readPromptImageFile(file: File): Promise<PendingPromptImage> {
  if (!isAllowedPromptImageType(file.type)) {
    throw new Error("Use PNG, JPEG, WebP, or GIF images");
  }
  if (file.size > MAX_PROMPT_IMAGE_BYTES) {
    throw new Error(`Each image must be ${MAX_PROMPT_IMAGE_BYTES / (1024 * 1024)}MB or smaller`);
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const data = btoa(binary);
  const previewUrl = `data:${file.type};base64,${data}`;

  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type,
    data,
    previewUrl,
  };
}

export function toPromptImages(pending: PendingPromptImage[]): PromptImage[] {
  return pending.map((img) => ({
    data: img.data,
    mimeType: img.mimeType,
    name: img.name,
  }));
}

export function maxPromptImages(): number {
  return MAX_PROMPT_IMAGES;
}

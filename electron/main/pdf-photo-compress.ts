import { nativeImage } from 'electron';

const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 72;
/** Skip recompress when already under this approximate payload size. */
const SKIP_BELOW_CHARS = 180_000;

const SIGNATURE_KEY = /signature/i;

function compressPhotoDataUrl(dataUrl: string): string {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return dataUrl;
  if (dataUrl.length < SKIP_BELOW_CHARS) return dataUrl;
  // Keep PNG signatures intact — JPEG fills transparent pixels black.
  if (dataUrl.startsWith('data:image/png')) return dataUrl;

  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    if (image.isEmpty()) return dataUrl;

    const { width, height } = image.getSize();
    if (!width || !height) return dataUrl;

    let resized = image;
    const longest = Math.max(width, height);
    if (longest > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / longest;
      resized = image.resize({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        quality: 'better',
      });
    }

    const jpeg = resized.toJPEG(JPEG_QUALITY);
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return dataUrl;
  }
}

/** Deep-clone walk: shrink embedded inspection photo data URLs for PDF rendering. */
export function compressPhotosForPdf<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => compressPhotosForPdf(item)) as T;
  }
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === 'string' && record.dataUrl.startsWith('data:image')) {
    return {
      ...record,
      dataUrl: compressPhotoDataUrl(record.dataUrl),
    } as T;
  }

  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    // Never recompress signature fields (transparent PNG → JPEG = black background).
    if (SIGNATURE_KEY.test(key)) {
      next[key] = child;
      continue;
    }
    if (
      typeof child === 'string' &&
      child.startsWith('data:image') &&
      /photo|image|dataUrl/i.test(key)
    ) {
      next[key] = compressPhotoDataUrl(child);
    } else {
      next[key] = compressPhotosForPdf(child);
    }
  }
  return next as T;
}

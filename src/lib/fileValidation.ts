import {
  MAX_IMAGE_SIZE,
  MAX_FILES_PER_REQUEST,
  TOTAL_SIZE_CAP,
  MIN_IMAGE_WIDTH,
  MIN_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
  ALLOWED_IMAGE_MIME,
} from './imageUploadConfig';

// Basic magic-number checks for common formats
export async function detectMimeFromMagic(file: File): Promise<string | null> {
  const slice = file.slice(0, 12);
  const buf = new Uint8Array(await slice.arrayBuffer());

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';

  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';

  // GIF: GIF87a or GIF89a
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x39 || buf[4] === 0x37) && buf[5] === 0x61
  ) return 'image/gif';

  // HEIC/HEIF often contains 'ftypheic'/'ftypheif' at offset 4
  const ascii = Array.from(buf).map((b) => String.fromCharCode(b)).join('');
  if (ascii.includes('ftypheic')) return 'image/heic';
  if (ascii.includes('ftypheif')) return 'image/heif';

  return null;
}

export async function validateImageFile(file: File): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (file.size > MAX_IMAGE_SIZE) {
    return { ok: false, reason: `File exceeds ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB` };
  }

  const browserType = file.type || '';
  const magicType = await detectMimeFromMagic(file);

  // If magic detection succeeded, require allowlist and agreement with browser type if browser type is present
  if (magicType) {
    if (!ALLOWED_IMAGE_MIME.has(magicType)) {
      return { ok: false, reason: `Unsupported type: ${magicType}` };
    }
    if (browserType && magicType !== browserType) {
      // Mismatch can be suspicious
      return { ok: false, reason: `File content/type mismatch (${browserType} vs ${magicType})` };
    }
  } else {
    // Fallback: require browser-reported type to be in allowlist
    if (!ALLOWED_IMAGE_MIME.has(browserType)) {
      return { ok: false, reason: `Unsupported type: ${browserType || 'unknown'}` };
    }
  }

  return { ok: true };
}

// Load image dimensions client-side
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  // Prefer createImageBitmap when available (faster, no DOM insertion)
  try {
    // @ts-ignore - createImageBitmap exists in browsers supporting it
    if (typeof createImageBitmap === 'function') {
      // @ts-ignore
      const bmp = await createImageBitmap(file);
      const dims = { width: bmp.width, height: bmp.height };
      // @ts-ignore
      bmp.close?.();
      return dims;
    }
  } catch (_) {
    // fall back to Image element below
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image dimensions'));
    };
    img.src = url;
  });
}

export async function validateImageDimensions(file: File): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { width, height } = await getImageDimensions(file);
    if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
      return { ok: false, reason: `Image too small (${width}x${height}). Minimum ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}px` };
    }
    if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
      return { ok: false, reason: `Image too large (${width}x${height}). Maximum ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}px` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'Unable to determine image dimensions' };
  }
}

export async function validateImagesBatch(files: File[]): Promise<{ ok: true } | { ok: false; reasons: string[] }> {
  const reasons: string[] = [];

  if (files.length === 0) {
    reasons.push('No files provided');
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    reasons.push(`Too many files: max ${MAX_FILES_PER_REQUEST} per request`);
  }

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  if (totalSize > TOTAL_SIZE_CAP) {
    reasons.push(`Total upload size exceeds ${Math.round(TOTAL_SIZE_CAP / 1024 / 1024)}MB`);
  }

  // Per-file checks (type, size, dimensions)
  for (const f of files) {
    const basic = await validateImageFile(f);
    if (!basic.ok) reasons.push(`${f.name}: ${basic.reason}`);
    const dims = await validateImageDimensions(f);
    if (!dims.ok) reasons.push(`${f.name}: ${dims.reason}`);
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
}

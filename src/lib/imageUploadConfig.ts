// Centralized image upload configuration used by validation and upload services
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (per file)
export const MAX_FILES_PER_REQUEST = 30; // Align with Edge Function
export const TOTAL_SIZE_CAP = 300 * 1024 * 1024; // 300MB per request (30 files * 10MB)

export const MIN_IMAGE_WIDTH = 800;
export const MIN_IMAGE_HEIGHT = 600;
export const MAX_IMAGE_WIDTH = 8000;
export const MAX_IMAGE_HEIGHT = 8000;

export const ALLOWED_IMAGE_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

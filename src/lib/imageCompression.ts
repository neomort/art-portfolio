import imageCompression from 'browser-image-compression';

export type CompressionOptions = {
  maxSizeMB?: number; // default 1
  maxWidthOrHeight?: number; // default 1920
  initialQuality?: number; // default 0.8
  useWebWorker?: boolean; // default true
};

const DEFAULTS: Required<CompressionOptions> = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  initialQuality: 0.8,
  useWebWorker: true,
};

export async function compressImage(file: File, opts: CompressionOptions = {}): Promise<File> {
  try {
    const options = { ...DEFAULTS, ...opts } as any;
    const compressed = await imageCompression(file, options);
    return new File([compressed], file.name, {
      type: compressed.type,
      lastModified: Date.now(),
    });
  } catch {
    // Fallback to original file on failure
    return file;
  }
}

export async function compressImagesBatch(files: File[], opts: CompressionOptions = {}): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, opts)));
}

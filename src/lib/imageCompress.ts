// Client-side image compression to reduce payload size before OCR.
// Resizes longest edge to maxWidth (default 1400), converts to JPEG.

export interface CompressOptions {
  maxWidth?: number;
  quality?: number; // 0..1
  mime?: 'image/jpeg' | 'image/webp';
}

export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<{ blob: Blob; dataUrl: string; base64: string; }> {
  const maxWidth = opts.maxWidth ?? 1400;
  const quality = opts.quality ?? 0.78;
  const mime = opts.mime ?? 'image/jpeg';

  const dataUrl0 = await readAsDataURL(file);
  const img = await loadImage(dataUrl0);

  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  // White background to drop alpha for JPEG
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress failed'))), mime, quality);
  });
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const base64 = dataUrl.split(',')[1] || '';
  return { blob, dataUrl, base64 };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

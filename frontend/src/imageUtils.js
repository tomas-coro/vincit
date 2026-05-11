// Client-side image resize before upload. Returns a JPEG data URL.
// size = side length of the square crop (default 512px).
// quality = JPEG compression (0..1).
export async function fileToSquareDataUrl(file, size = 512, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) throw new Error('not_an_image');
  // Hard cap on raw file size to avoid OOM on huge HEIC/RAW
  if (file.size > 20 * 1024 * 1024) throw new Error('file_too_large');

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload  = () => resolve(i);
    i.onerror = () => reject(new Error('decode_failed'));
    i.src = dataUrl;
  });

  // Center-crop to a square
  const side  = Math.min(img.width, img.height);
  const sx    = (img.width  - side) / 2;
  const sy    = (img.height - side) / 2;

  const canvas  = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  return canvas.toDataURL('image/jpeg', quality);
}

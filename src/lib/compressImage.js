/**
 * compressImage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side image compression using the browser Canvas API.
 * Zero dependencies — works in any modern browser.
 *
 * Algorithm:
 *  1. Decode image into a canvas, downscale to maxWidth (default 1920 px)
 *  2. Binary-search for the highest quality (0.92 → 0.50) where blob ≤ targetBytes
 *  3. If still too large, reduce canvas dimensions step-by-step (1600→1280→960→800)
 *  4. Output WebP when browser supports it (30-50 % smaller, same perceived quality)
 *  5. Return a new File object — drop-in replacement for the original File
 */

const DIMENSION_STEPS = [1920, 1600, 1280, 960, 800];

/**
 * Load an image File into an HTMLImageElement (works in browser only).
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

/**
 * Draw image onto a canvas scaled to fit within maxDim × maxDim.
 * Preserves aspect ratio; never upscales.
 * @param {HTMLImageElement} img
 * @param {number} maxDim
 * @returns {{ canvas: HTMLCanvasElement, width: number, height: number }}
 */
function drawScaled(img, maxDim) {
  const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width  = Math.round(img.naturalWidth  * ratio);
  const height = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Use high-quality resampling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

/**
 * Convert canvas to a Blob at the given quality.
 * Prefers WebP; falls back to JPEG.
 * @param {HTMLCanvasElement} canvas
 * @param {number} quality  0.0 – 1.0
 * @returns {Promise<{ blob: Blob, mimeType: string }>}
 */
function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    // Try WebP first
    canvas.toBlob(
      (blob) => {
        if (blob) { resolve({ blob, mimeType: 'image/webp' }); return; }
        // WebP not supported — fall back to JPEG
        canvas.toBlob(
          (jpegBlob) => resolve({ blob: jpegBlob, mimeType: 'image/jpeg' }),
          'image/jpeg',
          quality
        );
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Binary-search the highest quality value where the blob stays ≤ targetBytes.
 * @param {HTMLCanvasElement} canvas
 * @param {number} targetBytes
 * @param {number} minQuality
 * @param {number} maxQuality
 * @returns {Promise<{ blob: Blob, mimeType: string, quality: number }>}
 */
async function binarySearchQuality(canvas, targetBytes, minQuality, maxQuality) {
  let lo = minQuality;
  let hi = maxQuality;
  let best = null;

  // Max 8 iterations — precise enough, stays snappy
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const result = await canvasToBlob(canvas, mid);
    if (result.blob.size <= targetBytes) {
      best = { ...result, quality: mid };
      lo = mid; // try higher quality
    } else {
      hi = mid; // too large, reduce quality
    }
    if (hi - lo < 0.02) break; // close enough
  }

  // If we never found a result under target at minQuality, just return minQuality result
  if (!best) {
    const result = await canvasToBlob(canvas, minQuality);
    best = { ...result, quality: minQuality };
  }

  return best;
}

/**
 * Main export. Compresses a browser File and returns a smaller File.
 *
 * @param {File} file                   - Original image File
 * @param {object} [opts]
 * @param {number} [opts.targetBytes]   - Max output size in bytes  (default: 200 000 = 200 KB)
 * @param {number} [opts.maxWidth]      - Max dimension in pixels   (default: 1920)
 * @param {number} [opts.minQuality]    - Minimum JPEG/WebP quality (default: 0.50)
 * @param {number} [opts.maxQuality]    - Starting quality cap      (default: 0.92)
 * @returns {Promise<{ file: File, originalSize: number, compressedSize: number, ratio: number }>}
 */
export async function compressImage(file, opts = {}) {
  const {
    targetBytes = 200_000,
    maxWidth    = 1920,
    minQuality  = 0.50,
    maxQuality  = 0.92,
  } = opts;

  const originalSize = file.size;

  // If already small enough, return as-is (no point recompressing a 50 KB PNG)
  if (originalSize <= targetBytes) {
    return { file, originalSize, compressedSize: originalSize, ratio: 1 };
  }

  const img = await loadImage(file);

  // Try each dimension step until we get under target
  for (const maxDim of DIMENSION_STEPS) {
    if (maxDim > maxWidth && maxDim !== DIMENSION_STEPS[0]) continue;

    const { canvas } = drawScaled(img, maxDim);
    const { blob, mimeType, quality } = await binarySearchQuality(
      canvas, targetBytes, minQuality, maxQuality
    );

    if (blob.size <= targetBytes || maxDim === DIMENSION_STEPS[DIMENSION_STEPS.length - 1]) {
      // Build a sensible filename: strip old ext, add webp/jpg
      const baseName  = file.name.replace(/\.[^.]+$/, '');
      const ext       = mimeType === 'image/webp' ? 'webp' : 'jpg';
      const newName   = `${baseName}_opt.${ext}`;
      const compressed = new File([blob], newName, { type: mimeType });

      return {
        file:           compressed,
        originalSize,
        compressedSize: compressed.size,
        ratio:          compressed.size / originalSize,
        quality:        Math.round(quality * 100),
        dimensions:     { width: canvas.width, height: canvas.height },
      };
    }
    // blob still too large — loop to next smaller dimension step
  }

  // Fallback (should never reach here)
  return { file, originalSize, compressedSize: originalSize, ratio: 1 };
}

/**
 * Format bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

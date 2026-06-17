/**
 * r2Direct.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side (browser) utility for uploading images directly to Cloudflare R2.
 *
 * Flow:
 *   1. Browser calls our /api/r2-presigned-url endpoint to get a signed URL.
 *   2. Browser uploads the image file directly to Cloudflare R2.
 */

/**
 * Upload a single image file directly from the browser to Cloudflare R2.
 *
 * @param {File|Blob} file      – The image file to upload
 * @param {string}    folder    – R2 folder path, e.g. "products/abc-123"
 * @param {string}    publicId  – Filename (e.g. "cover.webp")
 * @param {(pct: number) => void} [onProgress] – Optional progress callback (0-100)
 * @returns {Promise<{ url: string }>}
 */
export async function uploadToR2Direct(file, folder, publicId, onProgress) {
  // Step 1: Get presigned URL from our API
  const sigRes = await fetch('/api/r2-presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, publicId, contentType: file.type || 'image/webp' }),
  });

  if (!sigRes.ok) {
    const err = await sigRes.json().catch(() => ({}));
    throw new Error(`Failed to get upload signature: ${err.error || sigRes.statusText}`);
  }

  const { uploadUrl, publicUrl } = await sigRes.json();

  // Step 2: Upload directly to R2
  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'image/webp');

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: publicUrl });
        } else {
          reject(new Error(`R2 upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.send(file);
    });
  }

  // Simple fetch path
  const response = await fetch(uploadUrl, { 
    method: 'PUT', 
    headers: { 'Content-Type': file.type || 'image/webp' },
    body: file 
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed: ${response.statusText}`);
  }

  return { url: publicUrl };
}

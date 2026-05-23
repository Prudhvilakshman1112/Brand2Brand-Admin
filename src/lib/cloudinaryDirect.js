/**
 * cloudinaryDirect.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side (browser) utility for uploading images directly to Cloudinary.
 *
 * Flow:
 *   1. Browser calls our lightweight /api/cloudinary-signature endpoint
 *      to get a signed timestamp + signature (no image data sent).
 *   2. Browser uploads the image file directly to Cloudinary's upload API.
 *
 * This means image bytes go Browser → Cloudinary, completely bypassing Vercel.
 */

/**
 * Upload a single image file directly from the browser to Cloudinary.
 *
 * @param {File|Blob} file      – The image file to upload
 * @param {string}    folder    – Cloudinary folder path, e.g. "brand2brand/products/abc-123"
 * @param {string}    [publicId] – Optional custom public_id (filename without extension)
 * @param {(pct: number) => void} [onProgress] – Optional progress callback (0-100)
 * @returns {Promise<{ url: string, publicId: string, bytes: number }>}
 */
export async function uploadToCloudinaryDirect(file, folder, publicId, onProgress) {
  // Step 1: Get signature from our API (lightweight JSON — no image data)
  const sigRes = await fetch('/api/cloudinary-signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, publicId }),
  });

  if (!sigRes.ok) {
    const err = await sigRes.json().catch(() => ({}));
    throw new Error(`Failed to get upload signature: ${err.error || sigRes.statusText}`);
  }

  const sig = await sigRes.json();

  // Step 2: Upload directly to Cloudinary (Browser → Cloudinary, bypasses Vercel)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', sig.folder);
  formData.append('timestamp', sig.timestamp.toString());
  formData.append('api_key', sig.apiKey);
  formData.append('signature', sig.signature);
  if (sig.publicId) formData.append('public_id', sig.publicId);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;

  // Use XMLHttpRequest for progress tracking if callback provided
  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.secure_url,
            publicId: data.public_id,
            bytes: data.bytes,
          });
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(`Cloudinary upload failed: ${err.error?.message || xhr.statusText}`));
          } catch {
            reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.send(formData);
    });
  }

  // Simple fetch path (no progress tracking needed)
  const response = await fetch(uploadUrl, { method: 'POST', body: formData });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Cloudinary upload failed: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    bytes: data.bytes,
  };
}

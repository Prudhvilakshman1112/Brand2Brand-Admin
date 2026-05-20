/**
 * cloudinary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-side Cloudinary upload & delete utilities.
 * Uses the REST API directly (no SDK dependency).
 *
 * ENV required:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import { createHash } from 'crypto';

const CLOUD_NAME  = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY     = process.env.CLOUDINARY_API_KEY;
const API_SECRET  = process.env.CLOUDINARY_API_SECRET;

/**
 * Generate SHA-1 hex digest for Cloudinary signature.
 * Uses Node.js built-in crypto module (works in ALL Node.js versions).
 */
function sha1Hex(message) {
  return createHash('sha1').update(message).digest('hex');
}

/**
 * Upload an image file to Cloudinary.
 *
 * @param {File|Blob} file     – The image file (from FormData)
 * @param {string}    folder   – Cloudinary folder path, e.g. "brand2brand/products/abc-123"
 * @param {string}    [publicId] – Optional custom public_id (filename without extension)
 * @returns {Promise<{ url: string, publicId: string, bytes: number }>}
 */
export async function uploadToCloudinary(file, folder, publicId) {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error('Missing Cloudinary credentials in environment variables');
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Build params to sign (sorted alphabetically)
  const paramsToSign = {
    folder,
    timestamp,
    ...(publicId ? { public_id: publicId } : {}),
  };

  // Create the string to sign: "folder=x&public_id=y&timestamp=z" + API_SECRET
  const signatureString =
    Object.keys(paramsToSign)
      .sort()
      .map(k => `${k}=${paramsToSign[k]}`)
      .join('&') + API_SECRET;

  const signature = await sha1Hex(signatureString);

  // Build multipart form
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', API_KEY);
  formData.append('signature', signature);
  if (publicId) formData.append('public_id', publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

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

/**
 * Delete an image from Cloudinary by its public_id.
 *
 * @param {string} publicId – e.g. "brand2brand/products/abc-123/cover"
 * @returns {Promise<boolean>} true if deleted
 */
export async function deleteFromCloudinary(publicId) {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error('Missing Cloudinary credentials');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
  const signature = await sha1Hex(signatureString);

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', API_KEY);
  formData.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    console.error('Cloudinary delete failed:', await response.text());
    return false;
  }

  const data = await response.json();
  return data.result === 'ok';
}

/**
 * Extract the Cloudinary public_id from a Cloudinary URL.
 * e.g. "https://res.cloudinary.com/dbj9ittfl/image/upload/v123456/brand2brand/products/x/cover.webp"
 *   → "brand2brand/products/x/cover"
 *
 * @param {string} url
 * @returns {string|null}
 */
export function extractPublicId(url) {
  if (!url || !url.includes('res.cloudinary.com')) return null;

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // pathname: /dbj9ittfl/image/upload/v123456/brand2brand/products/x/cover.webp
    // We need everything after "/upload/vXXXXXX/" without the file extension
    const uploadMatch = pathname.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!uploadMatch) return null;

    const pathWithExt = uploadMatch[1];
    // Remove file extension
    return pathWithExt.replace(/\.[^.]+$/, '');
  } catch {
    return null;
  }
}

/**
 * Check whether a URL is a Cloudinary URL.
 * @param {string} url
 * @returns {boolean}
 */
export function isCloudinaryUrl(url) {
  return !!url && url.includes('res.cloudinary.com');
}

/**
 * Check whether a URL is a Supabase Storage URL.
 * @param {string} url
 * @returns {boolean}
 */
export function isSupabaseStorageUrl(url) {
  return !!url && url.includes('supabase.co/storage/');
}

/**
 * Extract the Supabase storage path from a Supabase Storage URL.
 * @param {string} url
 * @returns {string|null}
 */
export function extractSupabaseStoragePath(url) {
  if (!isSupabaseStorageUrl(url)) return null;
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.split('/storage/v1/object/public/product-images/')[1];
    return path || null;
  } catch {
    return null;
  }
}

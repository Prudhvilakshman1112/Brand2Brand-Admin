/**
 * /api/cloudinary-signature
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns a signed set of parameters so the browser can upload directly to
 * Cloudinary.  Only the lightweight JSON request hits Vercel — the actual
 * image bytes go Browser → Cloudinary, saving Function Duration & Data Transfer.
 *
 * Body: { folder: string, publicId?: string }
 * Response: { signature, timestamp, apiKey, cloudName, folder, publicId? }
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireAuth } from '@/lib/requireAuth';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY    = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

function sha1Hex(message) {
  return createHash('sha1').update(message).digest('hex');
}

export async function POST(request) {
  try {
    // ── Auth guard — only authenticated admins can get a signature ────────
    const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        { error: 'Missing Cloudinary credentials on server' },
        { status: 500 }
      );
    }

    const { folder, publicId } = await request.json();

    if (!folder) {
      return NextResponse.json({ error: 'folder is required' }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Build params to sign (sorted alphabetically, same as Cloudinary expects)
    const paramsToSign = {
      folder,
      timestamp,
      ...(publicId ? { public_id: publicId } : {}),
    };

    const signatureString =
      Object.keys(paramsToSign)
        .sort()
        .map(k => `${k}=${paramsToSign[k]}`)
        .join('&') + API_SECRET;

    const signature = sha1Hex(signatureString);

    return NextResponse.json({
      signature,
      timestamp,
      apiKey: API_KEY,
      cloudName: CLOUD_NAME,
      folder,
      ...(publicId ? { publicId } : {}),
    });
  } catch (err) {
    console.error('Signature API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

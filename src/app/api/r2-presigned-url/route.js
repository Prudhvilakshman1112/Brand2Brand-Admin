import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    const { errorResponse, user } = await requireAuth();
    if (errorResponse) return errorResponse;

    const { folder, publicId, contentType } = await request.json();

    if (!folder || !publicId || !contentType) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const key = `${folder}/${publicId}`;

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
    // For R2, the public URL structure
    const publicUrl = `${process.env.CLOUDFLARE_PUBLIC_DOMAIN}/${key}`;

    return NextResponse.json({ uploadUrl: url, publicUrl });
  } catch (err) {
    console.error('R2 signature error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

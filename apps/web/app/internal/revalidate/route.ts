import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/api/catalog-tag';

const digest = (value: string) => createHash('sha256').update(value).digest();

// Called by the API after committed stock/copy writes (spec §4.9). Outside /api, which is rewritten to Nest.
// timingSafeEqual throws on buffers of different lengths, so both sides are hashed to a fixed length first.
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get('x-revalidate-secret');
  if (!secret || !given || !timingSafeEqual(digest(given), digest(secret))) {
    return Response.json({ revalidated: false }, { status: 401 });
  }
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}

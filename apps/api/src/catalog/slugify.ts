import type { Prisma } from '@prisma/client';

export function slugify(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'sach';
}

// Slugs are fixed at creation (spec §3.2); a clash gets -2, -3, …
// Two concurrent creates of the same title can still collide → P2002 → 409 DUPLICATE, which is acceptable.
export async function uniqueSlug(tx: Prisma.TransactionClient, title: string): Promise<string> {
  const base = slugify(title);
  const rows = await tx.book.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

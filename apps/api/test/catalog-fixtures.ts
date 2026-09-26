import type { CopyStatus } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';

let seq = 0;

export function createCategory(prisma: PrismaService, name: string, slug: string) {
  return prisma.category.create({ data: { name, slug } });
}

export interface BookFixture {
  title: string;
  author?: string;
  slug?: string;
  salePrice?: number | null;
  stock?: number;
  copies?: CopyStatus[];
}

// Writes stock and copies directly (test-only exception to "writes go through InventoryService").
export function createBook(prisma: PrismaService, categoryId: string, opts: BookFixture) {
  seq += 1;
  return prisma.book.create({
    data: {
      title: opts.title,
      author: opts.author ?? 'Tác giả',
      slug: opts.slug ?? `book-${seq}`,
      isbn: String(9780000000000 + seq),
      description: '',
      categoryId,
      salePrice: opts.salePrice === undefined ? 100_000 : opts.salePrice,
      saleStock: { create: { quantity: opts.stock ?? 0 } },
      copies: { create: (opts.copies ?? []).map((status, i) => ({ status, barcode: `T-${seq}-${i}` })) },
    },
  });
}

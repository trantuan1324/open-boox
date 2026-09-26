import { Prisma } from '@prisma/client';
import { type AvailabilityFilter, BOOK_PAGE_SIZE, type BookSummary, type Paged } from '@open-boox/shared';
import type { PrismaService } from '../prisma/prisma.service';

export interface BookSearch {
  q?: string;
  category?: string;
  availability?: AvailabilityFilter;
  page: number;
}

// ILIKE treats % and _ as wildcards; backslash is the default escape character.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function whereClause(search: BookSearch): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (search.q) {
    const pattern = `%${escapeLike(search.q)}%`;
    conditions.push(Prisma.sql`immutable_unaccent(b.title || ' ' || b.author) ILIKE immutable_unaccent(${pattern})`);
  }
  if (search.category) conditions.push(Prisma.sql`c.slug = ${search.category}`);
  if (search.availability === 'sale') conditions.push(Prisma.sql`b."salePrice" IS NOT NULL AND s.quantity > 0`);
  if (search.availability === 'loan') {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "BookCopy" bc WHERE bc."bookId" = b.id AND bc.status = 'AVAILABLE')`,
    );
  }
  return conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}

const FROM = Prisma.sql`
  FROM "Book" b
  JOIN "Category" c ON c.id = b."categoryId"
  LEFT JOIN "SaleStock" s ON s."bookId" = b.id`;

export async function searchBooks(prisma: PrismaService, search: BookSearch): Promise<Paged<BookSummary>> {
  const where = whereClause(search);
  const offset = (search.page - 1) * BOOK_PAGE_SIZE;
  const [items, counted] = await Promise.all([
    prisma.$queryRaw<BookSummary[]>`
      SELECT b.id, b.slug, b.title, b.author, b.isbn, b."coverUrl", b."salePrice",
             c.name AS "categoryName", c.slug AS "categorySlug",
             COALESCE(s.quantity, 0) AS "saleStock",
             (SELECT count(*)::int FROM "BookCopy" bc
               WHERE bc."bookId" = b.id AND bc.status = 'AVAILABLE') AS "availableCopies"
      ${FROM}
      ${where}
      ORDER BY b.title, b.id
      LIMIT ${BOOK_PAGE_SIZE} OFFSET ${offset}`,
    prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${FROM} ${where}`,
  ]);
  return { items, total: counted[0]?.total ?? 0, page: search.page, pageSize: BOOK_PAGE_SIZE };
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminBookDetail,
  AdminBookRow,
  BookDetail,
  BookInput,
  BookListQuery,
  BookSummary,
  CategoryDto,
  CopyStatus,
  Paged,
} from '@open-boox/shared';
import { COPY_STATUSES } from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { searchBooks } from './book-search';
import { uniqueSlug } from './slugify';

export const detailInclude = {
  category: true,
  saleStock: true,
  _count: { select: { copies: { where: { status: 'AVAILABLE' } } } },
} satisfies Prisma.BookInclude;

type BookWithDetail = Prisma.BookGetPayload<{ include: typeof detailInclude }>;

function emptyCopyCounts(): Record<CopyStatus, number> {
  return Object.fromEntries(COPY_STATUSES.map((s) => [s, 0])) as Record<CopyStatus, number>;
}

export function toBookDetail(book: BookWithDetail): BookDetail {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    description: book.description,
    coverUrl: book.coverUrl,
    salePrice: book.salePrice,
    categoryName: book.category.name,
    categorySlug: book.category.slug,
    saleStock: book.saleStock?.quantity ?? 0,
    availableCopies: book._count.copies,
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  listCategories(): Promise<CategoryDto[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } });
  }

  listBooks(query: BookListQuery): Promise<Paged<BookSummary>> {
    return searchBooks(this.prisma, query);
  }

  async getBookBySlug(slug: string): Promise<BookDetail> {
    const book = await this.prisma.book.findUnique({ where: { slug }, include: detailInclude });
    if (!book) throw new DomainError('NOT_FOUND');
    return toBookDetail(book);
  }

  async listAdminBooks(query: BookListQuery): Promise<Paged<AdminBookRow>> {
    const page = await searchBooks(this.prisma, { q: query.q, page: query.page });
    const groups = await this.prisma.bookCopy.groupBy({
      by: ['bookId', 'status'],
      where: { bookId: { in: page.items.map((b) => b.id) } },
      _count: { _all: true },
    });
    const byBook = new Map<string, Record<CopyStatus, number>>();
    for (const g of groups) {
      const counts = byBook.get(g.bookId) ?? emptyCopyCounts();
      counts[g.status] = g._count._all;
      byBook.set(g.bookId, counts);
    }
    return { ...page, items: page.items.map((b) => ({ ...b, copyCounts: byBook.get(b.id) ?? emptyCopyCounts() })) };
  }

  async getAdminBook(id: string): Promise<AdminBookDetail> {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: { ...detailInclude, copies: { orderBy: { barcode: 'asc' }, select: { id: true, barcode: true, status: true } } },
    });
    if (!book) throw new DomainError('NOT_FOUND');
    return { ...toBookDetail(book), categoryId: book.categoryId, copies: book.copies };
  }

  async createBook(input: BookInput): Promise<AdminBookDetail> {
    await this.assertCategory(input.categoryId);
    const id = await this.guardIsbn(() =>
      this.prisma.$transaction(async (tx) => {
        const book = await tx.book.create({ data: { ...input, slug: await uniqueSlug(tx, input.title) } });
        await this.inventory.initStock(tx, book.id);
        return book.id;
      }),
    );
    return this.getAdminBook(id);
  }

  async updateBook(id: string, input: BookInput): Promise<AdminBookDetail> {
    await this.assertCategory(input.categoryId);
    await this.guardIsbn(() => this.prisma.book.update({ where: { id }, data: input }));
    return this.getAdminBook(id);
  }

  async deleteBook(id: string): Promise<void> {
    await this.prisma.book.delete({ where: { id } });
  }

  private async assertCategory(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) {
      throw new DomainError('VALIDATION_ERROR', 'Unknown category', { categoryId: 'Thể loại không tồn tại' });
    }
  }

  private async guardIsbn<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target).includes('isbn')) {
        throw new DomainError('DUPLICATE', 'ISBN already exists', { isbn: 'ISBN đã tồn tại' });
      }
      throw e;
    }
  }
}

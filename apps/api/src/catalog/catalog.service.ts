import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { BookDetail, BookListQuery, BookSummary, CategoryDto, Paged } from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { PrismaService } from '../prisma/prisma.service';
import { searchBooks } from './book-search';

export const detailInclude = {
  category: true,
  saleStock: true,
  _count: { select: { copies: { where: { status: 'AVAILABLE' } } } },
} satisfies Prisma.BookInclude;

type BookWithDetail = Prisma.BookGetPayload<{ include: typeof detailInclude }>;

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
  constructor(private readonly prisma: PrismaService) {}

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
}

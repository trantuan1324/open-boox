import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { BookCopyDto, StockDto } from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { PrismaService } from '../prisma/prisma.service';
import { formatBarcode } from './barcode';

export interface StockLine {
  bookId: string;
  quantity: number;
}

// Every multi-row SaleStock write locks rows in bookId order, whatever order the caller passes, so two
// transactions touching the same books never wait on each other crosswise (deadlock) — spec §4.5.
function inLockOrder(items: StockLine[]): StockLine[] {
  return [...items].sort((a, b) => (a.bookId < b.bookId ? -1 : a.bookId > b.bookId ? 1 : 0));
}

// The only writer of SaleStock and BookCopy (spec §4.8). Methods taking `tx` join the caller's transaction.
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async initStock(tx: Prisma.TransactionClient, bookId: string): Promise<void> {
    await tx.saleStock.create({ data: { bookId, quantity: 0 } });
  }

  async takeStock(tx: Prisma.TransactionClient, items: StockLine[]): Promise<void> {
    for (const { bookId, quantity } of inLockOrder(items)) {
      const { count } = await tx.saleStock.updateMany({
        where: { bookId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (count === 0) throw new DomainError('OUT_OF_STOCK', `Not enough stock for book ${bookId}`);
    }
  }

  async returnStock(tx: Prisma.TransactionClient, items: StockLine[]): Promise<void> {
    for (const { bookId, quantity } of inLockOrder(items)) {
      await tx.saleStock.update({ where: { bookId }, data: { quantity: { increment: quantity } } });
    }
  }

  // One conditional UPDATE: concurrent adjustments serialize on the row and re-check the condition,
  // so stock never goes below zero (the CHECK constraint is the backstop).
  async adjustStock(bookId: string, delta: number): Promise<StockDto> {
    const { count } = await this.prisma.saleStock.updateMany({
      where: { bookId, quantity: { gte: -delta } },
      data: { quantity: { increment: delta } },
    });
    const stock = await this.prisma.saleStock.findUnique({ where: { bookId } });
    if (!stock) throw new DomainError('NOT_FOUND');
    if (count === 0) throw new DomainError('OUT_OF_STOCK', 'Not enough stock to remove');
    return { quantity: stock.quantity };
  }

  async addCopies(bookId: string, count: number): Promise<BookCopyDto[]> {
    const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
    if (!book) throw new DomainError('NOT_FOUND');
    const rows = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT nextval('book_copy_barcode_seq') AS n FROM generate_series(1, ${count})`;
    const barcodes = rows.map((r) => formatBarcode(r.n));
    await this.prisma.bookCopy.createMany({ data: barcodes.map((barcode) => ({ bookId, barcode })) });
    return this.prisma.bookCopy.findMany({
      where: { barcode: { in: barcodes } },
      orderBy: { barcode: 'asc' },
      select: { id: true, barcode: true, status: true },
    });
  }

  // Only AVAILABLE → LOST here; RESERVED/ON_LOAN copies belong to the loan flow (M4).
  async markCopyLost(copyId: string): Promise<BookCopyDto> {
    const { count } = await this.prisma.bookCopy.updateMany({
      where: { id: copyId, status: 'AVAILABLE' },
      data: { status: 'LOST' },
    });
    const copy = await this.prisma.bookCopy.findUnique({
      where: { id: copyId },
      select: { id: true, barcode: true, status: true },
    });
    if (!copy) throw new DomainError('NOT_FOUND');
    if (count === 0) throw new DomainError('INVALID_COPY_STATE', `Copy is ${copy.status}`);
    return copy;
  }
}

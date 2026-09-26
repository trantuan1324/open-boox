import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// The only writer of SaleStock and BookCopy (spec §4.8). Methods taking `tx` join the caller's transaction.
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async initStock(tx: Prisma.TransactionClient, bookId: string): Promise<void> {
    await tx.saleStock.create({ data: { bookId, quantity: 0 } });
  }
}

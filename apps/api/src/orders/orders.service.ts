import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ADMIN_ORDER_PAGE_SIZE,
  type AdminOrderDetail,
  type AdminOrderListQuery,
  type AdminOrderRow,
  type AddressSnapshot,
  ORDER_PAGE_SIZE,
  type OrderDetail,
  type OrderInput,
  type OrderItemInput,
  type OrderQuote,
  type OrderSummary,
  type Paged,
  type PlaceOrderResult,
} from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { AddressesService } from '../users/addresses.service';
import { priceOrder, type SellableBook } from './pricing';

type StockedBook = SellableBook & { stock: number };

const DETAIL_INCLUDE = {
  items: { orderBy: { id: 'asc' }, include: { book: { select: { title: true, slug: true } } } },
  payments: { select: { id: true, status: true } },
  user: { select: { email: true, fullName: true } },
} satisfies Prisma.OrderInclude;

type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentsService,
    private readonly addresses: AddressesService,
    private readonly shipments: ShipmentsService,
  ) {}

  // Read-only: same pricing as place(), plus a stock check that names the short lines by index.
  async quote(userId: string, input: OrderInput): Promise<OrderQuote> {
    const address = await this.addresses.snapshotFor(userId, input.addressId);
    const books = await this.findBooks(this.prisma, input.items);
    const quote = priceOrder(input.items, books, address.city);
    const fields: Record<string, string> = {};
    input.items.forEach(({ bookId, quantity }, i) => {
      const stock = books.find((book) => book.id === bookId)!.stock;
      if (stock < quantity) fields[`items.${i}.quantity`] = `Chỉ còn ${stock} cuốn`;
    });
    if (Object.keys(fields).length > 0) throw new DomainError('OUT_OF_STOCK', 'Not enough stock', fields);
    return quote;
  }

  // spec §4.5: price from the DB, take stock (conditional UPDATE, bookId order), create order + payment,
  // all in one transaction — any failure rolls everything back.
  async place(userId: string, input: OrderInput): Promise<PlaceOrderResult> {
    const address = await this.addresses.snapshotFor(userId, input.addressId);
    return this.prisma.$transaction(async (tx) => {
      const quote = priceOrder(input.items, await this.findBooks(tx, input.items), address.city);
      await this.inventory.takeStock(tx, input.items);
      const order = await tx.order.create({
        data: {
          userId,
          subtotal: quote.subtotal,
          shippingFee: quote.shippingFee,
          total: quote.total,
          addressSnapshot: address,
          items: { create: quote.items.map(({ bookId, quantity, unitPrice }) => ({ bookId, quantity, unitPrice })) },
        },
        select: { id: true },
      });
      const { redirectUrl } = await this.payments.createForOrder(tx, { userId, orderId: order.id, amount: quote.total });
      return { orderId: order.id, redirectUrl };
    });
  }

  // spec §4.5: cancelling is settle(FAILED); the payment's resulting status decides the answer. FAILED — whoever
  // set it — means onFailed already cancelled the order and returned the stock, so a repeat cancel is a 200 too.
  async cancel(userId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { payments: { select: { id: true } } },
    });
    if (!order) throw new DomainError('NOT_FOUND');
    const [payment] = order.payments; // exactly one payment per order (spec §3.5)
    const settled = await this.payments.settle(payment!.id, 'FAILED');
    if (settled.status === 'SUCCEEDED') throw new DomainError('ORDER_NOT_CANCELLABLE');
    return this.detail(userId, orderId);
  }

  async list(userId: string, page: number): Promise<Paged<OrderSummary>> {
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * ORDER_PAGE_SIZE,
        take: ORDER_PAGE_SIZE,
        select: { id: true, status: true, total: true, createdAt: true, items: { select: { quantity: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    const items = rows.map(({ items: lines, createdAt, ...order }) => ({
      ...order,
      createdAt: createdAt.toISOString(),
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    }));
    return { items, total, page, pageSize: ORDER_PAGE_SIZE };
  }

  async adminList({ status, page }: AdminOrderListQuery): Promise<Paged<AdminOrderRow>> {
    const where: Prisma.OrderWhereInput = { status };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * ADMIN_ORDER_PAGE_SIZE,
        take: ADMIN_ORDER_PAGE_SIZE,
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
          user: { select: { email: true } },
          items: { select: { quantity: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    // Shipments are read through their owner (spec §2.1), one query for the whole page.
    const latest = await this.shipments.latestStatuses(rows.map((row) => row.id));
    const items = rows.map(({ id, status: orderStatus, total: orderTotal, createdAt, user, items: lines }) => ({
      id,
      customerEmail: user.email,
      status: orderStatus,
      total: orderTotal,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      createdAt: createdAt.toISOString(),
      latestShipmentStatus: latest.get(id) ?? null,
    }));
    return { items, total, page, pageSize: ADMIN_ORDER_PAGE_SIZE };
  }

  async detail(userId: string, orderId: string): Promise<OrderDetail> {
    return this.toDetail(await this.findDetail({ id: orderId, userId }));
  }

  async adminDetail(orderId: string): Promise<AdminOrderDetail> {
    const order = await this.findDetail({ id: orderId });
    return {
      ...(await this.toDetail(order)),
      customer: order.user,
      paymentStatus: order.payments[0]?.status ?? null, // exactly one payment per order (spec §3.5)
    };
  }

  private async findDetail(where: Prisma.OrderWhereInput): Promise<OrderWithDetail> {
    const order = await this.prisma.order.findFirst({ where, include: DETAIL_INCLUDE });
    if (!order) throw new DomainError('NOT_FOUND');
    return order;
  }

  private async toDetail(order: OrderWithDetail): Promise<OrderDetail> {
    return {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      address: order.addressSnapshot as unknown as AddressSnapshot,
      items: order.items.map(({ bookId, quantity, unitPrice, book }) => ({
        bookId,
        title: book.title,
        slug: book.slug,
        unitPrice,
        quantity,
        lineTotal: unitPrice * quantity,
      })),
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      total: order.total,
      pendingPaymentId: order.payments.find((p) => p.status === 'PENDING')?.id ?? null,
      shipments: await this.shipments.listForOrder(this.prisma, order.id),
    };
  }

  private async findBooks(db: Prisma.TransactionClient, items: OrderItemInput[]): Promise<StockedBook[]> {
    const rows = await db.book.findMany({
      where: { id: { in: items.map((item) => item.bookId) } },
      select: { id: true, title: true, slug: true, salePrice: true, saleStock: { select: { quantity: true } } },
    });
    return rows.map(({ saleStock, ...book }) => ({ ...book, stock: saleStock?.quantity ?? 0 }));
  }
}

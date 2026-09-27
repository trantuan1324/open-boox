import type { OrderDetail, OrderSummary } from '@open-boox/shared';
import request from 'supertest';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { createAddress, userIdByEmail } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('orders', () => {
  let ctx: TestContext;
  let customer: string;
  let userId: string;
  let categoryId: string;
  let hanoiId: string;
  let danangId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
    userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
    categoryId = (await createCategory(ctx.prisma, 'Văn học', 'van-hoc')).id;
    hanoiId = (await createAddress(ctx.prisma, userId, 'Hà Nội', true)).id;
    danangId = (await createAddress(ctx.prisma, userId, 'Đà Nẵng')).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const book = (title: string, salePrice: number | null, stock: number) =>
    createBook(ctx.prisma, categoryId, { title, slug: title.toLowerCase(), salePrice, stock });
  const quote = (body: object, cookie = customer) =>
    request(ctx.http).post('/api/orders/quote').set('Cookie', cookie).send(body);
  const place = (body: object, cookie = customer) => request(ctx.http).post('/api/orders').set('Cookie', cookie).send(body);
  const stock = async (bookId: string) =>
    (await ctx.prisma.saleStock.findUniqueOrThrow({ where: { bookId } })).quantity;

  describe('quote', () => {
    it('prices from the DB, adds the INNER fee for Hà Nội and writes nothing', async () => {
      const a = await book('A', 100_000, 5);
      const b = await book('B', 50_000, 5);
      const res = await quote({ items: [{ bookId: a.id, quantity: 2 }, { bookId: b.id, quantity: 1 }], addressId: hanoiId }).expect(200);
      expect(res.body).toEqual({
        items: [
          { bookId: a.id, title: 'A', slug: 'a', unitPrice: 100_000, quantity: 2, lineTotal: 200_000 },
          { bookId: b.id, title: 'B', slug: 'b', unitPrice: 50_000, quantity: 1, lineTotal: 50_000 },
        ],
        subtotal: 250_000,
        shippingFee: 20_000,
        total: 270_000,
      });
      expect(await stock(a.id)).toBe(5);
      expect(await ctx.prisma.order.count()).toBe(0);
    });

    it('charges the OUTER fee outside Hà Nội', async () => {
      const a = await book('A', 100_000, 5);
      const res = await quote({ items: [{ bookId: a.id, quantity: 1 }], addressId: danangId }).expect(200);
      expect(res.body.shippingFee).toBe(35_000);
    });

    it('reports OUT_OF_STOCK with the index of the short line', async () => {
      const a = await book('A', 100_000, 1);
      const b = await book('B', 50_000, 5);
      const res = await quote({ items: [{ bookId: b.id, quantity: 1 }, { bookId: a.id, quantity: 2 }], addressId: hanoiId }).expect(409);
      expect(res.body.code).toBe('OUT_OF_STOCK');
      expect(res.body.fields).toEqual({ 'items.1.quantity': 'Chỉ còn 1 cuốn' });
    });

    it('rejects a book that is not for sale with the line index', async () => {
      const n = await book('N', null, 0);
      const res = await quote({ items: [{ bookId: n.id, quantity: 1 }], addressId: hanoiId }).expect(400);
      expect(Object.keys(res.body.fields)).toEqual(['items.0.bookId']);
    });

    it("returns 404 for another user's address", async () => {
      const a = await book('A', 100_000, 5);
      const other = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
      await quote({ items: [{ bookId: a.id, quantity: 1 }], addressId: hanoiId }, other).expect(404);
    });
  });

  describe('place', () => {
    it('creates a PENDING_PAYMENT order, takes stock and returns the mock checkout URL', async () => {
      const a = await book('A', 100_000, 5);
      const res = await place({ items: [{ bookId: a.id, quantity: 2 }], addressId: danangId }).expect(201);
      const payment = await ctx.prisma.payment.findFirstOrThrow({ where: { orderId: res.body.orderId } });
      expect(res.body.redirectUrl).toBe(`/checkout/mock/${payment.id}`);
      expect(payment).toMatchObject({ status: 'PENDING', amount: 235_000, userId });
      const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id: res.body.orderId }, include: { items: true } });
      expect(order).toMatchObject({ status: 'PENDING_PAYMENT', subtotal: 200_000, shippingFee: 35_000, total: 235_000 });
      expect(order.addressSnapshot).toEqual({
        recipientName: 'Nguyễn Văn A',
        phone: '0912345678',
        line: '1 Tràng Tiền',
        ward: 'Phường Hoàn Kiếm',
        city: 'Đà Nẵng',
      });
      expect(order.items).toMatchObject([{ bookId: a.id, quantity: 2, unitPrice: 100_000 }]);
      expect(await stock(a.id)).toBe(3);
    });

    it('rolls everything back when one line is short', async () => {
      const a = await book('A', 100_000, 5);
      const b = await book('B', 50_000, 0);
      const res = await place({ items: [{ bookId: a.id, quantity: 1 }, { bookId: b.id, quantity: 1 }], addressId: hanoiId }).expect(409);
      expect(res.body.code).toBe('OUT_OF_STOCK');
      expect(await stock(a.id)).toBe(5);
      expect(await ctx.prisma.order.count()).toBe(0);
      expect(await ctx.prisma.payment.count()).toBe(0);
    });

    it('rejects a book taken off sale after it was quoted, leaving stock untouched', async () => {
      const a = await book('A', 100_000, 5);
      await quote({ items: [{ bookId: a.id, quantity: 1 }], addressId: hanoiId }).expect(200);
      await ctx.prisma.book.update({ where: { id: a.id }, data: { salePrice: null } });
      await place({ items: [{ bookId: a.id, quantity: 1 }], addressId: hanoiId }).expect(400);
      expect(await stock(a.id)).toBe(5);
    });

    it('sells the last copy to exactly one of two concurrent orders', async () => {
      const a = await book('A', 100_000, 1);
      const body = { items: [{ bookId: a.id, quantity: 1 }], addressId: hanoiId };
      const results = await Promise.all([place(body), place(body)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.code).toBe('OUT_OF_STOCK');
      expect(await stock(a.id)).toBe(0);
      expect(await ctx.prisma.order.count()).toBe(1);
    });

    it('does not deadlock when concurrent orders list the same books in opposite orders', async () => {
      const a = await book('A', 100_000, 10);
      const b = await book('B', 50_000, 10);
      const ab = { items: [{ bookId: a.id, quantity: 1 }, { bookId: b.id, quantity: 1 }], addressId: hanoiId };
      const ba = { items: [{ bookId: b.id, quantity: 1 }, { bookId: a.id, quantity: 1 }], addressId: hanoiId };
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => place(i % 2 ? ab : ba)));
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
      expect([await stock(a.id), await stock(b.id)]).toEqual([0, 0]);
    });

    it.each([
      ['the same book twice', (id: string) => [{ bookId: id, quantity: 1 }, { bookId: id, quantity: 1 }]],
      ['quantity 11', (id: string) => [{ bookId: id, quantity: 11 }]],
      ['no items', () => []],
    ])('rejects %s with 400', async (_label, items) => {
      const a = await book('A', 100_000, 20);
      await place({ items: items(a.id), addressId: hanoiId }).expect(400);
      expect(await stock(a.id)).toBe(20);
    });
  });

  describe('read', () => {
    it('lists own orders newest first, 10 per page', async () => {
      const a = await book('A', 100_000, 20);
      for (let i = 0; i < 11; i += 1) await place({ items: [{ bookId: a.id, quantity: 1 }], addressId: hanoiId }).expect(201);
      const first = await request(ctx.http).get('/api/orders').set('Cookie', customer).expect(200);
      expect(first.body).toMatchObject({ total: 11, page: 1, pageSize: 10 });
      const items = first.body.items as OrderSummary[];
      expect(items).toHaveLength(10);
      expect(items[0]).toMatchObject({ status: 'PENDING_PAYMENT', total: 120_000, itemCount: 1 });
      expect(items[0]!.createdAt >= items[1]!.createdAt).toBe(true);
      const second = await request(ctx.http).get('/api/orders?page=2').set('Cookie', customer).expect(200);
      expect(second.body.items).toHaveLength(1);
      await request(ctx.http).get('/api/orders?page=abc').set('Cookie', customer).expect(200);
    });

    it('shows the detail with lines, snapshot address and pendingPaymentId', async () => {
      const a = await book('A', 100_000, 5);
      const { orderId, redirectUrl } = (await place({ items: [{ bookId: a.id, quantity: 2 }], addressId: hanoiId })).body;
      const res = await request(ctx.http).get(`/api/orders/${orderId}`).set('Cookie', customer).expect(200);
      const detail = res.body as OrderDetail;
      expect(detail).toMatchObject({ id: orderId, status: 'PENDING_PAYMENT', subtotal: 200_000, shippingFee: 20_000, total: 220_000 });
      expect(detail.items).toEqual([{ bookId: a.id, title: 'A', slug: 'a', unitPrice: 100_000, quantity: 2, lineTotal: 200_000 }]);
      expect(detail.address.city).toBe('Hà Nội');
      expect(`/checkout/mock/${detail.pendingPaymentId}`).toBe(redirectUrl);
    });

    it('keeps the snapshot address after the address is deleted', async () => {
      const a = await book('A', 100_000, 5);
      const { orderId } = (await place({ items: [{ bookId: a.id, quantity: 1 }], addressId: danangId })).body;
      await request(ctx.http).delete(`/api/addresses/${danangId}`).set('Cookie', customer).send({}).expect(204);
      const res = await request(ctx.http).get(`/api/orders/${orderId}`).set('Cookie', customer).expect(200);
      expect(res.body.address).toMatchObject({ city: 'Đà Nẵng', line: '1 Tràng Tiền' });
    });

    it("hides another user's orders", async () => {
      const a = await book('A', 100_000, 5);
      const { orderId } = (await place({ items: [{ bookId: a.id, quantity: 1 }], addressId: hanoiId })).body;
      const other = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
      await request(ctx.http).get(`/api/orders/${orderId}`).set('Cookie', other).expect(404);
      const list = await request(ctx.http).get('/api/orders').set('Cookie', other).expect(200);
      expect(list.body).toMatchObject({ items: [], total: 0 });
    });
  });
});

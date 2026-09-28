import request from 'supertest';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { createAddress, userIdByEmail } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('order payments and cancellation', () => {
  let ctx: TestContext;
  let customer: string;
  let userId: string;
  let bookId: string;
  let addressId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
    userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
    const category = await createCategory(ctx.prisma, 'Văn học', 'van-hoc');
    bookId = (await createBook(ctx.prisma, category.id, { title: 'A', salePrice: 100_000, stock: 5 })).id;
    addressId = (await createAddress(ctx.prisma, userId, 'Hà Nội', true)).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  async function placeOrder(quantity = 2) {
    const res = await request(ctx.http)
      .post('/api/orders')
      .set('Cookie', customer)
      .send({ items: [{ bookId, quantity }], addressId })
      .expect(201);
    return { orderId: res.body.orderId as string, paymentId: (res.body.redirectUrl as string).split('/').pop()! };
  }
  const callback = (paymentId: string, success: boolean) =>
    request(ctx.http).post(`/api/payments/${paymentId}/mock-callback`).set('Cookie', customer).send({ success });
  const cancel = (orderId: string, cookie = customer) =>
    request(ctx.http).post(`/api/orders/${orderId}/cancel`).set('Cookie', cookie).send({});
  const orderStatus = async (id: string) => (await ctx.prisma.order.findUniqueOrThrow({ where: { id } })).status;
  const stock = async () => (await ctx.prisma.saleStock.findUniqueOrThrow({ where: { bookId } })).quantity;

  it('marks the order PAID on a successful callback and keeps the stock taken', async () => {
    const { orderId, paymentId } = await placeOrder();
    await callback(paymentId, true).expect(200);
    expect(await orderStatus(orderId)).toBe('PAID');
    expect(await stock()).toBe(3);
  });

  it('cancels the order and returns the stock on a failed callback', async () => {
    const { orderId, paymentId } = await placeOrder();
    await callback(paymentId, false).expect(200);
    expect(await orderStatus(orderId)).toBe('CANCELLED');
    expect(await stock()).toBe(5);
  });

  it('returns the stock exactly once when failure callbacks race', async () => {
    const { paymentId } = await placeOrder();
    await Promise.all([callback(paymentId, false), callback(paymentId, false), callback(paymentId, false)]);
    expect(await stock()).toBe(5);
  });

  it('lets the customer cancel a pending order, returning the stock', async () => {
    const { orderId, paymentId } = await placeOrder();
    const res = await cancel(orderId).expect(200);
    expect(res.body).toMatchObject({ id: orderId, status: 'CANCELLED', pendingPaymentId: null });
    expect((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe('FAILED');
    expect(await stock()).toBe(5);
  });

  it('answers 200 again for an already cancelled order without returning stock twice', async () => {
    const { orderId } = await placeOrder();
    await cancel(orderId).expect(200);
    const res = await cancel(orderId).expect(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(await stock()).toBe(5);
  });

  it('refuses to cancel a paid order with ORDER_NOT_CANCELLABLE', async () => {
    const { orderId, paymentId } = await placeOrder();
    await callback(paymentId, true).expect(200);
    const res = await cancel(orderId).expect(409);
    expect(res.body.code).toBe('ORDER_NOT_CANCELLABLE');
    expect(await orderStatus(orderId)).toBe('PAID');
  });

  it('ignores a success callback that arrives after the customer cancelled', async () => {
    const { orderId, paymentId } = await placeOrder();
    await cancel(orderId).expect(200);
    expect((await callback(paymentId, true).expect(200)).body.status).toBe('FAILED');
    expect(await orderStatus(orderId)).toBe('CANCELLED');
    expect(await stock()).toBe(5);
  });

  it('keeps order, payment and stock consistent when cancel races a success callback', async () => {
    const { orderId, paymentId } = await placeOrder();
    const [cancelRes] = await Promise.all([cancel(orderId), callback(paymentId, true)]);
    if ((await orderStatus(orderId)) === 'PAID') {
      expect(cancelRes.status).toBe(409);
      expect(await stock()).toBe(3);
    } else {
      expect(cancelRes.status).toBe(200);
      expect(await orderStatus(orderId)).toBe('CANCELLED');
      expect(await stock()).toBe(5);
    }
  });

  it("returns 404 when cancelling another user's order", async () => {
    const { orderId } = await placeOrder();
    const other = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
    await cancel(orderId, other).expect(404);
    expect(await orderStatus(orderId)).toBe('PENDING_PAYMENT');
  });

  it('refuses to delete a book that has been ordered with 409 IN_USE', async () => {
    await placeOrder();
    const admin = await loginAs(ctx, 'ADMIN');
    const res = await request(ctx.http).delete(`/api/admin/books/${bookId}`).set('Cookie', admin).send({}).expect(409);
    expect(res.body.code).toBe('IN_USE');
  });
});

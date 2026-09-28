import request from 'supertest';
import { RevalidationService } from '../src/revalidation/revalidation.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { createAddress, userIdByEmail } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('catalog revalidation calls', () => {
  let ctx: TestContext;
  let spy: jest.SpyInstance;
  let customer: string;
  let admin: string;
  let categoryId: string;
  let bookId: string;
  let addressId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
    admin = await loginAs(ctx, 'ADMIN');
    const userId = await userIdByEmail(ctx.prisma, 'customer@test.vn');
    categoryId = (await createCategory(ctx.prisma, 'Văn học', 'van-hoc')).id;
    bookId = (await createBook(ctx.prisma, categoryId, { title: 'A', salePrice: 100_000, stock: 2, copies: ['AVAILABLE'] })).id;
    addressId = (await createAddress(ctx.prisma, userId, 'Hà Nội', true)).id;
    spy = jest.spyOn(ctx.app.get(RevalidationService), 'catalogChanged').mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const as = (cookie: string) => ({
    post: (path: string, body: object = {}) => request(ctx.http).post(`/api${path}`).set('Cookie', cookie).send(body),
    patch: (path: string, body: object) => request(ctx.http).patch(`/api${path}`).set('Cookie', cookie).send(body),
    del: (path: string) => request(ctx.http).delete(`/api${path}`).set('Cookie', cookie).send({}),
  });
  const placeOrder = async (quantity = 1) => {
    const res = await as(customer).post('/orders', { items: [{ bookId, quantity }], addressId }).expect(201);
    return { orderId: res.body.orderId as string, paymentId: (res.body.redirectUrl as string).split('/').pop()! };
  };

  it('fires after placing and cancelling an order, not after a refused one', async () => {
    const { orderId } = await placeOrder();
    expect(spy).toHaveBeenCalledTimes(1);
    await as(customer).post(`/orders/${orderId}/cancel`).expect(200);
    expect(spy).toHaveBeenCalledTimes(2);
    await as(customer).post('/orders', { items: [{ bookId, quantity: 5 }], addressId }).expect(409);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('fires after a mock payment callback and after a shipment status change', async () => {
    const { orderId, paymentId } = await placeOrder();
    spy.mockClear();
    await as(customer).post(`/payments/${paymentId}/mock-callback`, { success: true }).expect(200);
    expect(spy).toHaveBeenCalledTimes(1);
    const shipment = await ctx.prisma.shipment.findFirstOrThrow({ where: { orderId } });
    await as(admin).patch(`/admin/shipments/${shipment.id}`, { status: 'PICKED_UP' }).expect(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('fires after admin book, stock and copy changes', async () => {
    const created = await as(admin)
      .post('/admin/books', {
        title: 'Mới',
        author: 'Tác giả',
        isbn: '9780062315007',
        description: '',
        coverUrl: '',
        categoryId,
        salePrice: '89000',
      })
      .expect(201);
    const id = created.body.id as string;
    await as(admin)
      .patch(`/admin/books/${id}`, {
        title: 'Mới',
        author: 'Tác giả',
        isbn: '9780062315007',
        description: '',
        coverUrl: '',
        categoryId,
        salePrice: '90000',
      })
      .expect(200);
    await as(admin).post(`/admin/books/${id}/stock`, { delta: 3 }).expect(200);
    const copies = await as(admin).post(`/admin/books/${id}/copies`, { count: 1 }).expect(201);
    await as(admin).post(`/admin/copies/${copies.body[0].id}/lost`).expect(200);
    await as(admin).del(`/admin/books/${id}`).expect(204);
    expect(spy).toHaveBeenCalledTimes(6);
    await as(admin).post(`/admin/books/${bookId}/stock`, { delta: -99 }).expect(409);
    expect(spy).toHaveBeenCalledTimes(6);
  });

  it('fires from failStalePayments only when it settled something', async () => {
    const scheduler = ctx.app.get(SchedulerService);
    await scheduler.failStalePayments(new Date());
    expect(spy).not.toHaveBeenCalled();
    await placeOrder();
    spy.mockClear();
    await scheduler.failStalePayments(new Date(Date.now() + 31 * 60_000));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

import request from 'supertest';
import { ShipmentsService } from '../src/shipments/shipments.service';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { ADDRESS_INPUT, createUser } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('admin orders', () => {
  let ctx: TestContext;
  let admin: string;
  let bookId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    admin = await loginAs(ctx, 'ADMIN');
    const category = await createCategory(ctx.prisma, 'Văn học', 'van-hoc');
    bookId = (await createBook(ctx.prisma, category.id, { title: 'A', salePrice: 100_000, stock: 5 })).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  // Direct writes: status is set as needed; M2 orders paid before M3 have no shipment, like status 'PAID' here.
  async function order(userId: string, status: 'PENDING_PAYMENT' | 'PAID' | 'SHIPPING' = 'PENDING_PAYMENT') {
    const o = await ctx.prisma.order.create({
      data: {
        userId,
        status,
        subtotal: 200_000,
        shippingFee: 20_000,
        total: 220_000,
        addressSnapshot: ADDRESS_INPUT,
        items: { create: [{ bookId, quantity: 2, unitPrice: 100_000 }] },
        payments: { create: { userId, amount: 220_000, status: status === 'PENDING_PAYMENT' ? 'PENDING' : 'SUCCEEDED' } },
      },
    });
    return o.id;
  }
  const get = (path: string, cookie = admin) => request(ctx.http).get(`/api/admin/orders${path}`).set('Cookie', cookie);

  it("lists every customer's orders newest first with email, item count and no shipment status yet", async () => {
    const alice = await createUser(ctx.prisma, 'alice@test.vn');
    const bob = await createUser(ctx.prisma, 'bob@test.vn');
    const first = await order(alice.id);
    const second = await order(bob.id, 'PAID');
    const res = await get('').expect(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(res.body.items.map((r: { id: string }) => r.id)).toEqual([second, first]);
    expect(res.body.items[0]).toMatchObject({
      customerEmail: 'bob@test.vn',
      status: 'PAID',
      total: 220_000,
      itemCount: 2,
      latestShipmentStatus: null,
    });
  });

  it("shows the newest shipment's status after a retry", async () => {
    const alice = await createUser(ctx.prisma, 'alice@test.vn');
    const id = await order(alice.id, 'SHIPPING');
    const shipments = ctx.app.get(ShipmentsService);
    const failed = await shipments.create(ctx.prisma, { type: 'ORDER_DELIVERY', orderId: id, fee: 20_000, addressSnapshot: ADDRESS_INPUT });
    await ctx.prisma.shipment.update({ where: { id: failed.id }, data: { status: 'FAILED' } });
    await shipments.retry(failed.id);
    const res = await get('').expect(200);
    expect(res.body.items[0].latestShipmentStatus).toBe('PENDING');
  });

  it('filters by status, ignores an unknown one and pages by 20', async () => {
    const alice = await createUser(ctx.prisma, 'alice@test.vn');
    for (let i = 0; i < 20; i++) await order(alice.id);
    const paid = await order(alice.id, 'PAID');
    const onlyPaid = await get('?status=PAID').expect(200);
    expect(onlyPaid.body.items.map((r: { id: string }) => r.id)).toEqual([paid]);
    const edited = await get('?status=paid&page=abc').expect(200);
    expect(edited.body).toMatchObject({ total: 21, page: 1 });
    const second = await get('?page=2').expect(200);
    expect(second.body.items).toHaveLength(1);
  });

  it('shows the detail with customer, payment status and shipments', async () => {
    const alice = await createUser(ctx.prisma, 'alice@test.vn');
    const id = await order(alice.id, 'PAID');
    const res = await get(`/${id}`).expect(200);
    expect(res.body).toMatchObject({
      id,
      status: 'PAID',
      total: 220_000,
      customer: { email: 'alice@test.vn', fullName: 'User' },
      paymentStatus: 'SUCCEEDED',
      pendingPaymentId: null,
      shipments: [],
    });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.address).toEqual(ADDRESS_INPUT);
    await get('/khong-co').expect(404);
  });

  it('forbids customers (403)', async () => {
    const customer = await loginAs(ctx, 'CUSTOMER');
    const alice = await createUser(ctx.prisma, 'alice@test.vn');
    const id = await order(alice.id);
    await get('', customer).expect(403);
    await get(`/${id}`, customer).expect(403);
  });
});

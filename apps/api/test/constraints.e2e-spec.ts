import { createBook, createCategory } from './catalog-fixtures';
import { createAddress, createUser } from './order-fixtures';
import { createPlans, createSubscription } from './subscription-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('orders migration constraints', () => {
  let ctx: TestContext;
  let userId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    userId = (await createUser(ctx.prisma)).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const createOrder = () =>
    ctx.prisma.order.create({ data: { userId, subtotal: 0, shippingFee: 0, total: 0, addressSnapshot: {} } });

  it('rejects a payment with no target', async () => {
    await expect(ctx.prisma.payment.create({ data: { userId, amount: 1000 } })).rejects.toThrow(
      /payment_exactly_one_target/,
    );
  });

  it('rejects a payment with both an order and a subscription', async () => {
    const order = await createOrder();
    const plans = await createPlans(ctx.prisma);
    const sub = await createSubscription(ctx.prisma, { userId, planId: plans.basic.id, status: 'PENDING_PAYMENT' });
    await expect(
      ctx.prisma.payment.create({ data: { userId, amount: 1000, orderId: order.id, subscriptionId: sub.id } }),
    ).rejects.toThrow(/payment_exactly_one_target/);
  });

  it('rejects a payment for a subscription that does not exist (P2003)', async () => {
    await expect(
      ctx.prisma.payment.create({ data: { userId, amount: 1000, subscriptionId: 'khong-co' } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('allows one open subscription per user, any number of closed ones', async () => {
    const plans = await createPlans(ctx.prisma);
    const sub = (status: 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED', owner = userId) =>
      createSubscription(ctx.prisma, { userId: owner, planId: plans.basic.id, status });
    await sub('EXPIRED');
    await sub('CANCELLED');
    await sub('CANCELLED');
    await sub('PENDING_PAYMENT');
    await expect(sub('ACTIVE')).rejects.toMatchObject({ code: 'P2002' });
    await expect(sub('PENDING_PAYMENT')).rejects.toMatchObject({ code: 'P2002' });
    const other = await createUser(ctx.prisma, 'other@test.vn');
    await expect(sub('ACTIVE', other.id)).resolves.toBeDefined();
  });

  it('allows only one default address per user, but any number of non-default ones', async () => {
    await createAddress(ctx.prisma, userId, 'Hà Nội', true);
    await createAddress(ctx.prisma, userId, 'Huế', false);
    await createAddress(ctx.prisma, userId, 'Huế', false);
    await expect(createAddress(ctx.prisma, userId, 'Cần Thơ', true)).rejects.toMatchObject({ code: 'P2002' });
    const other = await createUser(ctx.prisma, 'other@test.vn');
    await expect(createAddress(ctx.prisma, other.id, 'Hà Nội', true)).resolves.toBeDefined();
  });

  it('refuses to delete a book that has order items (P2003)', async () => {
    const category = await createCategory(ctx.prisma, 'Văn học', 'van-hoc');
    const book = await createBook(ctx.prisma, category.id, { title: 'A' });
    const order = await createOrder();
    await ctx.prisma.orderItem.create({ data: { orderId: order.id, bookId: book.id, quantity: 1, unitPrice: 1000 } });
    await expect(ctx.prisma.book.delete({ where: { id: book.id } })).rejects.toMatchObject({ code: 'P2003' });
  });

  const shipment = (data: { type: 'ORDER_DELIVERY' | 'LOAN_DELIVERY'; orderId?: string; retryOfId?: string }) =>
    ctx.prisma.shipment.create({ data: { fee: 0, addressSnapshot: {}, ...data } });

  it('rejects an ORDER_DELIVERY shipment without an order', async () => {
    await expect(shipment({ type: 'ORDER_DELIVERY' })).rejects.toThrow(/shipment_order_delivery_has_order/);
    const order = await createOrder();
    await expect(shipment({ type: 'ORDER_DELIVERY', orderId: order.id })).resolves.toBeDefined();
  });

  it('accepts a loan shipment without an order', async () => {
    await expect(shipment({ type: 'LOAN_DELIVERY' })).resolves.toBeDefined();
  });

  it('lets a shipment be retried only once (unique retryOfId)', async () => {
    const failed = await shipment({ type: 'LOAN_DELIVERY' });
    await shipment({ type: 'LOAN_DELIVERY', retryOfId: failed.id });
    await expect(shipment({ type: 'LOAN_DELIVERY', retryOfId: failed.id })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuses to delete an order that has a shipment (P2003)', async () => {
    const order = await createOrder();
    await shipment({ type: 'ORDER_DELIVERY', orderId: order.id });
    await expect(ctx.prisma.order.delete({ where: { id: order.id } })).rejects.toMatchObject({ code: 'P2003' });
  });
});

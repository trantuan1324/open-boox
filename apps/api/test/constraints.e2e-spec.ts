import { createBook, createCategory } from './catalog-fixtures';
import { createAddress, createUser } from './order-fixtures';
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
    await expect(
      ctx.prisma.payment.create({ data: { userId, amount: 1000, orderId: order.id, subscriptionId: 'sub-1' } }),
    ).rejects.toThrow(/payment_exactly_one_target/);
  });

  it('accepts a payment for a subscription id without a foreign key (M4 adds it)', async () => {
    await expect(ctx.prisma.payment.create({ data: { userId, amount: 1000, subscriptionId: 'sub-1' } })).resolves.toBeDefined();
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
});

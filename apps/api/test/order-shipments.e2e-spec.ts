import type { OrderDetail } from '@open-boox/shared';
import request from 'supertest';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { createAddress, userIdByEmail } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('order delivery', () => {
  let ctx: TestContext;
  let customer: string;
  let admin: string;
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
    const category = await createCategory(ctx.prisma, 'Văn học', 'van-hoc');
    bookId = (await createBook(ctx.prisma, category.id, { title: 'A', salePrice: 100_000, stock: 5 })).id;
    addressId = (await createAddress(ctx.prisma, userId, 'Hà Nội', true)).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  async function placeOrder() {
    const res = await request(ctx.http)
      .post('/api/orders')
      .set('Cookie', customer)
      .send({ items: [{ bookId, quantity: 1 }], addressId })
      .expect(201);
    return { orderId: res.body.orderId as string, paymentId: (res.body.redirectUrl as string).split('/').pop()! };
  }
  const callback = (paymentId: string, success: boolean) =>
    request(ctx.http).post(`/api/payments/${paymentId}/mock-callback`).set('Cookie', customer).send({ success });
  async function paidOrder() {
    const { orderId, paymentId } = await placeOrder();
    await callback(paymentId, true).expect(200);
    const shipment = await ctx.prisma.shipment.findFirstOrThrow({ where: { orderId } });
    return { orderId, paymentId, shipmentId: shipment.id };
  }
  const move = (id: string, status: string, note?: string) =>
    request(ctx.http).patch(`/api/admin/shipments/${id}`).set('Cookie', admin).send({ status, note }).expect(200);
  const retry = async (id: string) =>
    (await request(ctx.http).post(`/api/admin/shipments/${id}/retry`).set('Cookie', admin).send({}).expect(201)).body
      .id as string;
  const orderStatus = async (id: string) => (await ctx.prisma.order.findUniqueOrThrow({ where: { id } })).status;
  const detail = async (id: string) =>
    (await request(ctx.http).get(`/api/orders/${id}`).set('Cookie', customer).expect(200)).body as OrderDetail;

  it('creates exactly one PENDING ORDER_DELIVERY with the order fee and address when payment succeeds', async () => {
    const { orderId, paymentId } = await placeOrder();
    await callback(paymentId, true).expect(200);
    await callback(paymentId, true).expect(200); // repeated callback: no second shipment
    const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const rows = await ctx.prisma.shipment.findMany({ where: { orderId }, include: { events: true } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'ORDER_DELIVERY', status: 'PENDING', fee: order.shippingFee });
    expect(rows[0]!.addressSnapshot).toEqual(order.addressSnapshot);
    expect(rows[0]!.events.map((e) => e.status)).toEqual(['PENDING']);
  });

  it('creates no shipment when payment fails', async () => {
    const { orderId, paymentId } = await placeOrder();
    await callback(paymentId, false).expect(200);
    expect(await ctx.prisma.shipment.count({ where: { orderId } })).toBe(0);
  });

  it('moves the order PAID → SHIPPING → DELIVERED along the shipment', async () => {
    const { orderId, shipmentId } = await paidOrder();
    expect(await orderStatus(orderId)).toBe('PAID');
    await move(shipmentId, 'PICKED_UP');
    expect(await orderStatus(orderId)).toBe('SHIPPING');
    await move(shipmentId, 'IN_TRANSIT');
    expect(await orderStatus(orderId)).toBe('SHIPPING');
    await move(shipmentId, 'DELIVERED');
    expect(await orderStatus(orderId)).toBe('DELIVERED');
  });

  it('keeps a SHIPPING order as it is through a failure and retry, then delivers', async () => {
    const { orderId, shipmentId } = await paidOrder();
    await move(shipmentId, 'PICKED_UP');
    await move(shipmentId, 'FAILED', 'Khách không nghe máy');
    expect(await orderStatus(orderId)).toBe('SHIPPING');
    const next = await retry(shipmentId);
    expect(await orderStatus(orderId)).toBe('SHIPPING');
    await move(next, 'PICKED_UP');
    expect(await orderStatus(orderId)).toBe('SHIPPING');
    await move(next, 'IN_TRANSIT');
    await move(next, 'DELIVERED');
    expect(await orderStatus(orderId)).toBe('DELIVERED');
  });

  it('keeps a PAID order PAID when the first shipment fails before pickup, then ships on the retry', async () => {
    const { orderId, shipmentId } = await paidOrder();
    await move(shipmentId, 'FAILED');
    expect(await orderStatus(orderId)).toBe('PAID');
    const next = await retry(shipmentId);
    const retried = await ctx.prisma.shipment.findUniqueOrThrow({ where: { id: next } });
    expect(retried).toMatchObject({ type: 'ORDER_DELIVERY', orderId, status: 'PENDING', retryOfId: shipmentId });
    await move(next, 'PICKED_UP');
    expect(await orderStatus(orderId)).toBe('SHIPPING');
  });

  it('shows shipments oldest first, each with its events oldest first and the admin notes', async () => {
    const { orderId, shipmentId } = await paidOrder();
    await move(shipmentId, 'FAILED', 'Sai số nhà');
    const next = await retry(shipmentId);
    await move(next, 'PICKED_UP');
    const { shipments } = await detail(orderId);
    expect(shipments.map((s) => [s.id, s.status])).toEqual([
      [shipmentId, 'FAILED'],
      [next, 'PICKED_UP'],
    ]);
    expect(shipments[0]!.events.map((e) => [e.status, e.note])).toEqual([
      ['PENDING', null],
      ['FAILED', 'Sai số nhà'],
    ]);
    expect(shipments[0]!.retriedById).toBe(next);
    expect(shipments[1]!.retryOfId).toBe(shipmentId);
  });

  it('shows no shipments for an unpaid order', async () => {
    const { orderId } = await placeOrder();
    expect((await detail(orderId)).shipments).toEqual([]);
  });
});

import type { ShipmentStatus } from '@open-boox/shared';
import request from 'supertest';
import { ShipmentsService } from '../src/shipments/shipments.service';
import { loginAs } from './auth-helpers';
import { ADDRESS_INPUT } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('admin shipments', () => {
  let ctx: TestContext;
  let shipments: ShipmentsService;
  let admin: string;
  const calls: Array<{ id: string; status: string }> = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    shipments = ctx.app.get(ShipmentsService);
    // Stand-in for the loans module (M4): records every call the winner makes.
    shipments.registerHandler('LOAN_DELIVERY', {
      onStatusChanged: async (_tx, shipment) => {
        calls.push({ id: shipment.id, status: shipment.status });
      },
    });
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    calls.length = 0;
    admin = await loginAs(ctx, 'ADMIN');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const newShipment = (type: 'LOAN_DELIVERY' | 'LOAN_PICKUP' = 'LOAN_DELIVERY') =>
    shipments.create(ctx.prisma, { type, fee: 0, addressSnapshot: ADDRESS_INPUT });
  const patch = (id: string, body: object, cookie = admin) =>
    request(ctx.http).patch(`/api/admin/shipments/${id}`).set('Cookie', cookie).send(body);
  const retry = (id: string, cookie = admin) =>
    request(ctx.http).post(`/api/admin/shipments/${id}/retry`).set('Cookie', cookie).send({});
  const events = (shipmentId: string) =>
    ctx.prisma.shipmentEvent.findMany({ where: { shipmentId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const statusOf = async (id: string) => (await ctx.prisma.shipment.findUniqueOrThrow({ where: { id } })).status;

  describe('PATCH /admin/shipments/:id', () => {
    it('creates a shipment with a PENDING event', async () => {
      const s = await newShipment();
      expect(s.status).toBe('PENDING');
      expect((await events(s.id)).map((e) => e.status)).toEqual(['PENDING']);
    });

    it('walks the happy path, writing one event and one handler call per step', async () => {
      const s = await newShipment();
      await patch(s.id, { status: 'PICKED_UP' }).expect(200);
      await patch(s.id, { status: 'IN_TRANSIT', note: 'Đang tới Hà Nội' }).expect(200);
      const res = await patch(s.id, { status: 'DELIVERED' }).expect(200);
      expect(res.body).toMatchObject({ id: s.id, status: 'DELIVERED', retryOfId: null, retriedById: null });
      expect(res.body.events.map((e: { status: string }) => e.status)).toEqual([
        'PENDING',
        'PICKED_UP',
        'IN_TRANSIT',
        'DELIVERED',
      ]);
      expect(res.body.events[2].note).toBe('Đang tới Hà Nội');
      expect(calls.map((c) => c.status)).toEqual(['PICKED_UP', 'IN_TRANSIT', 'DELIVERED']);
    });

    it.each<[ShipmentStatus[], ShipmentStatus]>([
      [[], 'DELIVERED'], // skipping
      [[], 'IN_TRANSIT'],
      [['PICKED_UP'], 'PENDING'], // going back
      [['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'], 'FAILED'], // leaving a final state
      [['FAILED'], 'PICKED_UP'],
    ])('after %j refuses %s with INVALID_SHIPMENT_TRANSITION and writes nothing', async (path, target) => {
      const s = await newShipment();
      for (const status of path) await patch(s.id, { status }).expect(200);
      const before = (await events(s.id)).length;
      calls.length = 0;
      const res = await patch(s.id, { status: target }).expect(409);
      expect(res.body.code).toBe('INVALID_SHIPMENT_TRANSITION');
      expect(await events(s.id)).toHaveLength(before);
      expect(calls).toHaveLength(0);
    });

    it('answers 200 without an event or handler call when the status is unchanged, even for a final state', async () => {
      const s = await newShipment();
      await patch(s.id, { status: 'PENDING', note: 'bỏ qua' }).expect(200);
      expect(await events(s.id)).toHaveLength(1);
      for (const status of ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'] as const) await patch(s.id, { status });
      calls.length = 0;
      const res = await patch(s.id, { status: 'DELIVERED' }).expect(200);
      expect(res.body.status).toBe('DELIVERED');
      expect(await events(s.id)).toHaveLength(4);
      expect(calls).toHaveLength(0);
    });

    it('lets exactly one of several concurrent identical requests win', async () => {
      const s = await newShipment();
      const results = await Promise.all(Array.from({ length: 5 }, () => patch(s.id, { status: 'PICKED_UP' })));
      expect(results.map((r) => r.status)).toEqual(Array(5).fill(200));
      expect((await events(s.id)).map((e) => e.status)).toEqual(['PENDING', 'PICKED_UP']);
      expect(calls).toEqual([{ id: s.id, status: 'PICKED_UP' }]);
    });

    it('lets exactly one of two concurrent different targets win; the loser gets 409', async () => {
      const s = await newShipment();
      const results = await Promise.all([patch(s.id, { status: 'PICKED_UP' }), patch(s.id, { status: 'FAILED' })]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const winner = await statusOf(s.id);
      expect((await events(s.id)).map((e) => e.status)).toEqual(['PENDING', winner]);
      expect(calls).toEqual([{ id: s.id, status: winner }]);
    });

    it('rolls back with 500 when no handler is registered for the type', async () => {
      const s = await newShipment('LOAN_PICKUP');
      const res = await patch(s.id, { status: 'PICKED_UP' }).expect(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
      expect(await statusOf(s.id)).toBe('PENDING');
      expect(await events(s.id)).toHaveLength(1);
    });

    it('validates the body and answers 404 for an unknown shipment', async () => {
      const s = await newShipment();
      expect((await patch(s.id, { status: 'LOST' }).expect(400)).body.code).toBe('VALIDATION_ERROR');
      await patch(s.id, { status: 'FAILED', note: 'x'.repeat(501) }).expect(400);
      await patch('khong-co', { status: 'PICKED_UP' }).expect(404);
    });

    it('stores a blank note as null', async () => {
      const s = await newShipment();
      await patch(s.id, { status: 'FAILED', note: '   ' }).expect(200);
      expect((await events(s.id))[1]!.note).toBeNull();
    });
  });

  describe('POST /admin/shipments/:id/retry', () => {
    async function failed() {
      const s = await newShipment();
      await patch(s.id, { status: 'FAILED', note: 'Sai địa chỉ' }).expect(200);
      return s;
    }

    it('creates a new PENDING shipment copying type, fee and address, linked to the failed one', async () => {
      const s = await failed();
      const res = await retry(s.id).expect(201);
      expect(res.body).toMatchObject({ type: 'LOAN_DELIVERY', status: 'PENDING', fee: 0, retryOfId: s.id, orderId: null });
      expect(res.body.address).toEqual(ADDRESS_INPUT);
      expect(res.body.events.map((e: { status: string }) => e.status)).toEqual(['PENDING']);
      const old = await request(ctx.http).get(`/api/admin/shipments/${s.id}`).set('Cookie', admin).expect(200);
      expect(old.body.retriedById).toBe(res.body.id);
    });

    it('refuses to retry a shipment that has not failed', async () => {
      const s = await newShipment();
      expect((await retry(s.id).expect(409)).body.code).toBe('INVALID_SHIPMENT_TRANSITION');
      await retry('khong-co').expect(404);
    });

    it('answers SHIPMENT_ALREADY_RETRIED to a second retry', async () => {
      const s = await failed();
      await retry(s.id).expect(201);
      expect((await retry(s.id).expect(409)).body.code).toBe('SHIPMENT_ALREADY_RETRIED');
      expect(await ctx.prisma.shipment.count()).toBe(2);
    });

    it('creates exactly one shipment when retries race', async () => {
      const s = await failed();
      const results = await Promise.all([retry(s.id), retry(s.id), retry(s.id)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
      expect(results.filter((r) => r.status === 409).every((r) => r.body.code === 'SHIPMENT_ALREADY_RETRIED')).toBe(true);
      expect(await ctx.prisma.shipment.count()).toBe(2);
    });

    it('allows retrying a retry that failed too (chain)', async () => {
      const s = await failed();
      const second = (await retry(s.id).expect(201)).body.id as string;
      await patch(second, { status: 'FAILED' }).expect(200);
      const third = await retry(second).expect(201);
      expect(third.body.retryOfId).toBe(second);
    });
  });

  describe('GET /admin/shipments', () => {
    it('lists newest first, filters by status and type, and ignores hand-edited values', async () => {
      const a = await newShipment();
      const b = await newShipment('LOAN_PICKUP');
      await patch(a.id, { status: 'FAILED' }).expect(200);
      const all = await request(ctx.http).get('/api/admin/shipments').set('Cookie', admin).expect(200);
      expect(all.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
      expect(all.body.items.map((r: { id: string }) => r.id)).toEqual([b.id, a.id]);
      expect(all.body.items[1]).toMatchObject({ type: 'LOAN_DELIVERY', status: 'FAILED', orderId: null, retriedById: null });

      const failedOnly = await request(ctx.http).get('/api/admin/shipments?status=FAILED').set('Cookie', admin).expect(200);
      expect(failedOnly.body.items.map((r: { id: string }) => r.id)).toEqual([a.id]);
      const pickups = await request(ctx.http).get('/api/admin/shipments?type=LOAN_PICKUP').set('Cookie', admin).expect(200);
      expect(pickups.body.items.map((r: { id: string }) => r.id)).toEqual([b.id]);
      const edited = await request(ctx.http)
        .get('/api/admin/shipments?status=abc&type=&page=-3')
        .set('Cookie', admin)
        .expect(200);
      expect(edited.body.total).toBe(2);
    });

    it('pages by 20', async () => {
      for (let i = 0; i < 21; i++) await newShipment();
      const second = await request(ctx.http).get('/api/admin/shipments?page=2').set('Cookie', admin).expect(200);
      expect(second.body).toMatchObject({ total: 21, page: 2 });
      expect(second.body.items).toHaveLength(1);
    });

    it('answers 404 for an unknown shipment', async () => {
      await request(ctx.http).get('/api/admin/shipments/khong-co').set('Cookie', admin).expect(404);
    });
  });

  it('forbids customers (403)', async () => {
    const s = await newShipment();
    const customer = await loginAs(ctx, 'CUSTOMER');
    await request(ctx.http).get('/api/admin/shipments').set('Cookie', customer).expect(403);
    await request(ctx.http).get(`/api/admin/shipments/${s.id}`).set('Cookie', customer).expect(403);
    await patch(s.id, { status: 'PICKED_UP' }, customer).expect(403);
    await retry(s.id, customer).expect(403);
  });
});

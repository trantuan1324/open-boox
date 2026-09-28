import type { Shipment } from '@prisma/client';
import type { ShipmentStatus } from '@open-boox/shared';
import request from 'supertest';
import { DomainError } from '../src/common/errors/domain-error';
import { ShipmentsService } from '../src/shipments/shipments.service';
import { loginAs } from './auth-helpers';
import { ADDRESS_INPUT, createUser } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('shipments', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const events = (shipmentId: string) =>
    ctx.prisma.shipmentEvent.findMany({ where: { shipmentId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const statusOf = async (id: string) => (await ctx.prisma.shipment.findUniqueOrThrow({ where: { id } })).status;

  // Mechanics on a standalone service with a recording handler: the app registers real handlers for every
  // type, and registerHandler refuses duplicates (spec §8).
  describe('ShipmentsService mechanics', () => {
    let service: ShipmentsService;
    const calls: string[] = [];
    let onRetried: (failed: Shipment, created: Shipment) => Promise<void>;

    beforeEach(() => {
      calls.length = 0;
      onRetried = async () => undefined;
      service = new ShipmentsService(ctx.prisma);
      service.registerHandler('LOAN_DELIVERY', {
        onStatusChanged: async (_tx, shipment) => {
          calls.push(`${shipment.id}:${shipment.status}`);
        },
        onRetried: async (_tx, failed, created) => {
          calls.push(`retried:${failed.id}->${created.id}`);
          await onRetried(failed, created);
        },
      });
    });

    const newShipment = (type: 'LOAN_DELIVERY' | 'LOAN_PICKUP' = 'LOAN_DELIVERY') =>
      service.create(ctx.prisma, { type, fee: 0, addressSnapshot: ADDRESS_INPUT });
    const failed = async () => {
      const s = await newShipment();
      await service.transition(s.id, 'FAILED', 'Sai địa chỉ');
      calls.length = 0;
      return s;
    };

    it('creates a shipment with a PENDING event', async () => {
      const s = await newShipment();
      expect(s.status).toBe('PENDING');
      expect((await events(s.id)).map((e) => e.status)).toEqual(['PENDING']);
    });

    it('walks the happy path, writing one event and one handler call per step', async () => {
      const s = await newShipment();
      await service.transition(s.id, 'PICKED_UP');
      await service.transition(s.id, 'IN_TRANSIT', 'Đang tới Hà Nội');
      const detail = await service.transition(s.id, 'DELIVERED');
      expect(detail).toMatchObject({ id: s.id, status: 'DELIVERED', retryOfId: null, retriedById: null });
      expect(detail.events.map((e) => e.status)).toEqual(['PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED']);
      expect(detail.events[2]!.note).toBe('Đang tới Hà Nội');
      expect(calls).toEqual([`${s.id}:PICKED_UP`, `${s.id}:IN_TRANSIT`, `${s.id}:DELIVERED`]);
    });

    it.each<[ShipmentStatus[], ShipmentStatus]>([
      [[], 'DELIVERED'],
      [[], 'IN_TRANSIT'],
      [['PICKED_UP'], 'PENDING'],
      [['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'], 'FAILED'],
      [['FAILED'], 'PICKED_UP'],
    ])('after %j refuses %s with INVALID_SHIPMENT_TRANSITION and writes nothing', async (path, target) => {
      const s = await newShipment();
      for (const status of path) await service.transition(s.id, status);
      const before = (await events(s.id)).length;
      calls.length = 0;
      await expect(service.transition(s.id, target)).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_TRANSITION' });
      expect(await events(s.id)).toHaveLength(before);
      expect(calls).toHaveLength(0);
    });

    it('does nothing when the status is unchanged, even for a final state', async () => {
      const s = await newShipment();
      await service.transition(s.id, 'PENDING', 'bỏ qua');
      expect(await events(s.id)).toHaveLength(1);
      for (const status of ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'] as const) await service.transition(s.id, status);
      calls.length = 0;
      expect((await service.transition(s.id, 'DELIVERED')).status).toBe('DELIVERED');
      expect(await events(s.id)).toHaveLength(4);
      expect(calls).toHaveLength(0);
    });

    it('lets exactly one of several concurrent identical requests win', async () => {
      const s = await newShipment();
      await Promise.all(Array.from({ length: 5 }, () => service.transition(s.id, 'PICKED_UP')));
      expect((await events(s.id)).map((e) => e.status)).toEqual(['PENDING', 'PICKED_UP']);
      expect(calls).toEqual([`${s.id}:PICKED_UP`]);
    });

    it('lets exactly one of two concurrent different targets win; the loser is refused', async () => {
      const s = await newShipment();
      const results = await Promise.allSettled([service.transition(s.id, 'PICKED_UP'), service.transition(s.id, 'FAILED')]);
      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      const loser = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(loser.reason).toMatchObject({ code: 'INVALID_SHIPMENT_TRANSITION' });
      const winner = await statusOf(s.id);
      expect((await events(s.id)).map((e) => e.status)).toEqual(['PENDING', winner]);
      expect(calls).toEqual([`${s.id}:${winner}`]);
    });

    it('rolls back when no handler is registered for the type', async () => {
      const s = await newShipment('LOAN_PICKUP');
      await expect(service.transition(s.id, 'PICKED_UP')).rejects.toThrow(/No shipment status handler/);
      expect(await statusOf(s.id)).toBe('PENDING');
      expect(await events(s.id)).toHaveLength(1);
    });

    describe('retry', () => {
      it('creates a PENDING copy linked to the failed one, then calls onRetried with both', async () => {
        const s = await failed();
        const created = await service.retry(s.id);
        expect(created).toMatchObject({ type: 'LOAN_DELIVERY', status: 'PENDING', fee: 0, retryOfId: s.id, orderId: null });
        expect(created.address).toEqual(ADDRESS_INPUT);
        expect(created.events.map((e) => e.status)).toEqual(['PENDING']);
        expect((await service.adminGet(s.id)).retriedById).toBe(created.id);
        expect(calls).toEqual([`retried:${s.id}->${created.id}`]);
      });

      it('rolls the new shipment back when onRetried refuses', async () => {
        const s = await failed();
        onRetried = async () => {
          throw new DomainError('INVALID_SHIPMENT_TRANSITION');
        };
        await expect(service.retry(s.id)).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_TRANSITION' });
        expect(await ctx.prisma.shipment.count()).toBe(1);
        expect((await service.adminGet(s.id)).retriedById).toBeNull();
      });

      it('refuses a shipment that has not failed, and an unknown one', async () => {
        const s = await newShipment();
        await expect(service.retry(s.id)).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_TRANSITION' });
        await expect(service.retry('khong-co')).rejects.toMatchObject({ code: 'NOT_FOUND' });
      });

      it('answers SHIPMENT_ALREADY_RETRIED to a second retry, before any hook runs', async () => {
        const s = await failed();
        await service.retry(s.id);
        calls.length = 0;
        await expect(service.retry(s.id)).rejects.toMatchObject({ code: 'SHIPMENT_ALREADY_RETRIED' });
        expect(calls).toEqual([]);
        expect(await ctx.prisma.shipment.count()).toBe(2);
      });

      it('creates exactly one shipment when retries race', async () => {
        const s = await failed();
        const results = await Promise.allSettled([service.retry(s.id), service.retry(s.id), service.retry(s.id)]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        for (const r of results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')) {
          expect(r.reason).toMatchObject({ code: 'SHIPMENT_ALREADY_RETRIED' });
        }
        expect(await ctx.prisma.shipment.count()).toBe(2);
      });

      it('allows retrying a retry that failed too (chain)', async () => {
        const s = await failed();
        const second = await service.retry(s.id);
        await service.transition(second.id, 'FAILED');
        expect((await service.retry(second.id)).retryOfId).toBe(second.id);
      });

      it('refuses with 500 and creates nothing when no handler is registered for the type', async () => {
        const s = await newShipment('LOAN_PICKUP');
        await ctx.prisma.shipment.update({ where: { id: s.id }, data: { status: 'FAILED' } });
        await expect(service.retry(s.id)).rejects.toThrow(/No shipment status handler/);
        expect(await ctx.prisma.shipment.count()).toBe(1);
      });
    });

    it('reads statuses by id and the facts loans need', async () => {
      const a = await newShipment();
      const b = await failed();
      const retried = await service.retry(b.id);
      const statuses = await service.statusesOf([a.id, b.id, retried.id]);
      expect(Object.fromEntries(statuses)).toEqual({ [a.id]: 'PENDING', [b.id]: 'FAILED', [retried.id]: 'PENDING' });
      expect(await service.findForLoans(ctx.prisma, b.id)).toEqual({ type: 'LOAN_DELIVERY', status: 'FAILED', retriedById: retried.id });
      expect(await service.findForLoans(ctx.prisma, 'khong-co')).toBeNull();
    });
  });

  // HTTP surface, on ORDER_DELIVERY shipments (orders registers the real handler).
  describe('admin API', () => {
    let admin: string;
    let shipments: ShipmentsService;

    beforeEach(async () => {
      admin = await loginAs(ctx, 'ADMIN');
      shipments = ctx.app.get(ShipmentsService);
    });

    const orderShipment = async () => {
      const user = await ctx.prisma.user.findFirst({ where: { email: 'buyer@test.vn' } }) ?? (await createUser(ctx.prisma, 'buyer@test.vn'));
      const order = await ctx.prisma.order.create({
        data: { userId: user.id, status: 'PAID', subtotal: 0, shippingFee: 20_000, total: 20_000, addressSnapshot: ADDRESS_INPUT },
      });
      return shipments.create(ctx.prisma, { type: 'ORDER_DELIVERY', orderId: order.id, fee: 20_000, addressSnapshot: ADDRESS_INPUT });
    };
    const patch = (id: string, body: object, cookie = admin) =>
      request(ctx.http).patch(`/api/admin/shipments/${id}`).set('Cookie', cookie).send(body);
    const retry = (id: string, cookie = admin) =>
      request(ctx.http).post(`/api/admin/shipments/${id}/retry`).set('Cookie', cookie).send({});

    it('changes the status with a note and refuses an illegal step with 409', async () => {
      const s = await orderShipment();
      const res = await patch(s.id, { status: 'PICKED_UP', note: 'Shipper A' }).expect(200);
      expect(res.body.events.map((e: { note: string | null }) => e.note)).toEqual([null, 'Shipper A']);
      expect((await patch(s.id, { status: 'DELIVERED' }).expect(409)).body.code).toBe('INVALID_SHIPMENT_TRANSITION');
    });

    it('validates the body, stores a blank note as null, and answers 404 for an unknown shipment', async () => {
      const s = await orderShipment();
      expect((await patch(s.id, { status: 'LOST' }).expect(400)).body.code).toBe('VALIDATION_ERROR');
      await patch(s.id, { status: 'FAILED', note: 'x'.repeat(501) }).expect(400);
      await patch(s.id, { status: 'FAILED', note: '   ' }).expect(200);
      expect((await events(s.id))[1]!.note).toBeNull();
      await patch('khong-co', { status: 'PICKED_UP' }).expect(404);
    });

    it('retries a failed shipment once, over HTTP', async () => {
      const s = await orderShipment();
      expect((await retry(s.id).expect(409)).body.code).toBe('INVALID_SHIPMENT_TRANSITION');
      await patch(s.id, { status: 'FAILED' }).expect(200);
      const created = await retry(s.id).expect(201);
      expect(created.body).toMatchObject({ type: 'ORDER_DELIVERY', status: 'PENDING', retryOfId: s.id, orderId: s.orderId });
      expect((await retry(s.id).expect(409)).body.code).toBe('SHIPMENT_ALREADY_RETRIED');
      await retry('khong-co').expect(404);
    });

    it('lists newest first, filters by status and type, and ignores hand-edited values', async () => {
      const a = await orderShipment();
      const b = await shipments.create(ctx.prisma, { type: 'LOAN_PICKUP', fee: 0, addressSnapshot: ADDRESS_INPUT });
      await patch(a.id, { status: 'FAILED' }).expect(200);
      const all = await request(ctx.http).get('/api/admin/shipments').set('Cookie', admin).expect(200);
      expect(all.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
      expect(all.body.items.map((r: { id: string }) => r.id)).toEqual([b.id, a.id]);
      expect(all.body.items[1]).toMatchObject({ type: 'ORDER_DELIVERY', status: 'FAILED', orderId: a.orderId, retriedById: null });
      const failedOnly = await request(ctx.http).get('/api/admin/shipments?status=FAILED').set('Cookie', admin).expect(200);
      expect(failedOnly.body.items.map((r: { id: string }) => r.id)).toEqual([a.id]);
      const pickups = await request(ctx.http).get('/api/admin/shipments?type=LOAN_PICKUP').set('Cookie', admin).expect(200);
      expect(pickups.body.items.map((r: { id: string }) => r.id)).toEqual([b.id]);
      const edited = await request(ctx.http).get('/api/admin/shipments?status=abc&type=&page=-3').set('Cookie', admin).expect(200);
      expect(edited.body.total).toBe(2);
    });

    it('pages by 20 and answers 404 for an unknown shipment', async () => {
      for (let i = 0; i < 21; i++) await shipments.create(ctx.prisma, { type: 'LOAN_PICKUP', fee: 0, addressSnapshot: ADDRESS_INPUT });
      const second = await request(ctx.http).get('/api/admin/shipments?page=2').set('Cookie', admin).expect(200);
      expect(second.body).toMatchObject({ total: 21, page: 2 });
      expect(second.body.items).toHaveLength(1);
      await request(ctx.http).get('/api/admin/shipments/khong-co').set('Cookie', admin).expect(404);
    });

    it('forbids customers (403)', async () => {
      const s = await orderShipment();
      const customer = await loginAs(ctx, 'CUSTOMER');
      await request(ctx.http).get('/api/admin/shipments').set('Cookie', customer).expect(403);
      await request(ctx.http).get(`/api/admin/shipments/${s.id}`).set('Cookie', customer).expect(403);
      await patch(s.id, { status: 'PICKED_UP' }, customer).expect(403);
      await retry(s.id, customer).expect(403);
    });
  });
});

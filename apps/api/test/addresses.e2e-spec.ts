import type { AddressDto } from '@open-boox/shared';
import request from 'supertest';
import { loginAs } from './auth-helpers';
import { ADDRESS_INPUT } from './order-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('addresses', () => {
  let ctx: TestContext;
  let customer: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    customer = await loginAs(ctx, 'CUSTOMER');
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const create = (body: object = ADDRESS_INPUT, cookie = customer) =>
    request(ctx.http).post('/api/addresses').set('Cookie', cookie).send(body);
  const list = async (cookie = customer) =>
    (await request(ctx.http).get('/api/addresses').set('Cookie', cookie).expect(200)).body as AddressDto[];

  it('requires login', async () => {
    await request(ctx.http).get('/api/addresses').expect(401);
  });

  it('makes the first address the default and later ones not', async () => {
    const first = (await create().expect(201)).body as AddressDto;
    const second = (await create({ ...ADDRESS_INPUT, city: 'Huế' }).expect(201)).body as AddressDto;
    expect(first).toMatchObject({ ...ADDRESS_INPUT, isDefault: true });
    expect(first).not.toHaveProperty('zone');
    expect(second.isDefault).toBe(false);
  });

  it('lists the default address first', async () => {
    await create();
    const second = (await create({ ...ADDRESS_INPUT, city: 'Huế' })).body as AddressDto;
    await request(ctx.http).post(`/api/addresses/${second.id}/default`).set('Cookie', customer).send({}).expect(200);
    const rows = await list();
    expect(rows.map((a) => a.id)[0]).toBe(second.id);
    expect(rows.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it('rejects a city outside the 34-province list with fields.city', async () => {
    const res = await create({ ...ADDRESS_INPUT, city: 'Hà Giang' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.fields.city).toBeDefined();
  });

  it('updates fields but ignores isDefault in PATCH', async () => {
    await create();
    const second = (await create({ ...ADDRESS_INPUT, city: 'Huế' })).body as AddressDto;
    const res = await request(ctx.http)
      .patch(`/api/addresses/${second.id}`)
      .set('Cookie', customer)
      .send({ ...ADDRESS_INPUT, line: '2 Lê Lợi', city: 'Đà Nẵng', isDefault: true })
      .expect(200);
    expect(res.body).toMatchObject({ line: '2 Lê Lợi', city: 'Đà Nẵng', isDefault: false });
  });

  it('moves the default with POST /:id/default and answers 200 again when it already is', async () => {
    const first = (await create()).body as AddressDto;
    const second = (await create({ ...ADDRESS_INPUT, city: 'Huế' })).body as AddressDto;
    const setDefault = (id: string) =>
      request(ctx.http).post(`/api/addresses/${id}/default`).set('Cookie', customer).send({});
    expect((await setDefault(second.id).expect(200)).body.isDefault).toBe(true);
    expect((await setDefault(second.id).expect(200)).body.isDefault).toBe(true);
    const rows = await list();
    expect(rows.find((a) => a.id === first.id)!.isDefault).toBe(false);
  });

  it('leaves no default after deleting the default address', async () => {
    const first = (await create()).body as AddressDto;
    await create({ ...ADDRESS_INPUT, city: 'Huế' });
    await request(ctx.http).delete(`/api/addresses/${first.id}`).set('Cookie', customer).send({}).expect(204);
    const rows = await list();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.isDefault).toBe(false);
  });

  it("returns 404 for another user's address and changes nothing", async () => {
    const mine = (await create()).body as AddressDto;
    const other = await loginAs(ctx, 'CUSTOMER', 'other@test.vn');
    await request(ctx.http).patch(`/api/addresses/${mine.id}`).set('Cookie', other).send(ADDRESS_INPUT).expect(404);
    await request(ctx.http).delete(`/api/addresses/${mine.id}`).set('Cookie', other).send({}).expect(404);
    await request(ctx.http).post(`/api/addresses/${mine.id}/default`).set('Cookie', other).send({}).expect(404);
    expect(await list(other)).toEqual([]);
    expect(await list()).toHaveLength(1);
  });

  it('keeps exactly one default when two first addresses are created concurrently', async () => {
    const results = await Promise.all([create(), create({ ...ADDRESS_INPUT, city: 'Huế' })]);
    for (const res of results) {
      expect([201, 409]).toContain(res.status);
      if (res.status === 409) expect(res.body.code).toBe('DUPLICATE');
    }
    expect((await list()).filter((a) => a.isDefault)).toHaveLength(1);
  });
});

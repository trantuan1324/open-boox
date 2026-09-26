import request from 'supertest';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('inventory admin', () => {
  let ctx: TestContext;
  let admin: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    admin = await loginAs(ctx, 'ADMIN');
    categoryId = (await createCategory(ctx.prisma, 'Văn học', 'van-hoc')).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const adjust = (bookId: string, delta: unknown) =>
    request(ctx.http).post(`/api/admin/books/${bookId}/stock`).set('Cookie', admin).send({ delta });
  const quantity = async (bookId: string) =>
    (await ctx.prisma.saleStock.findUniqueOrThrow({ where: { bookId } })).quantity;

  describe('stock', () => {
    it('adds and removes stock by delta', async () => {
      const book = await createBook(ctx.prisma, categoryId, { title: 'A' });
      await adjust(book.id, 5).expect(200, { quantity: 5 });
      await adjust(book.id, -2).expect(200, { quantity: 3 });
    });

    it('refuses to go below zero with OUT_OF_STOCK and leaves the stock unchanged', async () => {
      const book = await createBook(ctx.prisma, categoryId, { title: 'A', stock: 3 });
      const res = await adjust(book.id, -10).expect(409);
      expect(res.body.code).toBe('OUT_OF_STOCK');
      expect(await quantity(book.id)).toBe(3);
    });

    it.each([0, 1.5, 'abc'])('rejects delta %j with 400', async (delta) => {
      const book = await createBook(ctx.prisma, categoryId, { title: 'A' });
      await adjust(book.id, delta).expect(400);
    });

    it('returns 404 for an unknown book', async () => {
      await adjust('khong-co', 1).expect(404);
    });

    it('lets exactly one of two concurrent -1 adjustments win when one unit is left', async () => {
      const book = await createBook(ctx.prisma, categoryId, { title: 'Còn 1', stock: 1 });
      const results = await Promise.all([adjust(book.id, -1), adjust(book.id, -1)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(results.find((r) => r.status === 409)!.body.code).toBe('OUT_OF_STOCK');
      expect(await quantity(book.id)).toBe(0);
    });
  });

  describe('copies', () => {
    const addCopies = (bookId: string, count: unknown) =>
      request(ctx.http).post(`/api/admin/books/${bookId}/copies`).set('Cookie', admin).send({ count });
    const markLost = (copyId: string) =>
      request(ctx.http).post(`/api/admin/copies/${copyId}/lost`).set('Cookie', admin).send({});

    it('adds AVAILABLE copies with distinct generated barcodes', async () => {
      const book = await createBook(ctx.prisma, categoryId, { title: 'A' });
      const res = await addCopies(book.id, 3).expect(201);
      expect(res.body).toHaveLength(3);
      for (const copy of res.body) {
        expect(copy.status).toBe('AVAILABLE');
        expect(copy.barcode).toMatch(/^OB-\d{6}$/);
      }
      expect(new Set(res.body.map((c: { barcode: string }) => c.barcode)).size).toBe(3);
    });

    it.each([0, 51])('rejects count %j with 400', async (count) => {
      const book = await createBook(ctx.prisma, categoryId, { title: 'A' });
      await addCopies(book.id, count).expect(400);
    });

    it('returns 404 when adding copies to an unknown book', async () => {
      await addCopies('khong-co', 1).expect(404);
    });

    it('marks an AVAILABLE copy as LOST, then refuses a second time', async () => {
      const book = await createBook(ctx.prisma, categoryId, { title: 'A', copies: ['AVAILABLE'] });
      const copy = await ctx.prisma.bookCopy.findFirstOrThrow({ where: { bookId: book.id } });
      await markLost(copy.id).expect(200, { id: copy.id, barcode: copy.barcode, status: 'LOST' });
      const again = await markLost(copy.id).expect(409);
      expect(again.body.code).toBe('INVALID_COPY_STATE');
    });

    it.each(['RESERVED', 'ON_LOAN'] as const)('refuses to mark a %s copy as lost', async (status) => {
      const book = await createBook(ctx.prisma, categoryId, { title: 'A', copies: [status] });
      const copy = await ctx.prisma.bookCopy.findFirstOrThrow({ where: { bookId: book.id } });
      const res = await markLost(copy.id).expect(409);
      expect(res.body.code).toBe('INVALID_COPY_STATE');
      expect((await ctx.prisma.bookCopy.findUniqueOrThrow({ where: { id: copy.id } })).status).toBe(status);
    });

    it('returns 404 for an unknown copy', async () => {
      await markLost('khong-co').expect(404);
    });
  });

  it('forbids customers', async () => {
    const book = await createBook(ctx.prisma, categoryId, { title: 'A' });
    const customer = await loginAs(ctx, 'CUSTOMER');
    await request(ctx.http).post(`/api/admin/books/${book.id}/stock`).set('Cookie', customer).send({ delta: 1 }).expect(403);
    await request(ctx.http).post(`/api/admin/books/${book.id}/copies`).set('Cookie', customer).send({ count: 1 }).expect(403);
  });
});

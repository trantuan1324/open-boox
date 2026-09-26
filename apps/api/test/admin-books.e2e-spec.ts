import request from 'supertest';
import { loginAs } from './auth-helpers';
import { createBook, createCategory } from './catalog-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('admin books', () => {
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

  const input = (over: Record<string, unknown> = {}) => ({
    title: 'Nhà giả kim',
    author: 'Paulo Coelho',
    isbn: '9780062315007',
    description: 'Một cuốn sách.',
    coverUrl: '',
    categoryId,
    salePrice: '89000',
    ...over,
  });
  const create = (body: Record<string, unknown>) =>
    request(ctx.http).post('/api/admin/books').set('Cookie', admin).send(body);

  it('rejects anonymous callers with 401 and customers with 403', async () => {
    await request(ctx.http).get('/api/admin/books').expect(401);
    const customer = await loginAs(ctx, 'CUSTOMER');
    await request(ctx.http).get('/api/admin/books').set('Cookie', customer).expect(403);
    await request(ctx.http).post('/api/admin/books').set('Cookie', customer).send(input()).expect(403);
  });

  it('creates a book with a slug from the title and an empty stock row', async () => {
    const res = await create(input()).expect(201);
    expect(res.body).toMatchObject({
      slug: 'nha-gia-kim',
      title: 'Nhà giả kim',
      salePrice: 89000,
      coverUrl: null,
      categoryId,
      categoryName: 'Văn học',
      saleStock: 0,
      availableCopies: 0,
      copies: [],
    });
    expect(await ctx.prisma.saleStock.findUnique({ where: { bookId: res.body.id } })).toMatchObject({ quantity: 0 });
  });

  it('gives a second book with the same title a numbered slug', async () => {
    await create(input()).expect(201);
    const res = await create(input({ isbn: '9780062315008' })).expect(201);
    expect(res.body.slug).toBe('nha-gia-kim-2');
  });

  it('falls back to a generic slug when the title has no letters or digits', async () => {
    const res = await create(input({ title: '!!!' })).expect(201);
    expect(res.body.slug).toBe('sach');
  });

  it('normalizes ISBN hyphens and rejects a duplicate on the isbn field', async () => {
    await create(input()).expect(201);
    const res = await create(input({ title: 'Khác', isbn: '978-0-06-231500-7' })).expect(409);
    expect(res.body).toMatchObject({ code: 'DUPLICATE', fields: { isbn: 'ISBN đã tồn tại' } });
  });

  it('rejects an unknown category on the categoryId field', async () => {
    const res = await create(input({ categoryId: 'khong-co' })).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', fields: { categoryId: 'Thể loại không tồn tại' } });
  });

  it('returns field errors for invalid input', async () => {
    const res = await create(input({ title: ' ', salePrice: '-5', coverUrl: 'javascript:alert(1)' })).expect(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['coverUrl', 'salePrice', 'title']);
  });

  it('updates fields but keeps the slug, and can clear the price', async () => {
    const { body } = await create(input()).expect(201);
    const res = await request(ctx.http)
      .patch(`/api/admin/books/${body.id}`)
      .set('Cookie', admin)
      .send(input({ title: 'Nhà giả kim (tái bản)', salePrice: '' }))
      .expect(200);
    expect(res.body).toMatchObject({ slug: 'nha-gia-kim', title: 'Nhà giả kim (tái bản)', salePrice: null });
  });

  it('rejects changing the ISBN to one another book uses', async () => {
    await create(input()).expect(201);
    const { body } = await create(input({ title: 'Khác', isbn: '9780062315008' })).expect(201);
    const res = await request(ctx.http)
      .patch(`/api/admin/books/${body.id}`)
      .set('Cookie', admin)
      .send(input({ title: 'Khác' }))
      .expect(409);
    expect(res.body.fields).toEqual({ isbn: 'ISBN đã tồn tại' });
  });

  it('returns 404 for an unknown book on get, update and delete', async () => {
    await request(ctx.http).get('/api/admin/books/khong-co').set('Cookie', admin).expect(404);
    await request(ctx.http).patch('/api/admin/books/khong-co').set('Cookie', admin).send(input()).expect(404);
    await request(ctx.http).delete('/api/admin/books/khong-co').set('Cookie', admin).send({}).expect(404);
  });

  it('deletes a book together with its stock and copies', async () => {
    const book = await createBook(ctx.prisma, categoryId, { title: 'Xóa tôi', stock: 2, copies: ['AVAILABLE'] });
    await request(ctx.http).delete(`/api/admin/books/${book.id}`).set('Cookie', admin).send({}).expect(204);
    expect(await ctx.prisma.book.count()).toBe(0);
    expect(await ctx.prisma.saleStock.count()).toBe(0);
    expect(await ctx.prisma.bookCopy.count()).toBe(0);
  });

  it('lists books with copy counts per status and accent-insensitive search', async () => {
    await createBook(ctx.prisma, categoryId, { title: 'Đắc nhân tâm', copies: ['AVAILABLE', 'AVAILABLE', 'LOST'] });
    await createBook(ctx.prisma, categoryId, { title: 'Khác' });
    const res = await request(ctx.http).get('/api/admin/books').query({ q: 'dac' }).set('Cookie', admin).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].copyCounts).toEqual({ AVAILABLE: 2, RESERVED: 0, ON_LOAN: 0, LOST: 1 });
  });

  it('returns one book with its copies sorted by barcode', async () => {
    const book = await createBook(ctx.prisma, categoryId, { title: 'Có bản', stock: 5, copies: ['AVAILABLE', 'ON_LOAN'] });
    const res = await request(ctx.http).get(`/api/admin/books/${book.id}`).set('Cookie', admin).expect(200);
    expect(res.body).toMatchObject({ id: book.id, categoryId, saleStock: 5, availableCopies: 1 });
    expect(res.body.copies.map((c: { status: string }) => c.status)).toEqual(['AVAILABLE', 'ON_LOAN']);
  });
});

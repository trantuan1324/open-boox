import request from 'supertest';
import { createBook, createCategory } from './catalog-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('public catalog', () => {
  let ctx: TestContext;
  let novels: string;
  let business: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    novels = (await createCategory(ctx.prisma, 'Văn học', 'van-hoc')).id;
    business = (await createCategory(ctx.prisma, 'Kinh tế', 'kinh-te')).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const books = (query: Record<string, string | number> = {}) => request(ctx.http).get('/api/books').query(query).expect(200);
  const titles = (res: request.Response) => res.body.items.map((b: { title: string }) => b.title);

  it('lists categories by name without a login', async () => {
    const res = await request(ctx.http).get('/api/categories').expect(200);
    expect(res.body).toEqual([
      { id: business, name: 'Kinh tế', slug: 'kinh-te' },
      { id: novels, name: 'Văn học', slug: 'van-hoc' },
    ]);
  });

  it('searches title and author ignoring accents and case', async () => {
    await createBook(ctx.prisma, novels, { title: 'Nhà giả kim', author: 'Paulo Coelho' });
    await createBook(ctx.prisma, business, { title: 'Đắc nhân tâm', author: 'Dale Carnegie' });
    await createBook(ctx.prisma, novels, { title: 'Rừng Na Uy', author: 'Haruki Murakami' });
    expect(titles(await books({ q: 'nha gia kim' }))).toEqual(['Nhà giả kim']);
    expect(titles(await books({ q: 'ĐẮC NHÂN' }))).toEqual(['Đắc nhân tâm']);
    expect(titles(await books({ q: 'dac nhan' }))).toEqual(['Đắc nhân tâm']);
    expect(titles(await books({ q: 'murakami' }))).toEqual(['Rừng Na Uy']);
  });

  it('treats % and _ in the search text literally', async () => {
    await createBook(ctx.prisma, novels, { title: 'Giảm 100% phí' });
    await createBook(ctx.prisma, novels, { title: 'Sách 1000 trang' });
    await createBook(ctx.prisma, novels, { title: 'a_b' });
    await createBook(ctx.prisma, novels, { title: 'axb' });
    expect(titles(await books({ q: '100%' }))).toEqual(['Giảm 100% phí']);
    expect(titles(await books({ q: 'a_b' }))).toEqual(['a_b']);
  });

  it('filters by category slug and returns nothing for an unknown slug', async () => {
    await createBook(ctx.prisma, novels, { title: 'Truyện' });
    await createBook(ctx.prisma, business, { title: 'Quản trị' });
    expect(titles(await books({ category: 'kinh-te' }))).toEqual(['Quản trị']);
    expect((await books({ category: 'khong-co' })).body).toMatchObject({ items: [], total: 0 });
  });

  it('availability=sale keeps only books with a price and stock', async () => {
    await createBook(ctx.prisma, novels, { title: 'Có hàng', salePrice: 90_000, stock: 2 });
    await createBook(ctx.prisma, novels, { title: 'Hết hàng', salePrice: 90_000, stock: 0 });
    await createBook(ctx.prisma, novels, { title: 'Không bán', salePrice: null, stock: 5 });
    expect(titles(await books({ availability: 'sale' }))).toEqual(['Có hàng']);
  });

  it('availability=loan keeps only books with an AVAILABLE copy', async () => {
    await createBook(ctx.prisma, novels, { title: 'Còn bản', copies: ['AVAILABLE', 'ON_LOAN'] });
    await createBook(ctx.prisma, novels, { title: 'Hết bản', copies: ['ON_LOAN', 'LOST', 'RESERVED'] });
    await createBook(ctx.prisma, novels, { title: 'Không có bản' });
    expect(titles(await books({ availability: 'loan' }))).toEqual(['Còn bản']);
  });

  it('returns stock and available-copy counts on each item', async () => {
    await createBook(ctx.prisma, novels, { title: 'Một', slug: 'mot', stock: 4, copies: ['AVAILABLE', 'LOST'] });
    expect((await books()).body.items[0]).toEqual({
      id: expect.any(String),
      slug: 'mot',
      title: 'Một',
      author: 'Tác giả',
      isbn: expect.any(String),
      coverUrl: null,
      salePrice: 100_000,
      categoryName: 'Văn học',
      categorySlug: 'van-hoc',
      saleStock: 4,
      availableCopies: 1,
    });
  });

  it('pages by 12 sorted by title, with the total', async () => {
    for (let i = 1; i <= 13; i++) {
      await createBook(ctx.prisma, novels, { title: `Sách ${String(i).padStart(2, '0')}` });
    }
    const first = await books();
    expect(first.body).toMatchObject({ total: 13, page: 1, pageSize: 12 });
    expect(first.body.items).toHaveLength(12);
    expect(first.body.items[0].title).toBe('Sách 01');
    expect(titles(await books({ page: 2 }))).toEqual(['Sách 13']);
  });

  it('falls back to defaults for malformed query values', async () => {
    await createBook(ctx.prisma, novels, { title: 'Một' });
    const res = await request(ctx.http).get('/api/books?page=abc&availability=xyz&q=&q=x').expect(200);
    expect(res.body).toMatchObject({ page: 1, total: 1 });
  });

  it('returns book detail by slug', async () => {
    await createBook(ctx.prisma, novels, { title: 'Nhà giả kim', slug: 'nha-gia-kim', stock: 3, copies: ['AVAILABLE', 'AVAILABLE', 'LOST'] });
    const res = await request(ctx.http).get('/api/books/nha-gia-kim').expect(200);
    expect(res.body).toMatchObject({
      slug: 'nha-gia-kim',
      title: 'Nhà giả kim',
      description: '',
      categoryName: 'Văn học',
      categorySlug: 'van-hoc',
      saleStock: 3,
      availableCopies: 2,
    });
  });

  it('returns 404 NOT_FOUND for an unknown slug', async () => {
    const res = await request(ctx.http).get('/api/books/khong-co').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

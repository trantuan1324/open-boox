import { InventoryService } from '../src/inventory/inventory.service';
import { createBook, createCategory } from './catalog-fixtures';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('inventory for loans', () => {
  let ctx: TestContext;
  let inventory: InventoryService;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    inventory = ctx.app.get(InventoryService);
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    categoryId = (await createCategory(ctx.prisma, 'Văn học', 'van-hoc')).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const copiesOf = (bookId: string) => ctx.prisma.bookCopy.findMany({ where: { bookId }, orderBy: { barcode: 'asc' } });
  const reserve = (bookId: string) => ctx.prisma.$transaction((tx) => inventory.reserveCopy(tx, bookId));

  it('reserves an AVAILABLE copy only, and answers null when none is left', async () => {
    const book = await createBook(ctx.prisma, categoryId, { title: 'A', copies: ['LOST', 'ON_LOAN', 'AVAILABLE'] });
    const available = (await copiesOf(book.id)).find((c) => c.status === 'AVAILABLE')!;
    expect(await reserve(book.id)).toBe(available.id);
    expect((await copiesOf(book.id)).map((c) => c.status)).toEqual(['LOST', 'ON_LOAN', 'RESERVED']);
    expect(await reserve(book.id)).toBeNull();
  });

  it('gives the last copy to exactly one of two concurrent reservations', async () => {
    const book = await createBook(ctx.prisma, categoryId, { title: 'A', copies: ['AVAILABLE'] });
    const results = await Promise.all([reserve(book.id), reserve(book.id)]);
    expect(results.filter((id) => id !== null)).toHaveLength(1);
    expect((await copiesOf(book.id)).map((c) => c.status)).toEqual(['RESERVED']);
  });

  it('moves only copies in the expected status and reports how many moved', async () => {
    const book = await createBook(ctx.prisma, categoryId, { title: 'A', copies: ['RESERVED', 'RESERVED', 'AVAILABLE'] });
    const ids = (await copiesOf(book.id)).map((c) => c.id);
    const moved = await ctx.prisma.$transaction((tx) => inventory.moveCopies(tx, ids, 'RESERVED', 'ON_LOAN'));
    expect(moved).toBe(2);
    expect((await copiesOf(book.id)).map((c) => c.status)).toEqual(['ON_LOAN', 'ON_LOAN', 'AVAILABLE']);
  });
});

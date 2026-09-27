import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { uniqueSlug } from '../src/catalog/slugify';
import { formatBarcode } from '../src/inventory/barcode';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

async function upsertUser(email: string, password: string, fullName: string, role: Role): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const passwordHash = await argon2.hash(password);
  await prisma.user.upsert({
    where: { email: normalized },
    update: { passwordHash, role },
    create: { email: normalized, passwordHash, fullName, phone: '0900000000', role },
  });
}

const CATEGORIES = [
  { slug: 'van-hoc', name: 'Văn học' },
  { slug: 'kinh-te', name: 'Kinh tế' },
  { slug: 'tam-ly-ky-nang', name: 'Tâm lý – Kỹ năng' },
  { slug: 'khoa-hoc', name: 'Khoa học' },
  { slug: 'lich-su', name: 'Lịch sử' },
  { slug: 'thieu-nhi', name: 'Thiếu nhi' },
];

// [title, author, isbn, salePrice (null = không bán), saleStock, loan copies]
// Mix on purpose so every filter and label has data: loan-only (price null), sale-only (0 copies), out of stock (stock 0).
type SeedBook = [string, string, string, number | null, number, number];

const BOOKS: Record<string, SeedBook[]> = {
  'van-hoc': [
    ['Nhà giả kim', 'Paulo Coelho', '9780062315007', 79_000, 8, 3],
    ['Rừng Na Uy', 'Haruki Murakami', '9780375704024', 135_000, 5, 2],
    ['Trăm năm cô đơn', 'Gabriel García Márquez', '9780060883287', null, 0, 3],
    ['Ông già và biển cả', 'Ernest Hemingway', '9780684801223', 65_000, 6, 2],
    ['Giết con chim nhại', 'Harper Lee', '9780060935467', 120_000, 4, 2],
  ],
  'kinh-te': [
    ['Cha giàu cha nghèo', 'Robert T. Kiyosaki', '9781612680194', 98_000, 10, 3],
    ['Nhà đầu tư thông minh', 'Benjamin Graham', '9780060555665', 215_000, 3, 1],
    ['Từ tốt đến vĩ đại', 'Jim Collins', '9780066620992', 145_000, 4, 2],
    ['Khởi nghiệp tinh gọn', 'Eric Ries', '9780307887894', 125_000, 7, 0],
    ['Tư duy nhanh và chậm', 'Daniel Kahneman', '9780374533557', 189_000, 5, 2],
  ],
  'tam-ly-ky-nang': [
    ['Đắc nhân tâm', 'Dale Carnegie', '9780671027032', 86_000, 12, 3],
    ['Thói quen nguyên tử', 'James Clear', '9780735211292', 159_000, 0, 2],
    ['7 thói quen hiệu quả', 'Stephen R. Covey', '9781982137274', 175_000, 4, 2],
    ['Sức mạnh của thói quen', 'Charles Duhigg', '9780812981605', 139_000, 5, 1],
    ['Đi tìm lẽ sống', 'Viktor E. Frankl', '9780807014295', 72_000, 6, 2],
  ],
  'khoa-hoc': [
    ['Lược sử thời gian', 'Stephen Hawking', '9780553380163', 115_000, 0, 2],
    ['Vũ trụ', 'Carl Sagan', '9780345539434', 199_000, 3, 2],
    ['Gen: Một lịch sử mật thiết', 'Siddhartha Mukherjee', '9781476733524', 249_000, 2, 1],
    ['Gen vị kỷ', 'Richard Dawkins', '9780198788607', null, 0, 2],
    ['Súng, vi trùng và thép', 'Jared Diamond', '9780393354324', 229_000, 3, 2],
  ],
  'lich-su': [
    ['Sapiens: Lược sử loài người', 'Yuval Noah Harari', '9780062316097', 209_000, 9, 3],
    ['Homo Deus: Lược sử tương lai', 'Yuval Noah Harari', '9780062464316', 219_000, 6, 0],
    ['Nhật ký Anne Frank', 'Anne Frank', '9780553296983', null, 0, 2],
    ['Con đường tơ lụa', 'Peter Frankopan', '9781101912379', 235_000, 2, 1],
    ['Thế chiến thứ hai', 'Antony Beevor', '9780316023757', 245_000, 2, 1],
  ],
  'thieu-nhi': [
    ['Hoàng tử bé', 'Antoine de Saint-Exupéry', '9780156012195', 59_000, 15, 3],
    ['Harry Potter và hòn đá phù thủy', 'J.K. Rowling', '9780590353427', 149_000, 8, 3],
    ['Charlie và nhà máy sô-cô-la', 'Roald Dahl', '9780142410318', 89_000, 5, 2],
    ['Matilda', 'Roald Dahl', '9780142410370', 85_000, 4, 0],
    ['Dế Mèn phiêu lưu ký', 'Tô Hoài', '9786042088318', 45_000, 10, 2],
  ],
};

function coverUrlFor(isbn: string): string | null {
  // Vietnamese editions (978-604) have no Open Library cover; keep one null cover to exercise the placeholder.
  if (isbn.startsWith('978604')) return null;
  // default=false makes Open Library answer 404 instead of a blank image, so BookCover falls back.
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
}

// Idempotent: books are keyed by ISBN and only created once, so re-running never duplicates stock or copies.
async function seedCatalog(): Promise<void> {
  for (const category of CATEGORIES) {
    const { id: categoryId } = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
    for (const [title, author, isbn, salePrice, stock, copies] of BOOKS[category.slug]!) {
      if (await prisma.book.findUnique({ where: { isbn }, select: { id: true } })) continue;
      const serials =
        copies > 0
          ? await prisma.$queryRaw<{ n: bigint }[]>`
              SELECT nextval('book_copy_barcode_seq') AS n FROM generate_series(1, ${copies})`
          : [];
      await prisma.book.create({
        data: {
          title,
          author,
          isbn,
          slug: await uniqueSlug(prisma, title),
          description: `${title} — tác phẩm của ${author}.`,
          coverUrl: coverUrlFor(isbn),
          categoryId,
          salePrice,
          saleStock: { create: { quantity: stock } },
          copies: { create: serials.map((s) => ({ barcode: formatBarcode(s.n) })) },
        },
      });
    }
  }
}

// Two addresses for the sample customer so checkout can be tried with both shipping fees; first run only.
async function seedAddresses(customerEmail: string): Promise<void> {
  const customer = await prisma.user.findUniqueOrThrow({
    where: { email: customerEmail.trim().toLowerCase() },
    select: { id: true },
  });
  if ((await prisma.address.count({ where: { userId: customer.id } })) > 0) return;
  const base = { userId: customer.id, recipientName: 'Khách hàng mẫu', phone: '0900000000' };
  await prisma.address.createMany({
    data: [
      { ...base, line: '12 Tràng Tiền', ward: 'Phường Hoàn Kiếm', city: 'Hà Nội', isDefault: true },
      { ...base, line: '45 Bạch Đằng', ward: 'Phường Hải Châu', city: 'Đà Nẵng', isDefault: false },
    ],
  });
}

async function main(): Promise<void> {
  await upsertUser(requireEnv('SEED_ADMIN_EMAIL'), requireEnv('SEED_ADMIN_PASSWORD'), 'Quản trị viên', Role.ADMIN);
  await upsertUser(
    requireEnv('SEED_CUSTOMER_EMAIL'),
    requireEnv('SEED_CUSTOMER_PASSWORD'),
    'Khách hàng mẫu',
    Role.CUSTOMER,
  );
  await seedCatalog();
  await seedAddresses(requireEnv('SEED_CUSTOMER_EMAIL'));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

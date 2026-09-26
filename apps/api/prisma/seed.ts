import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

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

async function main(): Promise<void> {
  await upsertUser(requireEnv('SEED_ADMIN_EMAIL'), requireEnv('SEED_ADMIN_PASSWORD'), 'Quản trị viên', Role.ADMIN);
  await upsertUser(
    requireEnv('SEED_CUSTOMER_EMAIL'),
    requireEnv('SEED_CUSTOMER_PASSWORD'),
    'Khách hàng mẫu',
    Role.CUSTOMER,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

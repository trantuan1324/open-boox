import type { Province } from '@open-boox/shared';
import type { PrismaService } from '../src/prisma/prisma.service';

export const ADDRESS_INPUT = {
  recipientName: 'Nguyễn Văn A',
  phone: '0912345678',
  line: '1 Tràng Tiền',
  ward: 'Phường Hoàn Kiếm',
  city: 'Hà Nội',
};

export function createUser(prisma: PrismaService, email = 'user@test.vn') {
  return prisma.user.create({ data: { email, passwordHash: 'x', fullName: 'User', phone: '0900000000' } });
}

export async function userIdByEmail(prisma: PrismaService, email: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
}

// Writes directly (test-only): bypasses the "first address becomes default" rule.
export function createAddress(prisma: PrismaService, userId: string, city: Province = 'Hà Nội', isDefault = false) {
  return prisma.address.create({ data: { ...ADDRESS_INPUT, userId, city, isDefault } });
}

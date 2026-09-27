import { Injectable } from '@nestjs/common';
import type { AddressDto, AddressInput, AddressSnapshot, Province } from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { PrismaService } from '../prisma/prisma.service';

const SNAPSHOT_SELECT = { recipientName: true, phone: true, line: true, ward: true, city: true } as const;
const DTO_SELECT = { ...SNAPSHOT_SELECT, id: true, isDefault: true } as const;

// city is validated against PROVINCES on every write, so the cast only narrows the DB's plain string.
function withProvince<T extends { city: string }>(row: T): T & { city: Province } {
  return { ...row, city: row.city as Province };
}

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AddressDto[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: DTO_SELECT,
    });
    return rows.map(withProvince);
  }

  // The user's first address becomes the default. Two concurrent "first" creates may both try; the partial
  // unique index rejects the later one with P2002 → 409 DUPLICATE, which is accepted (spec §4.5a).
  async create(userId: string, input: AddressInput): Promise<AddressDto> {
    const isDefault = (await this.prisma.address.count({ where: { userId } })) === 0;
    return withProvince(await this.prisma.address.create({ data: { ...input, userId, isDefault }, select: DTO_SELECT }));
  }

  // isDefault is not part of AddressInput: the default only moves through setDefault.
  async update(userId: string, id: string, input: AddressInput): Promise<AddressDto> {
    const { count } = await this.prisma.address.updateMany({ where: { id, userId }, data: input });
    if (count === 0) throw new DomainError('NOT_FOUND');
    return withProvince(await this.prisma.address.findUniqueOrThrow({ where: { id }, select: DTO_SELECT }));
  }

  // Deleting the default leaves the user without one; orders keep their own snapshot.
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.address.deleteMany({ where: { id, userId } });
    if (count === 0) throw new DomainError('NOT_FOUND');
  }

  async setDefault(userId: string, id: string): Promise<AddressDto> {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id, userId }, select: DTO_SELECT });
      if (!address) throw new DomainError('NOT_FOUND');
      if (address.isDefault) return withProvince(address);
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      return withProvince(await tx.address.update({ where: { id }, data: { isDefault: true }, select: DTO_SELECT }));
    });
  }

  async snapshotFor(userId: string, id: string): Promise<AddressSnapshot> {
    const address = await this.prisma.address.findFirst({ where: { id, userId }, select: SNAPSHOT_SELECT });
    if (!address) throw new DomainError('NOT_FOUND');
    return withProvince(address);
  }
}

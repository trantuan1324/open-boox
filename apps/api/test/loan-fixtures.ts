import type { PrismaService } from '../src/prisma/prisma.service';

// Test-only shortcut for "the delivery arrived" before the loan shipment handler exists: loans ACTIVE, copies ON_LOAN.
export async function markActive(prisma: PrismaService, loanIds: string[]): Promise<void> {
  const loans = await prisma.loan.findMany({ where: { id: { in: loanIds } }, select: { bookCopyId: true } });
  await prisma.loan.updateMany({ where: { id: { in: loanIds } }, data: { status: 'ACTIVE', deliveredAt: new Date() } });
  await prisma.bookCopy.updateMany({ where: { id: { in: loans.map((l) => l.bookCopyId) } }, data: { status: 'ON_LOAN' } });
}

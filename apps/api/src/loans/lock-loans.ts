import type { CopyStatus, Prisma } from '@prisma/client';
import type { InventoryService } from '../inventory/inventory.service';

export interface LockedLoan {
  id: string;
  bookCopyId: string;
}

// spec §3.3: every multi-row Loan write locks its rows in id order first, so transactions touching overlapping
// loans queue instead of deadlocking (UPDATE … WHERE id IN (…) does not fix a lock order). Postgres re-checks
// the WHERE on each row after waiting for its lock, so rows another transaction just changed are left out.
export function lockLoans(tx: Prisma.TransactionClient, condition: Prisma.Sql): Promise<LockedLoan[]> {
  return tx.$queryRaw<LockedLoan[]>`SELECT id, "bookCopyId" FROM "Loan" WHERE ${condition} ORDER BY id FOR UPDATE`;
}

// Fail loud (spec §4.4a): a copy out of step with its loan would stay stuck for good, so a count mismatch is a
// 500 that rolls the whole transaction back.
export async function moveLockedCopies(
  inventory: InventoryService,
  tx: Prisma.TransactionClient,
  locked: LockedLoan[],
  from: CopyStatus,
  to: CopyStatus,
): Promise<void> {
  const moved = await inventory.moveCopies(tx, locked.map((loan) => loan.bookCopyId), from, to);
  if (moved !== locked.length) throw new Error(`Expected to move ${locked.length} ${from} copies to ${to}, moved ${moved}`);
}

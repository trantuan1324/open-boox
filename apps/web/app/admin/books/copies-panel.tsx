'use client';

import { addCopiesSchema, type BookCopyDto, type CopyStatus } from '@open-boox/shared';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';

const STATUS_LABEL: Record<CopyStatus, string> = {
  AVAILABLE: 'Sẵn sàng',
  RESERVED: 'Đang giữ',
  ON_LOAN: 'Đang cho mượn',
  LOST: 'Mất',
};

export function CopiesPanel({ bookId, copies }: { bookId: string; copies: BookCopyDto[] }) {
  const router = useRouter();
  const [count, setCount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(messageFor(e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
    } finally {
      setPending(false);
    }
  }

  function addCopies(event: FormEvent) {
    event.preventDefault();
    const parsed = addCopiesSchema.safeParse({ count });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? messageFor('VALIDATION_ERROR'));
      return;
    }
    void run(() => apiClient(`/admin/books/${bookId}/copies`, { method: 'POST', body: parsed.data }));
  }

  function markLost(copy: BookCopyDto) {
    if (!window.confirm(`Đánh dấu bản ${copy.barcode} là mất?`)) return;
    void run(() => apiClient(`/admin/copies/${copy.id}/lost`, { method: 'POST' }));
  }

  return (
    <section className="flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]">
      <h2 className="text-[18px] font-medium uppercase">Bản cho mượn ({copies.length})</h2>
      {copies.length === 0 ? (
        <p className="text-[16px]">Chưa có bản nào.</p>
      ) : (
        <ul className="flex flex-col">
          {copies.map((copy) => (
            <li key={copy.id} className="flex items-center justify-between gap-[12px] border-b border-dashed border-cork-border py-[10px] text-[14px]">
              <span>{copy.barcode}</span>
              <span className={copy.status === 'LOST' ? 'text-ember-accent' : ''}>{STATUS_LABEL[copy.status]}</span>
              {copy.status === 'AVAILABLE' ? (
                <Button type="button" variant="ghost" disabled={pending} onClick={() => markLost(copy)}>
                  Đánh dấu mất
                </Button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addCopies} className="flex flex-wrap items-end gap-[12px]">
        <TextField label="Thêm số bản" name="count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
        <Button type="submit" variant="ghost" disabled={pending}>
          Thêm bản
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {error}
        </p>
      )}
    </section>
  );
}

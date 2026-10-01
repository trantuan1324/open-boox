'use client';

import { stockAdjustSchema } from '@open-boox/shared';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';

export function StockPanel({ bookId, quantity }: { bookId: string; quantity: number }) {
  const router = useRouter();
  const [delta, setDelta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = stockAdjustSchema.safeParse({ delta });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? messageFor('VALIDATION_ERROR'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiClient(`/admin/books/${bookId}/stock`, { method: 'POST', body: parsed.data });
      setDelta('');
      router.refresh();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'INTERNAL_ERROR';
      setError(code === 'OUT_OF_STOCK' ? 'Tồn kho không đủ để xuất số lượng này.' : messageFor(code));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-[18px] rounded-[20px] border border-ink p-[24px]">
      <h2 className="text-[16px] font-bold uppercase tracking-[0.03em]">Tồn kho bán: {quantity}</h2>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-[12px]">
        <TextField
          label="Nhập (+) hoặc xuất (−)"
          name="delta"
          inputMode="numeric"
          placeholder="+10 hoặc -2"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
        />
        <Button type="submit" variant="ghost" disabled={pending}>
          Cập nhật
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-[14px] text-ember">
          {error}
        </p>
      )}
    </section>
  );
}

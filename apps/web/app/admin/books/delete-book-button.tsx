'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';

export function DeleteBookButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!window.confirm('Xóa sách này? Tồn kho bán và các bản cho mượn cũng bị xóa.')) return;
    setPending(true);
    setError(null);
    try {
      await apiClient(`/admin/books/${bookId}`, { method: 'DELETE' });
      router.push('/admin/books');
      router.refresh();
    } catch (e) {
      setError(messageFor(e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <Button type="button" variant="ghost" onClick={remove} disabled={pending} className="self-start">
        Xóa sách
      </Button>
      {error && (
        <p role="alert" className="text-[14px] text-ember">
          {error}
        </p>
      )}
    </div>
  );
}

'use client';

import type { AddressDto } from '@open-boox/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AddressForm } from '@/components/addresses/address-form';
import { AddressLines } from '@/components/addresses/address-lines';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';

export function AddressManager({ addresses }: { addresses: AddressDto[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(addresses.length === 0 ? 'new' : null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function saved() {
    setEditing(null);
    router.refresh();
  }

  async function act(id: string, run: () => Promise<unknown>) {
    setPendingId(id);
    setError(null);
    try {
      await run();
      router.refresh();
    } catch (e) {
      setError(messageFor(e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-[24px]">
      {addresses.length === 0 && <p className="text-[16px]">Bạn chưa có địa chỉ nào.</p>}
      <ul className="flex flex-col gap-[18px]">
        {addresses.map((address) => (
          <li key={address.id} className="rounded-[12px] border border-dashed border-cork-border p-[24px]">
            {editing === address.id ? (
              <AddressForm address={address} onSaved={saved} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex flex-col gap-[12px]">
                <AddressLines address={address} />
                {address.isDefault && <p className="text-[12px] font-medium uppercase">Mặc định</p>}
                <div className="flex flex-wrap gap-[12px]">
                  <Button variant="ghost" onClick={() => setEditing(address.id)}>
                    Sửa
                  </Button>
                  {!address.isDefault && (
                    <Button
                      variant="ghost"
                      disabled={pendingId === address.id}
                      onClick={() => act(address.id, () => apiClient(`/addresses/${address.id}/default`, { method: 'POST' }))}
                    >
                      Đặt mặc định
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    disabled={pendingId === address.id}
                    onClick={() => {
                      if (window.confirm('Xóa địa chỉ này? Các đơn đã đặt vẫn giữ địa chỉ cũ.')) {
                        void act(address.id, () => apiClient(`/addresses/${address.id}`, { method: 'DELETE' }));
                      }
                    }}
                  >
                    Xóa
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {error}
        </p>
      )}
      {editing === 'new' ? (
        <section className="flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]">
          <h2 className="text-[18px] font-medium uppercase">Địa chỉ mới</h2>
          <AddressForm onSaved={saved} onCancel={addresses.length > 0 ? () => setEditing(null) : undefined} />
        </section>
      ) : (
        <Button className="self-start" onClick={() => setEditing('new')}>
          Thêm địa chỉ
        </Button>
      )}
    </div>
  );
}

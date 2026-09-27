'use client';

import {
  type AdminShipmentDetail,
  NEXT_SHIPMENT_STATUSES,
  SHIPMENT_NOTE_MAX,
  type ShipmentStatus,
} from '@open-boox/shared';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';
import { SHIPMENT_STATUS_LABEL } from '@/lib/shipments/labels';

export function ShipmentActions({ shipment }: { shipment: AdminShipmentDetail }) {
  const router = useRouter();
  const next = NEXT_SHIPMENT_STATUSES[shipment.status];
  const [status, setStatus] = useState<ShipmentStatus | ''>(next[0] ?? '');
  // router.refresh() keeps this component mounted, so a choice made for the previous status may no longer be
  // offered; fall back to the first valid option instead of resending a stale (no-op) status.
  const selected = status && next.includes(status) ? status : (next[0] ?? '');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A 409 means another admin changed it first: show why, then reload the real state.
  function fail(e: unknown) {
    setError(messageFor(e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
    router.refresh();
  }

  async function update(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      await apiClient(`/admin/shipments/${shipment.id}`, { method: 'PATCH', body: { status: selected, note } });
      setNote('');
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setPending(false);
    }
  }

  async function retry() {
    setPending(true);
    setError(null);
    try {
      const created = await apiClient<AdminShipmentDetail>(`/admin/shipments/${shipment.id}/retry`, { method: 'POST' });
      router.push(`/admin/shipments/${created.id}`);
    } catch (e) {
      fail(e);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {next.length > 0 && (
        <form onSubmit={update} className="flex max-w-md flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <label htmlFor="status" className="text-[12px] font-medium uppercase">
              Trạng thái mới
            </label>
            <select
              id="status"
              value={selected}
              onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
              className="rounded-none border-0 border-b border-warm-cream bg-transparent px-0.5 py-1 text-[16px] outline-none focus:border-ember-accent"
            >
              {next.map((s) => (
                <option key={s} value={s} className="bg-bark-brown">
                  {SHIPMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="note" className="text-[12px] font-medium uppercase">
              Ghi chú
            </label>
            <textarea
              id="note"
              value={note}
              maxLength={SHIPMENT_NOTE_MAX}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-none border-0 border-b border-warm-cream bg-transparent px-0.5 py-1 text-[16px] outline-none focus:border-ember-accent"
            />
            <p className="text-[12px]">Khách hàng sẽ thấy ghi chú này.</p>
          </div>
          <Button type="submit" disabled={pending} className="self-start">
            Cập nhật
          </Button>
        </form>
      )}
      {shipment.status === 'FAILED' && !shipment.retriedById && (
        <Button variant="ghost" disabled={pending} onClick={retry} className="self-start">
          Tạo lần giao mới
        </Button>
      )}
      {error && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {error}
        </p>
      )}
    </div>
  );
}

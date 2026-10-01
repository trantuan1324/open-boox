import type { ShipmentEventDto } from '@open-boox/shared';
import { formatDateTime } from '@/lib/format';
import { SHIPMENT_STATUS_LABEL } from '@/lib/shipments/labels';

// Notes are written by admins and shown to customers as plain text (React escapes them).
export function ShipmentEvents({ events }: { events: ShipmentEventDto[] }) {
  return (
    <ol className="flex flex-col gap-[8px] border-l border-ink pl-[14px]">
      {events.map((event, i) => (
        <li key={i} className="flex flex-col gap-[2px] text-[14px]">
          <span>
            <span className={`font-bold uppercase ${event.status === 'FAILED' ? 'text-ember' : ''}`}>
              {SHIPMENT_STATUS_LABEL[event.status]}
            </span>{' '}
            · {formatDateTime(event.createdAt)}
          </span>
          {event.note && <span className="whitespace-pre-line">{event.note}</span>}
        </li>
      ))}
    </ol>
  );
}

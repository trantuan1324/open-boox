import type { ShipmentDto } from '@open-boox/shared';
import Link from 'next/link';
import { deliveryAttempts } from '@/lib/shipments/attempts';
import { SHIPMENT_STATUS_LABEL } from '@/lib/shipments/labels';
import { ShipmentEvents } from './shipment-events';

export function DeliveryAttempts({ shipments, linkToAdmin = false }: { shipments: ShipmentDto[]; linkToAdmin?: boolean }) {
  return (
    <div className="flex flex-col gap-[24px]">
      {deliveryAttempts(shipments).map(({ number, shipment }) => (
        <div key={shipment.id} className="flex flex-col gap-[8px]">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.03em]">
            Lần giao {number} ·{' '}
            <span className={shipment.status === 'FAILED' ? 'text-ember' : ''}>
              {SHIPMENT_STATUS_LABEL[shipment.status]}
            </span>
            {linkToAdmin && (
              <>
                {' '}
                ·{' '}
                <Link href={`/admin/shipments/${shipment.id}`} className="underline">
                  Xử lý
                </Link>
              </>
            )}
          </h3>
          <ShipmentEvents events={shipment.events} />
        </div>
      ))}
    </div>
  );
}

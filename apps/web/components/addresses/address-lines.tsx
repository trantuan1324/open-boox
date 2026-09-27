import type { AddressSnapshot } from '@open-boox/shared';

export function AddressLines({ address }: { address: AddressSnapshot }) {
  return (
    <div className="flex flex-col gap-[4px] text-[16px]">
      <p className="font-medium">
        {address.recipientName} · {address.phone}
      </p>
      <p>
        {address.line}, {address.ward}, {address.city}
      </p>
    </div>
  );
}

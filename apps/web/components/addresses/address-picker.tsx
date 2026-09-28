'use client';

import type { AddressDto } from '@open-boox/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AddressForm } from './address-form';
import { AddressLines } from './address-lines';

export function defaultAddressId(addresses: AddressDto[]): string | null {
  return (addresses.find((a) => a.isDefault) ?? addresses[0])?.id ?? null;
}

// Radio list of the user's addresses plus an inline "add" form (open at once when there is none). Used by
// checkout, borrow confirm and returns.
export function AddressPicker({
  addresses,
  value,
  onChange,
  name = 'address',
}: {
  addresses: AddressDto[];
  value: string | null;
  onChange: (id: string) => void;
  name?: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(addresses.length === 0);
  return (
    <>
      {addresses.length > 0 && (
        <fieldset className="flex flex-col gap-[12px]">
          <legend className="sr-only">Chọn địa chỉ</legend>
          {addresses.map((address) => (
            <label key={address.id} className="flex items-start gap-[12px]">
              <input
                type="radio"
                name={name}
                className="mt-[6px]"
                checked={address.id === value}
                onChange={() => onChange(address.id)}
              />
              <AddressLines address={address} />
            </label>
          ))}
        </fieldset>
      )}
      {adding ? (
        <AddressForm
          onSaved={(saved) => {
            onChange(saved.id);
            setAdding(false);
            router.refresh();
          }}
          onCancel={addresses.length > 0 ? () => setAdding(false) : undefined}
        />
      ) : (
        <Button variant="ghost" className="self-start" onClick={() => setAdding(true)}>
          Thêm địa chỉ khác
        </Button>
      )}
    </>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AddressDto,
  type AddressInput,
  addressInputSchema,
  PROVINCES,
  type Province,
  shippingFeeFor,
} from '@open-boox/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { apiClient } from '@/lib/api/client';
import { applyApiError } from '@/lib/errors/form';
import { formatVnd } from '@/lib/format';

const isProvince = (value: unknown): value is Province => (PROVINCES as readonly unknown[]).includes(value);

export function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address?: AddressDto;
  onSaved: (saved: AddressDto) => void;
  onCancel?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof addressInputSchema>, unknown, AddressInput>({
    resolver: zodResolver(addressInputSchema),
    defaultValues: address && {
      recipientName: address.recipientName,
      phone: address.phone,
      line: address.line,
      ward: address.ward,
      city: address.city,
    },
  });
  const city = watch('city');

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = address
        ? await apiClient<AddressDto>(`/addresses/${address.id}`, { method: 'PATCH', body: values })
        : await apiClient<AddressDto>('/addresses', { method: 'POST', body: values });
      onSaved(saved);
    } catch (error) {
      applyApiError(error, setError, setFormError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[24px]">
      <TextField label="Người nhận" autoComplete="name" {...register('recipientName')} error={errors.recipientName?.message} />
      <TextField label="Điện thoại" type="tel" autoComplete="tel" {...register('phone')} error={errors.phone?.message} />
      <TextField label="Số nhà, đường" autoComplete="address-line1" {...register('line')} error={errors.line?.message} />
      <TextField label="Phường/Xã" {...register('ward')} error={errors.ward?.message} />
      <SelectField
        label="Tỉnh/Thành phố"
        options={PROVINCES}
        placeholder="Chọn tỉnh/thành"
        {...register('city')}
        error={errors.city?.message}
      />
      {isProvince(city) && <p className="text-[14px]">Phí giao hàng: {formatVnd(shippingFeeFor(city))}</p>}
      {formError && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap gap-[12px]">
        <Button type="submit" disabled={isSubmitting}>
          Lưu địa chỉ
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  );
}

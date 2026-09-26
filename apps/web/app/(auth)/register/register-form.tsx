'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiClient } from '@/lib/api/client';
import { applyApiError } from '@/lib/errors/form';

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof registerSchema>, unknown, RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiClient('/auth/register', { method: 'POST', body: values });
      router.replace(next);
      router.refresh();
    } catch (error) {
      applyApiError(error, setError, setFormError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <TextField label="Họ tên" autoComplete="name" {...register('fullName')} error={errors.fullName?.message} />
      <TextField
        label="Số điện thoại"
        type="tel"
        autoComplete="tel"
        {...register('phone')}
        error={errors.phone?.message}
      />
      <TextField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
      <TextField
        label="Mật khẩu"
        type="password"
        autoComplete="new-password"
        {...register('password')}
        error={errors.password?.message}
      />
      {formError && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        Tạo tài khoản
      </Button>
      <p className="text-[14px]">
        Đã có tài khoản?{' '}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium uppercase underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

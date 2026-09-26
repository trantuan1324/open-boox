'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiClient } from '@/lib/api/client';
import { applyApiError } from '@/lib/errors/form';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiClient('/auth/login', { method: 'POST', body: values });
      router.replace(next);
      router.refresh();
    } catch (error) {
      applyApiError(error, setError, setFormError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <TextField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
      <TextField
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        {...register('password')}
        error={errors.password?.message}
      />
      {formError && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        Đăng nhập
      </Button>
      <p className="text-[14px]">
        Chưa có tài khoản?{' '}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-medium uppercase underline">
          Đăng ký
        </Link>
      </p>
    </form>
  );
}

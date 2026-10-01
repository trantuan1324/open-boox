'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type AdminBookDetail, type BookInput, bookInputSchema, type CategoryDto } from '@open-boox/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiClient } from '@/lib/api/client';
import { applyApiError } from '@/lib/errors/form';

const LABEL = 'text-[12px] font-bold uppercase tracking-[0.03em]';
const FIELD = 'rounded-[16px] border border-ink bg-paper px-[16px] py-[12px] text-[16px]';
const ERROR = 'text-[12px] text-ember';

export function BookForm({ categories, book }: { categories: CategoryDto[]; book?: AdminBookDetail }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof bookInputSchema>, unknown, BookInput>({
    resolver: zodResolver(bookInputSchema),
    defaultValues: {
      title: book?.title ?? '',
      author: book?.author ?? '',
      isbn: book?.isbn ?? '',
      description: book?.description ?? '',
      coverUrl: book?.coverUrl ?? '',
      categoryId: book?.categoryId ?? '',
      salePrice: book?.salePrice ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    try {
      if (book) {
        await apiClient(`/admin/books/${book.id}`, { method: 'PATCH', body: values });
        setSaved(true);
        router.refresh();
      } else {
        const created = await apiClient<AdminBookDetail>('/admin/books', { method: 'POST', body: values });
        router.push(`/admin/books/${created.id}`);
      }
    } catch (error) {
      applyApiError(error, setError, setFormError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-[24px]">
      <TextField label="Tên sách" {...register('title')} error={errors.title?.message} />
      <TextField label="Tác giả" {...register('author')} error={errors.author?.message} />
      <TextField label="ISBN" {...register('isbn')} error={errors.isbn?.message} />
      <div className="flex flex-col gap-[8px]">
        <label htmlFor="categoryId" className={LABEL}>
          Thể loại
        </label>
        <select id="categoryId" {...register('categoryId')} aria-invalid={Boolean(errors.categoryId)} className={FIELD}>
          <option value="">Chọn thể loại</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && <p className={ERROR}>{errors.categoryId.message}</p>}
      </div>
      <TextField
        label="Giá bán (VND, để trống nếu không bán)"
        inputMode="numeric"
        {...register('salePrice')}
        error={errors.salePrice?.message}
      />
      <TextField label="Ảnh bìa (URL, không bắt buộc)" {...register('coverUrl')} error={errors.coverUrl?.message} />
      <div className="flex flex-col gap-[8px]">
        <label htmlFor="description" className={LABEL}>
          Mô tả
        </label>
        <textarea id="description" rows={5} {...register('description')} className={FIELD} />
        {errors.description && <p className={ERROR}>{errors.description.message}</p>}
      </div>
      {formError && (
        <p role="alert" className="text-[14px] text-ember">
          {formError}
        </p>
      )}
      {saved && <p className="text-[14px]">Đã lưu.</p>}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {book ? 'Lưu thay đổi' : 'Thêm sách'}
      </Button>
    </form>
  );
}

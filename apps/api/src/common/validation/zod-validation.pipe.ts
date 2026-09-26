import type { PipeTransform } from '@nestjs/common';
import type { z, ZodError, ZodType } from 'zod';
import { DomainError } from '../errors/domain-error';

export function toFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

export class ZodValidationPipe<T extends ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new DomainError('VALIDATION_ERROR', 'Invalid request body', toFieldErrors(result.error));
  }
}

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../api/error';
import { messageFor } from './messages';

export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  setFormError: (message: string) => void,
): void {
  if (error instanceof ApiError && error.fields && Object.keys(error.fields).length > 0) {
    for (const [field, message] of Object.entries(error.fields)) setError(field as Path<T>, { message });
    return;
  }
  setFormError(messageFor(error instanceof ApiError ? error.code : 'INTERNAL_ERROR'));
}

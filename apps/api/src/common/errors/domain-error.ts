import type { ErrorCode } from '@open-boox/shared';
import { ERROR_STATUS } from './error-status';

// Business errors must be thrown as DomainError, never as Nest's HttpException:
// statuses missing from HTTP_CODES in to-error-body.ts turn into 500 INTERNAL_ERROR.
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

import type { ErrorCode } from '@open-boox/shared';
import { ERROR_STATUS } from './error-status';

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

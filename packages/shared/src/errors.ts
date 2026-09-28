export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'LOAN_LIMIT_EXCEEDED',
  'OUT_OF_STOCK',
  'NO_COPY_AVAILABLE',
  'SUBSCRIPTION_INACTIVE',
  'SUBSCRIPTION_ALREADY_EXISTS',
  'ORDER_NOT_CANCELLABLE',
  'INVALID_SHIPMENT_TRANSITION',
  'SHIPMENT_ALREADY_RETRIED',
  'LOAN_NOT_RETURNABLE',
  'LOAN_NOT_CANCELLABLE',
  'INVALID_COPY_STATE',
  'DUPLICATE',
  'IN_USE',
  'UNSUPPORTED_MEDIA_TYPE',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

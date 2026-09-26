import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody, ErrorCode } from '@open-boox/shared';
import { DomainError } from './domain-error';
import { ERROR_STATUS } from './error-status';

const PRISMA_CODES: Record<string, ErrorCode> = {
  P2002: 'DUPLICATE',
  P2003: 'IN_USE',
  P2025: 'NOT_FOUND',
};

const HTTP_CODES: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  415: 'UNSUPPORTED_MEDIA_TYPE',
};

const INTERNAL: ApiErrorBody = { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };

export function toErrorBody(exception: unknown): ApiErrorBody {
  if (exception instanceof DomainError) {
    const body: ApiErrorBody = { statusCode: exception.status, code: exception.code, message: exception.message };
    if (exception.fields) body.fields = exception.fields;
    return body;
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const code = PRISMA_CODES[exception.code];
    return code ? { statusCode: ERROR_STATUS[code], code, message: code } : INTERNAL;
  }
  if (exception instanceof HttpException) {
    const code = HTTP_CODES[exception.getStatus()];
    return code ? { statusCode: exception.getStatus(), code, message: exception.message } : INTERNAL;
  }
  return INTERNAL;
}

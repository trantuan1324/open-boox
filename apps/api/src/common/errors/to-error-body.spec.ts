import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from './domain-error';
import { toErrorBody } from './to-error-body';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });

describe('toErrorBody', () => {
  it('maps a DomainError using ERROR_STATUS and keeps fields', () => {
    expect(toErrorBody(new DomainError('VALIDATION_ERROR', 'bad', { email: 'Email không hợp lệ' }))).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'bad',
      fields: { email: 'Email không hợp lệ' },
    });
  });

  it('maps business conflicts to 409', () => {
    expect(toErrorBody(new DomainError('OUT_OF_STOCK')).statusCode).toBe(409);
    expect(toErrorBody(new DomainError('INVALID_SHIPMENT_TRANSITION')).statusCode).toBe(409);
  });

  it.each([
    ['P2002', 409, 'DUPLICATE'],
    ['P2003', 409, 'IN_USE'],
    ['P2025', 404, 'NOT_FOUND'],
  ])('maps Prisma %s to %i %s', (code, status, errorCode) => {
    expect(toErrorBody(prismaError(code))).toMatchObject({ statusCode: status, code: errorCode });
  });

  it('maps an unknown Prisma error code to 500', () => {
    expect(toErrorBody(prismaError('P1001'))).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });

  it('maps Nest HttpExceptions by status', () => {
    expect(toErrorBody(new ForbiddenException())).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(toErrorBody(new NotFoundException())).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('maps HTTP 429 to TOO_MANY_REQUESTS', () => {
    expect(toErrorBody(new HttpException('Too Many Requests', 429))).toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('hides the message of unexpected errors', () => {
    expect(toErrorBody(new Error('secret internals'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});

import { Logger } from '@nestjs/common';
import type { ApiErrorBody } from '@open-boox/shared';
import type { NextFunction, Request, Response } from 'express';
import { toErrorBody } from '../errors/to-error-body';

const logger = new Logger('Exceptions');

function isBodyParserError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof (err as { type: unknown }).type === 'string' &&
    (err as { type: string }).type.startsWith('entity.')
  );
}

// Express error middleware: runs for errors thrown by json() before Nest's router is reached.
export function bodyParseErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isBodyParserError(err)) {
    const body: ApiErrorBody = { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Malformed JSON body' };
    res.status(400).json(body);
    return;
  }
  const body = toErrorBody(err);
  if (body.statusCode >= 500) logger.error(err instanceof Error ? err.stack : String(err));
  res.status(body.statusCode).json(body);
}

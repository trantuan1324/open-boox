import type { ApiErrorBody } from '@open-boox/shared';
import type { NextFunction, Request, Response } from 'express';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function jsonOnly(req: Request, res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method)) return next();
  const mediaType = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (mediaType === 'application/json') return next();
  const body: ApiErrorBody = {
    statusCode: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Content-Type must be application/json',
  };
  res.status(415).json(body);
}

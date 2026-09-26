import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { bodyParseErrorHandler } from './common/http/body-parse-error.handler';
import { jsonOnly } from './common/http/json-only.middleware';

export function configureApp(app: NestExpressApplication): void {
  // Behind Next's rewrite (and a real reverse proxy in production) the socket peer is loopback;
  // trust only loopback so req.ip is the nearest untrusted address in X-Forwarded-For. See spec §5.
  app.set('trust proxy', 'loopback');
  app.setGlobalPrefix('api');
  app.use(jsonOnly);
  app.use(json({ limit: '100kb' }));
  app.use(bodyParseErrorHandler);
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
}

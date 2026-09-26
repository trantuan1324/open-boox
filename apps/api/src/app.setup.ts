import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json } from 'express';

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.use(json({ limit: '100kb' }));
  app.use(cookieParser());
}

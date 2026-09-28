import { Global, Module } from '@nestjs/common';
import { RevalidationService } from './revalidation.service';

// Global: every module that writes sale stock or copies calls it. Reads process.env directly, like
// app.module, so the parsed env is not cached before test setup runs.
@Global()
@Module({
  providers: [
    {
      provide: RevalidationService,
      useFactory: () =>
        new RevalidationService({ webUrl: process.env.WEB_INTERNAL_URL, secret: process.env.REVALIDATE_SECRET }),
    },
  ],
  exports: [RevalidationService],
})
export class RevalidationModule {}

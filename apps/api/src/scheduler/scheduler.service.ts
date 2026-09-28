import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { TokensService } from '../auth/tokens.service';
import { PaymentsService, STALE_PAYMENT_MS } from '../payments/payments.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Clock } from './clock';

const FIVE_MINUTES = 5 * 60_000;

// Jobs only call functions exported by the module that owns the table (spec §4.7).
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly tokens: TokensService,
    private readonly subscriptions: SubscriptionsService,
    private readonly revalidation: RevalidationService,
    private readonly clock: Clock,
  ) {}

  // Timer entry points: no arguments, and never reject — an unhandled rejection from a timer would
  // crash the process.
  @Interval(FIVE_MINUTES)
  async runFailStalePayments(): Promise<void> {
    await this.failStalePayments(this.clock.now()).catch((error: unknown) => this.logFailure('failStalePayments', error));
  }

  @Cron('0 3 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runCleanupRefreshTokens(): Promise<void> {
    await this.cleanupRefreshTokens(this.clock.now()).catch((error: unknown) =>
      this.logFailure('cleanupRefreshTokens', error),
    );
  }

  // Hourly so a due subscription waits at most an hour for its renewal (spec §4.7).
  @Cron('0 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runRenewSubscriptions(): Promise<void> {
    await this.renewSubscriptions(this.clock.now()).catch((error: unknown) => this.logFailure('renewSubscriptions', error));
  }

  // Only settles; cancelling orders and returning stock is onFailed's job. One failing payment does not
  // hold back the others. Revalidates only when something was settled, not every 5 minutes (spec §4.9).
  async failStalePayments(now: Date): Promise<void> {
    const ids = await this.payments.findStalePendingIds(new Date(now.getTime() - STALE_PAYMENT_MS));
    for (const id of ids) {
      await this.payments.settle(id, 'FAILED').catch((error: unknown) => this.logFailure(`failStalePayments ${id}`, error));
    }
    if (ids.length > 0) void this.revalidation.catalogChanged();
  }

  renewSubscriptions(now: Date): Promise<void> {
    return this.subscriptions.renewDue(now);
  }

  async cleanupRefreshTokens(now: Date): Promise<number> {
    const count = await this.tokens.purgeRefreshTokens(now);
    this.logger.log(`cleanupRefreshTokens removed ${count} tokens`);
    return count;
  }

  private logFailure(job: string, error: unknown): void {
    this.logger.error(`${job} failed`, error instanceof Error ? error.stack : String(error));
  }
}

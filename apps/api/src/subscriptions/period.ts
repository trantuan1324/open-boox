import { SUBSCRIPTION_PERIOD_DAYS } from '@open-boox/shared';

const DAY_MS = 24 * 60 * 60_000;

// A period is a fixed 30 days from its start (spec §4.2); a renewal starts where the previous period ended.
export function periodEnd(start: Date): Date {
  return new Date(start.getTime() + SUBSCRIPTION_PERIOD_DAYS * DAY_MS);
}

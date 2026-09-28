import { Logger } from '@nestjs/common';

export interface RevalidationConfig {
  webUrl?: string;
  secret?: string;
}

const TIMEOUT_MS = 2000;

// spec §4.9: after a committed write that changes sale stock or loanable copies, ask the web app to drop its
// cached catalog. Fire-and-forget — callers `void` the promise, and it never rejects: a failed call only
// leaves the 60-second TTL as the safety net. Without config (tests) it does nothing.
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly config: RevalidationConfig) {}

  async catalogChanged(): Promise<void> {
    const { webUrl, secret } = this.config;
    if (!webUrl || !secret) return;
    try {
      const res = await fetch(`${webUrl}/internal/revalidate`, {
        method: 'POST',
        headers: { 'x-revalidate-secret': secret },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) this.logger.warn(`catalog revalidation answered ${res.status}`);
    } catch (error) {
      this.logger.warn(`catalog revalidation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

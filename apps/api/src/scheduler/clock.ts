import { Injectable } from '@nestjs/common';

// Jobs read "now" from here; tests call the job methods directly with a fake time instead (spec §4.7).
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}

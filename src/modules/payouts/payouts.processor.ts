import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PayoutsService, PAYOUTS_QUEUE } from './payouts.service';

interface ProcessPayoutJob {
  payoutId: string;
}

/**
 * BullMQ worker that processes queued payouts. Each job calls
 * `PayoutsService.processPayout` which:
 *   1. Locks the payout row
 *   2. Calls the Paystack transfer API
 *   3. Marks the payout as `processing`, then `success` (immediate) or
 *      leaves it for the webhook to settle.
 *
 * Retries are configured by the producer (3 attempts, exponential backoff).
 * Concurrency 1 keeps wallet writes serialised — payouts are not hot enough
 * to need more throughput.
 */
@Processor(PAYOUTS_QUEUE, { concurrency: 1 })
export class PayoutsProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutsProcessor.name);

  constructor(private readonly payouts: PayoutsService) {
    super();
  }

  async process(job: Job<ProcessPayoutJob>): Promise<void> {
    this.logger.log(`Processing payout ${job.data.payoutId}`);
    await this.payouts.processPayout(job.data.payoutId);
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis.config.js';

export const MUSEUM_QUEUE = 'museum-jobs';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue;

  async onModuleInit(): Promise<void> {
    this.queue = new Queue(MUSEUM_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });
    await this.queue.waitUntilReady();
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  async enqueue<T>(name: string, data: T): Promise<string> {
    const job = await this.queue.add(name, data);
    return job.id ?? String(job.timestamp);
  }

  async checkConnection(): Promise<void> {
    await this.queue.getJobCounts();
  }
}

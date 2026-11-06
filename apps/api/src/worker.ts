import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import { getRedisConnection } from './config/redis.config.js';
import { MUSEUM_QUEUE } from './queue/queue.service.js';

const logger = new Logger('MuseumWorker');
const worker = new Worker(
  MUSEUM_QUEUE,
  async (job) => {
    if (job.name !== 'system.ping') {
      throw new Error(`No worker is registered for job "${job.name}"`);
    }

    return { pong: new Date().toISOString() };
  },
  { connection: getRedisConnection() },
);

worker.on('completed', (job) => {
  logger.log(`Completed job ${job.id} (${job.name})`);
});
worker.on('failed', (job, error) => {
  logger.error(`Job ${job?.id ?? 'unknown'} failed: ${error.message}`);
});

await worker.waitUntilReady();
logger.log(`Listening to queue "${MUSEUM_QUEUE}"`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void worker
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error('Failed to shut down worker cleanly', error);
        process.exitCode = 1;
      });
  });
}

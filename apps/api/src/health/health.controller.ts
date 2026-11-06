import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { StorageService } from '../storage/storage.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    await Promise.all([
      this.prisma.$queryRaw`SELECT 1`,
      this.queue.checkConnection(),
      this.storage.checkConnection(),
    ]);

    return { status: 'ok' };
  }
}

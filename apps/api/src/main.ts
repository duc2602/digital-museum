import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

type CorrelatedExpressRequest = Request & { correlationId?: string };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((request: CorrelatedExpressRequest, response: Response, next: NextFunction) => {
    const supplied = request.header('x-correlation-id');
    const correlationId = supplied && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)
      ? supplied
      : randomUUID();
    request.correlationId = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);
    next();
  });
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

await bootstrap();

import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { NoStoreInterceptor } from '../common/no-store.interceptor.js';
import { ApiEnvelopeInterceptor } from '../common/api-envelope.interceptor.js';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, NoStoreInterceptor, ApiEnvelopeInterceptor],
})
export class CatalogModule {}

import { Module } from '@nestjs/common';
import { ArtifactController } from './artifact.controller.js';
import { ArtifactService } from './artifact.service.js';
import { ApiEnvelopeInterceptor } from '../common/api-envelope.interceptor.js';
import { NoStoreInterceptor } from '../common/no-store.interceptor.js';

@Module({
  controllers: [ArtifactController],
  providers: [ArtifactService, NoStoreInterceptor, ApiEnvelopeInterceptor],
})
export class ArtifactModule {}

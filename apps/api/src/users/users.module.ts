import { Module } from '@nestjs/common';
import { ApiEnvelopeInterceptor } from '../common/api-envelope.interceptor.js';
import { NoStoreInterceptor } from '../common/no-store.interceptor.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ApiEnvelopeInterceptor, NoStoreInterceptor],
})
export class UsersModule {}

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PermissionsGuard } from './permissions.guard.js';
import { SessionGuard } from './session.guard.js';
import { NoStoreInterceptor } from '../common/no-store.interceptor.js';
import { ApiEnvelopeInterceptor } from '../common/api-envelope.interceptor.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionGuard,
    PermissionsGuard,
    NoStoreInterceptor,
    ApiEnvelopeInterceptor,
  ],
  exports: [AuthService, SessionGuard, PermissionsGuard],
})
export class AuthModule {}

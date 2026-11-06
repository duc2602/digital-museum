import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthPrincipal } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { SessionGuard } from './session.guard.js';
import { asRequestBody, assertAllowedKeys } from '../common/request-validation.js';
import { NoStoreInterceptor } from '../common/no-store.interceptor.js';
import { ApiEnvelopeInterceptor } from '../common/api-envelope.interceptor.js';

@Controller('auth')
@UseInterceptors(ApiEnvelopeInterceptor, NoStoreInterceptor)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() bodyValue: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Omit<AuthPrincipal, 'sessionId'>> {
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['email', 'password']);
    const result = await this.auth.login(body.email, body.password);
    response.setHeader('Set-Cookie', result.cookie);
    return result.principal;
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthPrincipal): Omit<AuthPrincipal, 'sessionId'> {
    const { sessionId: _sessionId, ...principal } = user;
    return principal;
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    response.setHeader('Set-Cookie', await this.auth.logout(user));
  }
}

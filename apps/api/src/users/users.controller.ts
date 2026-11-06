import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { SessionGuard } from '../auth/session.guard.js';
import { ApiEnvelopeInterceptor } from '../common/api-envelope.interceptor.js';
import { NoStoreInterceptor } from '../common/no-store.interceptor.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(SessionGuard, PermissionsGuard)
@UseInterceptors(ApiEnvelopeInterceptor, NoStoreInterceptor)
@RequirePermissions('user:manage')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get('roles')
  listRoles(@CurrentUser() actor: AuthPrincipal) {
    return this.users.listAssignableRoles(actor);
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() actor: AuthPrincipal) {
    return this.users.create(body, actor);
  }

  @Patch(':userId')
  update(
    @Param('userId') userId: string,
    @Body() body: unknown,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.users.update(userId, body, actor);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { ArtifactService } from './artifact.service.js';
import { NoStoreInterceptor } from '../common/no-store.interceptor.js';
import { ApiEnvelopeInterceptor } from '../common/api-envelope.interceptor.js';
import {
  asRequestBody,
  assertAllowedKeys,
  optionalString,
} from '../common/request-validation.js';

@Controller('artifacts')
@UseGuards(SessionGuard, PermissionsGuard)
@UseInterceptors(ApiEnvelopeInterceptor, NoStoreInterceptor)
export class ArtifactController {
  constructor(private readonly artifacts: ArtifactService) {}

  @Get()
  @RequirePermissions('artifact:read')
  list(@Query() queryValue: unknown) {
    const query = asRequestBody(queryValue);
    assertAllowedKeys(query, ['search', 'limit', 'offset']);
    const search = optionalString(query, 'search', 100);
    const limit = optionalString(query, 'limit', 3);
    const offset = optionalString(query, 'offset', 10);
    return this.artifacts.list({ search, limit, offset });
  }

  @Get(':artifactId')
  @RequirePermissions('artifact:read')
  findOne(@Param('artifactId') artifactId: string) {
    return this.artifacts.findOne(artifactId);
  }

  @Post()
  @RequirePermissions('artifact:write')
  create(
    @Body() body: unknown,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.artifacts.create(body, user.id);
  }

  @Patch(':artifactId')
  @RequirePermissions('artifact:write')
  update(
    @Param('artifactId') artifactId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.artifacts.update(artifactId, body, user.id);
  }

  @Delete(':artifactId')
  @RequirePermissions('artifact:write')
  archive(
    @Param('artifactId') artifactId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.artifacts.archive(artifactId, body, user.id);
  }
}

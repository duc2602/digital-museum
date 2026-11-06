import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { CatalogService } from './catalog.service.js';
import { NoStoreInterceptor } from '../common/no-store.interceptor.js';
import { ApiEnvelopeInterceptor } from '../common/api-envelope.interceptor.js';

@Controller()
@UseGuards(SessionGuard, PermissionsGuard)
@UseInterceptors(ApiEnvelopeInterceptor, NoStoreInterceptor)
export class CatalogController {
  constructor(private readonly catalogs: CatalogService) {}

  @Get('catalogs')
  @RequirePermissions('catalog:read')
  listCatalogs() {
    return this.catalogs.listCatalogs();
  }

  @Post('catalogs')
  @RequirePermissions('catalog:write')
  createCatalog(
    @Body() body: unknown,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.catalogs.createCatalog(body, user.id);
  }

  @Get('catalogs/:catalogId/terms')
  @RequirePermissions('catalog:read')
  listTerms(@Param('catalogId') catalogId: string) {
    return this.catalogs.listTerms(catalogId);
  }

  @Post('catalogs/:catalogId/terms')
  @RequirePermissions('catalog:write')
  createTerm(
    @Param('catalogId') catalogId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.catalogs.createTerm(catalogId, body, user.id);
  }

  @Patch('terms/:termId')
  @RequirePermissions('catalog:write')
  updateTerm(
    @Param('termId') termId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.catalogs.updateTerm(termId, body, user.id);
  }

  @Delete('terms/:termId')
  @RequirePermissions('catalog:write')
  archiveTerm(
    @Param('termId') termId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.catalogs.archiveTerm(termId, body, user.id);
  }
}

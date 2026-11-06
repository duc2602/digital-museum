import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import {
  asRequestBody,
  assertAllowedKeys,
  optionalString,
  optionalUuid,
  requiredString,
  requiredUuid,
  requiredVersion,
} from '../common/request-validation.js';

const LOCALE = 'vi';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCatalogs() {
    return this.prisma.catalog.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: { _count: { select: { terms: true } } },
    });
  }

  async createCatalog(bodyValue: unknown, actorId: string) {
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['code', 'name']);
    const code = requiredString(body, 'code', 2, 50).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
      throw new BadRequestException('code may contain only letters, numbers, _ and -');
    }
    const name = requiredString(body, 'name', 1, 120);

    return this.prisma.$transaction(async (tx) => {
      const catalog = await tx.catalog.create({ data: { code, name } });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CATALOG_CREATED',
          resourceType: 'CATALOG',
          resourceId: catalog.id,
        },
      });
      return catalog;
    });
  }

  async listTerms(catalogIdInput: string) {
    const catalogId = requiredUuid(catalogIdInput, 'catalogId');
    const catalog = await this.prisma.catalog.findFirst({
      where: { id: catalogId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!catalog) throw new NotFoundException('Catalog not found');

    return this.prisma.term.findMany({
      where: { catalogId, deletedAt: null },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      include: {
        translations: { where: { locale: LOCALE } },
        _count: { select: { children: true, artifactLinks: true } },
      },
    });
  }

  async createTerm(catalogIdInput: string, bodyValue: unknown, actorId: string) {
    const catalogId = requiredUuid(catalogIdInput, 'catalogId');
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['code', 'label', 'description', 'parentId']);
    const code = requiredString(body, 'code', 1, 100);
    const label = requiredString(body, 'label', 1, 200);
    const description = optionalString(body, 'description', 2000) ?? null;
    const parentId = optionalUuid(body, 'parentId') ?? null;

    return this.prisma.$transaction(async (tx) => {
      await this.lockCatalog(tx, catalogId);
      const catalog = await tx.catalog.findFirst({
        where: { id: catalogId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!catalog) throw new NotFoundException('Catalog not found');
      await this.validateParent(tx, catalogId, null, parentId);

      const term = await tx.term.create({
        data: {
          catalogId,
          code,
          parentId,
          createdBy: actorId,
          translations: {
            create: { locale: LOCALE, label, description },
          },
        },
        include: { translations: { where: { locale: LOCALE } } },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'TERM_CREATED',
          resourceType: 'TERM',
          resourceId: term.id,
        },
      });
      return term;
    });
  }

  async updateTerm(termIdInput: string, bodyValue: unknown, actorId: string) {
    const termId = requiredUuid(termIdInput, 'termId');
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['expectedVersion', 'code', 'label', 'description', 'parentId']);
    const expectedVersion = requiredVersion(body);
    const code = optionalString(body, 'code', 100);
    const label = optionalString(body, 'label', 200);
    const description = optionalString(body, 'description', 2000);
    const parentId = optionalUuid(body, 'parentId');
    if (
      code === undefined &&
      label === undefined &&
      description === undefined &&
      parentId === undefined
    ) {
      throw new BadRequestException('At least one field must be updated');
    }
    if (code !== undefined && code.length === 0) {
      throw new BadRequestException('code cannot be empty');
    }
    if (label !== undefined && label.length === 0) {
      throw new BadRequestException('label cannot be empty');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.term.findFirst({
        where: { id: termId, deletedAt: null },
        select: { id: true, catalogId: true },
      });
      if (!current) throw new NotFoundException('Term not found');
      await this.lockCatalog(tx, current.catalogId);
      await this.validateParent(tx, current.catalogId, termId, parentId);

      const changed = await tx.term.updateMany({
        where: { id: termId, version: expectedVersion, deletedAt: null },
        data: {
          ...(code !== undefined ? { code } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Term changed; reload and retry');
      }

      if (label !== undefined || description !== undefined) {
        const translation = await tx.termTranslation.findUnique({
          where: { termId_locale: { termId, locale: LOCALE } },
        });
        if (!translation && label === undefined) {
          throw new ConflictException(
            'A Vietnamese label is required when creating a translation',
          );
        }
        await tx.termTranslation.upsert({
          where: { termId_locale: { termId, locale: LOCALE } },
          create: {
            termId,
            locale: LOCALE,
            label: label ?? translation?.label ?? '',
            description: description ?? translation?.description ?? null,
          },
          update: {
            ...(label !== undefined ? { label } : {}),
            ...(description !== undefined ? { description } : {}),
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'TERM_UPDATED',
          resourceType: 'TERM',
          resourceId: termId,
        },
      });
      return tx.term.findUniqueOrThrow({
        where: { id: termId },
        include: { translations: { where: { locale: LOCALE } } },
      });
    });
  }

  async archiveTerm(termIdInput: string, bodyValue: unknown, actorId: string) {
    const termId = requiredUuid(termIdInput, 'termId');
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['expectedVersion']);
    const expectedVersion = requiredVersion(body);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.term.findFirst({
        where: { id: termId, deletedAt: null },
        select: { id: true, catalogId: true },
      });
      if (!current) throw new NotFoundException('Term not found');
      await this.lockCatalog(tx, current.catalogId);

      const [children, artifactLinks] = await Promise.all([
        tx.term.count({ where: { parentId: termId, deletedAt: null } }),
        tx.artifactTerm.count({ where: { termId } }),
      ]);
      if (children > 0 || artifactLinks > 0) {
        throw new ConflictException(
          'A term with child terms or linked artifacts cannot be archived',
        );
      }
      const changed = await tx.term.updateMany({
        where: { id: termId, version: expectedVersion, deletedAt: null },
        data: {
          deletedAt: new Date(),
          status: 'RETIRED',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Term changed; reload and retry');
      }
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'TERM_ARCHIVED',
          resourceType: 'TERM',
          resourceId: termId,
        },
      });
      return { id: termId, archived: true };
    });
  }

  private async validateParent(
    tx: Prisma.TransactionClient,
    catalogId: string,
    termId: string | null,
    parentId: string | null | undefined,
  ): Promise<void> {
    if (parentId === undefined || parentId === null) return;
    if (parentId === termId) throw new ConflictException('A term cannot parent itself');

    const parent = await tx.term.findFirst({
      where: { id: parentId, catalogId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new NotFoundException('Parent term not found in this catalog');

    let cursor: { id: string; parentId: string | null } | null = parent;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor.id === termId) {
        throw new ConflictException('The requested parent would create a term cycle');
      }
      if (visited.has(cursor.id)) {
        throw new ConflictException('Existing term hierarchy contains a cycle');
      }
      visited.add(cursor.id);
      if (!cursor.parentId) break;
      cursor = await tx.term.findFirst({
        where: { id: cursor.parentId, catalogId, deletedAt: null },
        select: { id: true, parentId: true },
      });
    }
  }

  private async lockCatalog(
    tx: Prisma.TransactionClient,
    catalogId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${catalogId}))`;
  }

}

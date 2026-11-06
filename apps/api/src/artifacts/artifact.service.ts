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
  optionalUuidArray,
  requiredString,
  requiredUuid,
  requiredVersion,
} from '../common/request-validation.js';

const LOCALE = 'vi';
const ARTIFACT_INCLUDE = {
  translations: { where: { locale: LOCALE } },
  terms: {
    include: {
      term: { include: { translations: { where: { locale: LOCALE } } } },
    },
  },
} satisfies Prisma.ArtifactInclude;

@Injectable()
export class ArtifactService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { search?: string; limit?: string; offset?: string }) {
    const search = query.search?.trim();
    const rawLimit = query.limit === undefined ? 25 : Number(query.limit);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      throw new BadRequestException('limit must be an integer between 1 and 100');
    }
    const offset = query.offset === undefined ? 0 : Number(query.offset);
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new BadRequestException('offset must be a non-negative integer');
    }
    if (search && search.length > 100) {
      throw new BadRequestException('search must not exceed 100 characters');
    }

    const rows = await this.prisma.artifact.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { accessionNumber: { contains: search, mode: 'insensitive' } },
                {
                  translations: {
                    some: {
                      locale: LOCALE,
                      OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        {
                          descriptionText: {
                            contains: search,
                            mode: 'insensitive',
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: rawLimit + 1,
      include: ARTIFACT_INCLUDE,
    });
    return { items: rows.slice(0, rawLimit), hasMore: rows.length > rawLimit };
  }

  async findOne(idInput: string) {
    const id = requiredUuid(idInput, 'artifactId');
    const artifact = await this.prisma.artifact.findFirst({
      where: { id, deletedAt: null },
      include: ARTIFACT_INCLUDE,
    });
    if (!artifact) throw new NotFoundException('Artifact not found');
    return artifact;
  }

  async create(bodyValue: unknown, actorId: string) {
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['accessionNumber', 'title', 'description', 'termIds']);
    const accessionNumber = requiredString(body, 'accessionNumber', 1, 100);
    const title = requiredString(body, 'title', 1, 300);
    const description = optionalString(body, 'description', 20_000) ?? '';
    const termIds = optionalUuidArray(body, 'termIds') ?? [];

    return this.prisma.$transaction(async (tx) => {
      await this.ensureTermsExist(tx, termIds);
      const artifact = await tx.artifact.create({
        data: {
          accessionNumber,
          createdBy: actorId,
          translations: {
            create: {
              locale: LOCALE,
              title,
              descriptionFormat: 'prosemirror_json',
              descriptionRich: makeProseMirrorDocument(description),
              descriptionText: description,
            },
          },
          terms: {
            create: termIds.map((termId) => ({
              termId,
              assignedBy: actorId,
            })),
          },
        },
        include: ARTIFACT_INCLUDE,
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'ARTIFACT_CREATED',
          resourceType: 'ARTIFACT',
          resourceId: artifact.id,
          redactedChanges: { accessionNumber },
        },
      });
      return artifact;
    });
  }

  async update(idInput: string, bodyValue: unknown, actorId: string) {
    const id = requiredUuid(idInput, 'artifactId');
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['expectedVersion', 'accessionNumber', 'title', 'description', 'termIds']);
    const expectedVersion = requiredVersion(body);
    const accessionNumber = optionalString(body, 'accessionNumber', 100);
    const title = optionalString(body, 'title', 300);
    const description = optionalString(body, 'description', 20_000);
    const termIds = optionalUuidArray(body, 'termIds');
    if (
      accessionNumber === undefined &&
      title === undefined &&
      description === undefined &&
      termIds === undefined
    ) {
      throw new BadRequestException('At least one field must be updated');
    }
    if (accessionNumber !== undefined && accessionNumber.length === 0) {
      throw new BadRequestException('accessionNumber cannot be empty');
    }
    if (title !== undefined && title.length === 0) {
      throw new BadRequestException('title cannot be empty');
    }

    return this.prisma.$transaction(async (tx) => {
      if (termIds !== undefined) await this.ensureTermsExist(tx, termIds);
      const changed = await tx.artifact.updateMany({
        where: { id, version: expectedVersion, deletedAt: null },
        data: {
          ...(accessionNumber !== undefined ? { accessionNumber } : {}),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const exists = await tx.artifact.count({ where: { id, deletedAt: null } });
        if (!exists) throw new NotFoundException('Artifact not found');
        throw new ConflictException('Artifact changed; reload and retry');
      }

      if (title !== undefined || description !== undefined) {
        const current = await tx.artifactTranslation.findUnique({
          where: { artifactId_locale: { artifactId: id, locale: LOCALE } },
        });
        if (!current && title === undefined) {
          throw new ConflictException(
            'A Vietnamese title is required when creating a translation',
          );
        }
        await tx.artifactTranslation.upsert({
          where: { artifactId_locale: { artifactId: id, locale: LOCALE } },
          create: {
            artifactId: id,
            locale: LOCALE,
            title: title ?? current?.title ?? '',
            descriptionFormat: 'prosemirror_json',
            descriptionRich: makeProseMirrorDocument(description ?? ''),
            descriptionText: description ?? '',
          },
          update: {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined
              ? {
                  descriptionRich: makeProseMirrorDocument(description),
                  descriptionText: description,
                }
              : {}),
          },
        });
      }

      if (termIds !== undefined) {
        await tx.artifactTerm.deleteMany({ where: { artifactId: id } });
        if (termIds.length > 0) {
          await tx.artifactTerm.createMany({
            data: termIds.map((termId) => ({
              artifactId: id,
              termId,
              assignedBy: actorId,
            })),
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'ARTIFACT_UPDATED',
          resourceType: 'ARTIFACT',
          resourceId: id,
          redactedChanges: {
            accessionNumberChanged: accessionNumber !== undefined,
            titleChanged: title !== undefined,
            descriptionChanged: description !== undefined,
            termsChanged: termIds !== undefined,
          },
        },
      });
      return tx.artifact.findUniqueOrThrow({
        where: { id },
        include: ARTIFACT_INCLUDE,
      });
    });
  }

  async archive(idInput: string, bodyValue: unknown, actorId: string) {
    const id = requiredUuid(idInput, 'artifactId');
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['expectedVersion']);
    const expectedVersion = requiredVersion(body);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.artifact.updateMany({
        where: { id, version: expectedVersion, deletedAt: null },
        data: {
          deletedAt: new Date(),
          status: 'ARCHIVED',
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const exists = await tx.artifact.count({ where: { id, deletedAt: null } });
        if (!exists) throw new NotFoundException('Artifact not found');
        throw new ConflictException('Artifact changed; reload and retry');
      }
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'ARTIFACT_ARCHIVED',
          resourceType: 'ARTIFACT',
          resourceId: id,
        },
      });
      return { id, archived: true };
    });
  }

  private async ensureTermsExist(
    tx: Prisma.TransactionClient,
    termIds: string[],
  ): Promise<void> {
    if (termIds.length === 0) return;
    const selectedTerms = await tx.term.findMany({
      where: { id: { in: termIds } },
      select: { catalogId: true },
    });
    const catalogIds = [...new Set(selectedTerms.map((term) => term.catalogId))]
      .sort();
    for (const catalogId of catalogIds) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${catalogId}))`;
    }
    const count = await tx.term.count({
      where: { id: { in: termIds }, status: 'ACTIVE', deletedAt: null },
    });
    if (count !== termIds.length) {
      throw new NotFoundException('One or more selected terms are unavailable');
    }
  }
}

function makeProseMirrorDocument(text: string): Prisma.InputJsonObject {
  return {
    type: 'doc',
    content: text.split(/\r?\n/).map((line) => ({
      type: 'paragraph',
      ...(line.length > 0
        ? { content: [{ type: 'text', text: line }] }
        : {}),
    })),
  };
}

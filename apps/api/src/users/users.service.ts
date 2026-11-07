import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { argon2id } from 'hash-wasm';
import { randomBytes } from 'node:crypto';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  asRequestBody,
  assertAllowedKeys,
  optionalUuidArray,
  requiredString,
  requiredUuid,
  requiredVersion,
} from '../common/request-validation.js';

const USER_INCLUDE = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} satisfies Prisma.UserInclude;
const PRIVILEGED_ROLE_PERMISSION = 'role:grant-manager';
const USER_MANAGEMENT_PERMISSION = 'user:manage';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal) {
    const canManagePrivilegedUsers = actor.permissions.includes(PRIVILEGED_ROLE_PERMISSION);
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(canManagePrivilegedUsers
          ? {}
          : {
              roles: {
                none: {
                  role: {
                    permissions: {
                      some: { permission: { code: USER_MANAGEMENT_PERMISSION } },
                    },
                  },
                },
              },
            }),
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      include: USER_INCLUDE,
    });
    return rows.map((user) => this.toAdminUser(user));
  }

  async listAssignableRoles(actor: AuthPrincipal) {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { permissions: { include: { permission: true } } },
    });
    const canGrantManager = actor.permissions.includes(PRIVILEGED_ROLE_PERMISSION);
    return roles
      .filter((role) => {
        const hasUserManagement = role.permissions.some(
          ({ permission }) => permission.code === USER_MANAGEMENT_PERMISSION,
        );
        return (
          (!hasUserManagement || canGrantManager) &&
          role.permissions.every(({ permission }) => actor.permissions.includes(permission.code))
        );
      })
      .map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        permissions: role.permissions.map(({ permission }) => permission.code).sort(),
      }));
  }

  async create(bodyValue: unknown, actor: AuthPrincipal) {
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['email', 'displayName', 'initialPassword', 'roleIds', 'reason']);
    const email = requiredString(body, 'email', 3, 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('email must be a valid email address');
    }
    const displayName = requiredString(body, 'displayName', 1, 120);
    const password = requiredString(body, 'initialPassword', 12, 1024);
    const reason = requiredString(body, 'reason', 3, 500);
    const roleIds = optionalUuidArray(body, 'roleIds');
    if (roleIds === undefined) throw new BadRequestException('roleIds is required');
    if (roleIds.length === 0) throw new BadRequestException('At least one role must be assigned');
    const passwordHash = await argon2id({
      password,
      salt: randomBytes(16),
      parallelism: 1,
      iterations: 2,
      memorySize: 19_456,
      hashLength: 32,
      outputType: 'encoded',
    });

    return this.prisma.$transaction(async (tx) => {
      const roles = await this.loadGrantableRoles(tx, roleIds, actor);
      const user = await tx.user.create({
        data: {
          email,
          displayName,
          passwordHash,
          roles: { create: roles.map((role) => ({ roleId: role.id })) },
        },
        include: USER_INCLUDE,
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'USER_CREATED',
          resourceType: 'USER',
          resourceId: user.id,
          redactedChanges: { reason, roleIds: roles.map((role) => role.id) },
        },
      });
      return this.toAdminUser(user);
    });
  }

  async update(userIdInput: string, bodyValue: unknown, actor: AuthPrincipal) {
    const userId = requiredUuid(userIdInput, 'userId');
    const body = asRequestBody(bodyValue);
    assertAllowedKeys(body, ['expectedVersion', 'displayName', 'status', 'roleIds', 'reason']);
    const expectedVersion = requiredVersion(body);
    const reason = requiredString(body, 'reason', 3, 500);
    const displayName = body.displayName === undefined
      ? undefined
      : requiredString(body, 'displayName', 1, 120);
    const status = body.status;
    if (status !== undefined && status !== 'ACTIVE' && status !== 'DISABLED') {
      throw new BadRequestException('status must be ACTIVE or DISABLED');
    }
    const roleIds = optionalUuidArray(body, 'roleIds');
    if (displayName === undefined && status === undefined && roleIds === undefined) {
      throw new BadRequestException('At least one mutable field is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: USER_INCLUDE,
      });
      if (!target) throw new NotFoundException('User not found');
      if (
        target.id !== actor.id &&
        !actor.permissions.includes(PRIVILEGED_ROLE_PERMISSION) &&
        this.hasPermission(target.roles.map(({ role }) => role), USER_MANAGEMENT_PERMISSION)
      ) {
        throw new ForbiddenException('You cannot manage another user manager');
      }
      if (target.version !== expectedVersion) {
        throw new ConflictException('User changed since it was loaded; reload and retry');
      }

      const roles = roleIds === undefined
        ? undefined
        : await this.loadGrantableRoles(tx, roleIds, actor);
      const effectiveRoles = roles ?? target.roles.map(({ role }) => role);
      if (target.id === actor.id && (status === 'DISABLED' || !this.hasPermission(effectiveRoles, 'user:manage'))) {
        throw new ConflictException('You cannot disable yourself or remove your user-management access');
      }
      const remainsActiveManager = status !== 'DISABLED' && this.hasPermission(effectiveRoles, 'user:manage');
      if (this.hasPermission(target.roles.map(({ role }) => role), 'user:manage') && !remainsActiveManager) {
        const otherAdministrators = await tx.user.count({
          where: {
            id: { not: target.id },
            status: 'ACTIVE',
            deletedAt: null,
            roles: { some: { role: { permissions: { some: { permission: { code: 'user:manage' } } } } } },
          },
        });
        if (otherAdministrators === 0) {
          throw new ConflictException('The last user manager cannot be disabled or demoted');
        }
      }

      const changed = await tx.user.updateMany({
        where: { id: target.id, version: expectedVersion, deletedAt: null },
        data: {
          ...(displayName === undefined ? {} : { displayName }),
          ...(status === undefined ? {} : { status }),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('User changed since it was loaded; reload and retry');
      }
      if (roles) {
        await tx.userRole.deleteMany({ where: { userId: target.id } });
        if (roles.length) {
          await tx.userRole.createMany({ data: roles.map((role) => ({ userId: target.id, roleId: role.id })) });
        }
      }
      if (status === 'DISABLED') {
        await tx.userSession.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'USER_UPDATED',
          resourceType: 'USER',
          resourceId: target.id,
          redactedChanges: {
            reason,
            ...(displayName === undefined ? {} : { changed: ['displayName'] }),
            ...(status === undefined ? {} : { status }),
            ...(roles === undefined ? {} : { roleIds: roles.map((role) => role.id) }),
          },
        },
      });
      const updated = await tx.user.findUniqueOrThrow({ where: { id: target.id }, include: USER_INCLUDE });
      return this.toAdminUser(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async loadGrantableRoles(
    tx: Prisma.TransactionClient,
    roleIds: string[],
    actor: AuthPrincipal,
  ) {
    if (!roleIds.length) return [];
    const roles = await tx.role.findMany({
      where: { id: { in: roleIds } },
      include: { permissions: { include: { permission: true } } },
    });
    if (roles.length !== roleIds.length) throw new BadRequestException('One or more roles do not exist');
    const canGrantManager = actor.permissions.includes(PRIVILEGED_ROLE_PERMISSION);
    if (
      roles.some((role) =>
        role.permissions.some(
          ({ permission }) =>
            !actor.permissions.includes(permission.code) ||
            (permission.code === USER_MANAGEMENT_PERMISSION && !canGrantManager),
        ),
      )
    ) {
      throw new ForbiddenException('You cannot grant permissions you do not hold');
    }
    return roles;
  }

  private hasPermission(
    roles: Array<{ permissions: Array<{ permission: { code: string } }> }>,
    permission: string,
  ) {
    return roles.some((role) => role.permissions.some(({ permission: value }) => value.code === permission));
  }

  private toAdminUser(user: Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      version: user.version,
      createdAt: user.createdAt,
      roles: user.roles.map(({ role }) => ({
        id: role.id,
        code: role.code,
        name: role.name,
      })),
    };
  }
}

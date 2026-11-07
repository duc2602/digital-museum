import 'dotenv/config';
import { argon2id } from 'hash-wasm';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const permissions = [
  ['catalog:read', 'Read catalogs and terms'],
  ['catalog:write', 'Create and update catalogs and terms'],
  ['artifact:read', 'Read artifact records'],
  ['artifact:write', 'Create and update artifact records'],
  ['user:manage', 'Create users and manage their roles and status'],
  ['role:grant-manager', 'Grant user-management roles'],
];

try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error(
      'Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) before seeding.',
    );
  }

  const passwordHash = await argon2id({
    password,
    salt: randomBytes(16),
    parallelism: 1,
    iterations: 2,
    memorySize: 19_456,
    hashLength: 32,
    outputType: 'encoded',
  });

  const result = await prisma.$transaction(async (tx) => {
    const permissionRows = await Promise.all(
      permissions.map(([code, description]) =>
        tx.permission.upsert({
          where: { code },
          create: { code, description },
          update: { description },
        }),
      ),
    );

    const adminRole = await tx.role.upsert({
      where: { code: 'ADMIN' },
      create: { code: 'ADMIN', name: 'Quản trị viên' },
      update: { name: 'Quản trị viên' },
    });
    const editorRole = await tx.role.upsert({
      where: { code: 'EDITOR' },
      create: { code: 'EDITOR', name: 'Biên tập viên' },
      update: { name: 'Biên tập viên' },
    });
    const managerRole = await tx.role.upsert({
      where: { code: 'MANAGER' },
      create: { code: 'MANAGER', name: 'Quản lý nội dung' },
      update: { name: 'Quản lý nội dung' },
    });

    await Promise.all(
      permissionRows.map((permission) =>
        tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: adminRole.id,
              permissionId: permission.id,
            },
          },
          create: { roleId: adminRole.id, permissionId: permission.id },
          update: {},
        }),
      ),
    );
    const editorPermissionCodes = new Set([
      'catalog:read',
      'catalog:write',
      'artifact:read',
      'artifact:write',
    ]);
    const managerPermissionCodes = new Set([...editorPermissionCodes, 'user:manage']);
    await Promise.all(
      permissionRows
        .filter((permission) => editorPermissionCodes.has(permission.code))
        .map((permission) =>
          tx.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: editorRole.id,
                permissionId: permission.id,
              },
            },
            create: { roleId: editorRole.id, permissionId: permission.id },
            update: {},
          }),
        ),
    );

    await Promise.all(
      permissionRows
        .filter((permission) => managerPermissionCodes.has(permission.code))
        .map((permission) =>
          tx.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: managerRole.id,
                permissionId: permission.id,
              },
            },
            create: { roleId: managerRole.id, permissionId: permission.id },
            update: {},
          }),
        ),
    );

    const existingAdmin = await tx.user.findFirst({
      where: {
        deletedAt: null,
        roles: { some: { role: { code: 'ADMIN' } } },
      },
      select: { id: true },
    });
    if (existingAdmin) {
      await tx.catalog.upsert({
        where: { code: 'GENERAL' },
        create: { code: 'GENERAL', name: 'Danh mục chung' },
        update: {},
      });
      await tx.systemSetting.upsert({
        where: { scope_key: { scope: 'global', key: 'enabled_locales' } },
        create: { scope: 'global', key: 'enabled_locales', value: ['vi'] },
        update: {},
      });
      return { bootstrapped: false };
    }

    const admin = await tx.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        displayName: 'Quản trị viên',
      },
      update: {},
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId: { userId: admin.id, roleId: adminRole.id },
      },
      create: { userId: admin.id, roleId: adminRole.id },
      update: {},
    });

    await tx.catalog.upsert({
      where: { code: 'GENERAL' },
      create: { code: 'GENERAL', name: 'Danh mục chung' },
      update: {},
    });

    await tx.systemSetting.upsert({
      where: { scope_key: { scope: 'global', key: 'enabled_locales' } },
      create: { scope: 'global', key: 'enabled_locales', value: ['vi'] },
      update: {},
    });

    return { bootstrapped: true };
  });
  if (result.bootstrapped) {
    console.log(`Admin account ready: ${email}`);
  } else {
    console.log('An admin already exists; skipped adding another bootstrap admin.');
  }
} finally {
  await prisma.$disconnect();
}

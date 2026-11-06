import { Injectable, UnauthorizedException } from '@nestjs/common';
import { argon2id, argon2Verify } from 'hash-wasm';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthPrincipal } from './auth.types.js';
import { SESSION_COOKIE } from './session.guard.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = argon2id({
  password: 'invalid-login-placeholder',
  salt: Buffer.from('6d757365756d2d617574682d73616c74', 'hex'),
  parallelism: 1,
  iterations: 2,
  memorySize: 19_456,
  hashLength: 32,
  outputType: 'encoded',
});

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(
    emailInput: unknown,
    passwordInput: unknown,
  ): Promise<{ principal: Omit<AuthPrincipal, 'sessionId'>; cookie: string }> {
    if (
      typeof emailInput !== 'string' ||
      typeof passwordInput !== 'string' ||
      passwordInput.length === 0 ||
      passwordInput.length > 1024
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const email = emailInput.trim().toLowerCase();
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.prisma.user.findFirst({
      where: { email, status: 'ACTIVE', deletedAt: null },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    const validPassword = user
      ? await argon2Verify({
          password: passwordInput,
          hash: user.passwordHash,
        })
      : await DUMMY_PASSWORD_HASH.then((hash) =>
          argon2Verify({ password: passwordInput, hash }),
        );
    if (!user || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: 'USER_LOGIN',
          resourceType: 'USER',
          resourceId: user.id,
        },
      });
    });

    const principal = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      permissions: [
        ...new Set(
          user.roles.flatMap((userRole) =>
            userRole.role.permissions.map(
              (rolePermission) => rolePermission.permission.code,
            ),
          ),
        ),
      ],
    };

    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return {
      principal,
      cookie: `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
    };
  }

  async logout(principal: AuthPrincipal): Promise<string> {
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.userSession.updateMany({
        where: {
          id: principal.sessionId,
          userId: principal.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      if (revoked.count > 0) {
        await tx.auditEvent.create({
          data: {
            actorId: principal.id,
            action: 'USER_LOGOUT',
            resourceType: 'USER',
            resourceId: principal.id,
          },
        });
      }
    });
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

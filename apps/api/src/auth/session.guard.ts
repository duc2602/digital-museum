import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

export const SESSION_COOKIE = 'museum_session';

function readCookie(header: string | undefined, name: string): string | undefined {
  const cookie = header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return cookie && /^[A-Za-z0-9_-]{43}$/.test(cookie) ? cookie : undefined;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.userSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = {
      id: session.user.id,
      sessionId: session.id,
      email: session.user.email,
      displayName: session.user.displayName,
      permissions: [
        ...new Set(
          session.user.roles.flatMap((userRole) =>
            userRole.role.permissions.map(
              (rolePermission) => rolePermission.permission.code,
            ),
          ),
        ),
      ],
    };

    return true;
  }
}

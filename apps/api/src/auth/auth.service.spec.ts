import { UnauthorizedException } from '@nestjs/common';
import { argon2Verify } from 'hash-wasm';
import { AuthService } from './auth.service.js';

vi.mock('hash-wasm', () => ({
  argon2id: vi.fn().mockResolvedValue('$argon2id$test'),
  argon2Verify: vi.fn(),
}));

describe('AuthService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes email and creates a hashed, expiring session', async () => {
    vi.mocked(argon2Verify).mockResolvedValueOnce(true);
    const user = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@example.org',
      passwordHash: '$argon2id$stored',
      displayName: 'Museum Admin',
      roles: [
        {
          role: {
            permissions: [
              { permission: { code: 'artifact:read' } },
              { permission: { code: 'artifact:write' } },
            ],
          },
        },
      ],
    };
    const tx = {
      userSession: { create: vi.fn().mockResolvedValue({}) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(user) },
      $transaction: vi.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const service = new AuthService(prisma as never);

    const result = await service.login(' ADMIN@EXAMPLE.ORG ', 'correct-password');

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin@example.org', status: 'ACTIVE', deletedAt: null },
      }),
    );
    expect(result.principal.permissions).toEqual([
      'artifact:read',
      'artifact:write',
    ]);
    expect(result.cookie).toContain('HttpOnly');
    expect(result.cookie).toContain('SameSite=Strict');
    expect(tx.userSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('uses a generic error and does not create a session for unknown accounts', async () => {
    vi.mocked(argon2Verify).mockResolvedValueOnce(false);
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      userSession: { create: vi.fn() },
    };
    const service = new AuthService(prisma as never);

    await expect(
      service.login('unknown@example.org', 'some-password'),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.userSession.create).not.toHaveBeenCalled();
    expect(argon2Verify).toHaveBeenCalledWith({
      password: 'some-password',
      hash: '$argon2id$test',
    });
  });
});

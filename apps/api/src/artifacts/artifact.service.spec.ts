import { BadRequestException, ConflictException } from '@nestjs/common';
import { ArtifactService } from './artifact.service.js';

describe('ArtifactService optimistic locking', () => {
  it('rejects a write with a stale version', async () => {
    const artifactId = '00000000-0000-4000-8000-000000000001';
    const tx = {
      artifact: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const service = new ArtifactService(prisma as never);

    await expect(
      service.update(
        artifactId,
        { expectedVersion: 2, title: 'Updated title' },
        '00000000-0000-4000-8000-000000000002',
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.artifact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: artifactId, version: 2, deletedAt: null },
      }),
    );
  });
});


describe('ArtifactService pagination', () => {
  it('returns a page and indicates when another page exists', async () => {
    const rows = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
    const prisma = {
      artifact: { findMany: vi.fn().mockResolvedValue(rows) },
    };
    const service = new ArtifactService(prisma as never);

    await expect(service.list({ limit: '2', offset: '2' })).resolves.toEqual({
      items: rows.slice(0, 2),
      hasMore: true,
    });
    expect(prisma.artifact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 3 }),
    );
  });

  it('rejects a negative offset', async () => {
    const service = new ArtifactService({ artifact: { findMany: vi.fn() } } as never);
    await expect(service.list({ offset: '-1' })).rejects.toThrow(BadRequestException);
  });
});

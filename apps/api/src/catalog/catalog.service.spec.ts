import { ConflictException } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';

describe('CatalogService term hierarchy', () => {
  it('rejects an update that would create a recursive cycle', async () => {
    const termA = '00000000-0000-4000-8000-000000000001';
    const termB = '00000000-0000-4000-8000-000000000002';
    const tx = {
      $queryRaw: vi.fn(),
      term: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: termA, catalogId: 'catalog-id' })
          .mockResolvedValueOnce({ id: termB, parentId: termA })
          .mockResolvedValueOnce({ id: termA, parentId: null }),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const service = new CatalogService(prisma as never);

    await expect(
      service.updateTerm(
        termA,
        { expectedVersion: 1, parentId: termB },
        '00000000-0000-4000-8000-000000000003',
      ),
    ).rejects.toThrow(ConflictException);
    expect(tx.term.updateMany).not.toHaveBeenCalled();
  });
});

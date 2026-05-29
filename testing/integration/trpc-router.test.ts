import { describe, expect, it } from 'vitest';
import { appRouter } from '@/backend/trpc/app-router';

describe('appRouter integration', () => {
  it('responds from the example hi mutation', async () => {
    const caller = appRouter.createCaller({
      req: new Request('http://localhost/api/trpc'),
    });

    const result = await caller.example.hi({ name: 'Pantra' });

    expect(result.hello).toBe('Pantra');
    expect(result.date).toBeInstanceOf(Date);
  });

  it('validates required mutation input', async () => {
    const caller = appRouter.createCaller({
      req: new Request('http://localhost/api/trpc'),
    });

    await expect(caller.example.hi({} as { name: string })).rejects.toThrow();
  });
});

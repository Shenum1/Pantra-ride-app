import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Scheduled rides are hidden for launch (owner decision 2026-10-09): nothing dispatches a ride at its
// scheduled time, and drivers would see it as an immediate request. The server refuses a scheduled
// booking, and the app no longer offers scheduling or the mock Calendars screen.

const RIDER = '11111111-1111-4111-8111-111111111111';
const dbCalls: string[] = [];

const fakeAdmin: any = {
  from: (table: string) => {
    dbCalls.push(`from:${table}`);
    throw new Error(`unexpected database access: ${table}`);
  },
  rpc: (name: string) => {
    dbCalls.push(`rpc:${name}`);
    throw new Error(`unexpected rpc: ${name}`);
  },
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: RIDER } }, error: null })) },
};

vi.mock('@/backend/lib/supabase-admin', () => ({ supabaseAdmin: fakeAdmin }));

async function book(extra: Record<string, unknown>) {
  const { createTRPCRouter } = await import('@/backend/trpc/create-context');
  const { default: create } = await import('@/backend/trpc/routes/rides/create/route');
  const router = createTRPCRouter({ create });
  const headers = new Headers({ authorization: 'Bearer valid-token' });
  const caller = router.createCaller({ req: new Request('http://localhost/api/trpc', { headers }) });
  return caller.create({
    pickupLocation: { latitude: 6.5, longitude: 3.3 },
    dropoffLocation: { latitude: 6.6, longitude: 3.4 },
    pickupAddress: 'A',
    dropoffAddress: 'B',
    ...extra,
  } as any);
}

beforeEach(() => {
  dbCalls.length = 0;
});

describe('rides.create with a scheduled time', () => {
  it('is refused with a clear message, before anything is read or written', async () => {
    const when = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await expect(book({ scheduledTime: when })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringMatching(/Scheduled rides are not available yet/),
    });
    expect(dbCalls).toEqual([]);
  });
});

describe('the app no longer offers scheduling', () => {
  const root = process.cwd();
  const exists = (p: string) => fs.existsSync(path.resolve(root, p));
  const read = (p: string) => fs.readFileSync(path.resolve(root, p), 'utf8');

  it('has no schedule-ride or mock calendars screen, and the routes are gone', () => {
    expect(exists('app/schedule-ride.tsx')).toBe(false);
    expect(exists('app/calendars.tsx')).toBe(false);
    const layout = read('app/_layout.tsx');
    expect(layout).not.toContain('schedule-ride');
    expect(layout).not.toContain('"calendars"');
  });

  it('has no Calendars entry in Account', () => {
    expect(read('app/(tabs)/account.tsx')).not.toContain('/calendars');
  });

  it('the welcome screen no longer promises scheduled rides', () => {
    const welcome = read('app/welcome.tsx');
    expect(welcome).not.toMatch(/schedul/i);
    expect(welcome).not.toContain('90 days');
  });
});

describe('Vercel region', () => {
  it('runs the backend functions in Dublin, next to the Supabase database in eu-west-1', () => {
    const config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'));
    expect(config.regions).toEqual(['dub1']);
  });
});

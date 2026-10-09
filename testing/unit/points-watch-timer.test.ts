import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Source guards on supabase/migrations/20261008000900_task_watch_timer.sql
// (no Postgres test harness in this codebase; the rules were also exercised
// against a local database when the migration was written).
const root = process.cwd();
const sql = fs
  .readFileSync(path.resolve(root, 'supabase/migrations/20261008000900_task_watch_timer.sql'), 'utf8')
  .replace(/--[^\n]*/g, '');
const screen = fs.readFileSync(path.resolve(root, 'app/task-detail.tsx'), 'utf8');
const claimRoute = fs.readFileSync(path.resolve(root, 'backend/trpc/routes/rewards/claim-task/route.ts'), 'utf8');

describe('video watch timer (server side)', () => {
  it('claiming a video task requires a recorded start that is old enough', () => {
    expect(sql).toMatch(/if v_task\."type" = 'youtube_video' then/);
    expect(sql).toContain(`coalesce(v_task."minWatchSeconds", 120)`);
    expect(sql).toMatch(/extract\(epoch from \(now\(\) - v_started\)\) < v_required/);
    expect(sql).toContain("raise exception 'TASK_NOT_WATCHED'");
  });

  it('starting twice keeps the earliest start, so the clock cannot be reset or faked', () => {
    expect(sql).toMatch(/on conflict \("userId", "taskId"\) do nothing/);
  });

  it('a repeatable task needs a fresh start for its next claim', () => {
    expect(sql).toMatch(/delete from public\.reward_task_starts/);
  });

  it('the start table and both functions are closed to app sessions', () => {
    expect(sql).toContain('alter table public.reward_task_starts enable row level security;');
    expect(sql).toContain('revoke all on table public.reward_task_starts from anon, authenticated;');
    expect(sql).toContain('revoke all on function public.start_reward_task(text, uuid) from public, anon, authenticated;');
    expect(sql).toContain('grant execute on function public.start_reward_task(text, uuid) to service_role;');
    expect(sql).toContain('grant execute on function public.claim_reward_task(text, uuid) to service_role;');
    expect(sql).not.toMatch(/grant [^;]*to[^;]*authenticated/i);
  });
});

describe('video watch timer (app and route)', () => {
  it('the claim route reports an unwatched video clearly', () => {
    expect(claimRoute).toContain('TASK_NOT_WATCHED');
  });

  it('the task screen starts the server clock before opening the video and follows its numbers', () => {
    expect(screen).toContain('RewardsService.startTask(task.id)');
    expect(screen.indexOf('RewardsService.startTask(task.id)')).toBeLessThan(screen.indexOf('Linking.openURL(task.url)'));
    expect(screen).toContain('startTimer(requiredSeconds, remainingSeconds)');
  });
});

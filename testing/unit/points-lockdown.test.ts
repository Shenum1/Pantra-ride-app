import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Source guards on supabase/migrations/20261008000800_points_lockdown.sql
// (no Postgres test harness in this codebase; the migration was also exercised
// against a local database when it was written), plus checks that the app no
// longer writes points directly.
const root = process.cwd();
const sql = fs
  .readFileSync(path.resolve(root, 'supabase/migrations/20261008000800_points_lockdown.sql'), 'utf8')
  .replace(/--[^\n]*/g, ''); // ignore comments
const rewardsService = fs.readFileSync(path.resolve(root, 'lib/rewards-service.ts'), 'utf8');
const claimRoute = fs.readFileSync(path.resolve(root, 'backend/trpc/routes/rewards/claim-task/route.ts'), 'utf8');

describe('points lockdown migration', () => {
  it('replaces the FOR ALL policies with select-only policies on own rows', () => {
    expect(sql).toContain('drop policy if exists "points_own" on public.points_transactions;');
    expect(sql).toContain('drop policy if exists "completions_own" on public.user_task_completions;');
    expect(sql).toMatch(/create policy "points_read_own"\s+on public\.points_transactions for select/);
    expect(sql).toMatch(/create policy "completions_read_own"\s+on public\.user_task_completions for select/);
    // No policy grants writes (the `for update` row lock inside the function is a different thing).
    expect(sql).not.toMatch(/create policy[^;]*\bfor (all|insert|update|delete)\b/i);
  });

  it('removes write privileges from app roles and keeps only select', () => {
    expect(sql).toContain('revoke all on table public.points_transactions from anon, authenticated;');
    expect(sql).toContain('revoke all on table public.user_task_completions from anon, authenticated;');
    expect(sql).toContain('grant select on table public.points_transactions to authenticated;');
    expect(sql).not.toMatch(/grant (insert|update|delete|all)[^;]*to[^;]*authenticated/i);
  });

  it('makes the balance view respect row rules and closes it to anon', () => {
    expect(sql).toContain('alter view public.user_points_balance set (security_invoker = true);');
    expect(sql).toContain('revoke all on table public.user_points_balance from anon, authenticated;');
  });

  it('only the backend can call claim_reward_task', () => {
    expect(sql).toContain('revoke all on function public.claim_reward_task(text, uuid) from public, anon, authenticated;');
    expect(sql).toContain('grant execute on function public.claim_reward_task(text, uuid) to service_role;');
  });

  it('claim_reward_task takes the amount from the task and enforces every limit under a row lock', () => {
    expect(sql).toMatch(/from public\.reward_tasks where "id" = p_task_id for update/);
    expect(sql).toContain(`"isActive"`);
    expect(sql).toContain(`"validUntil"`);
    expect(sql).toContain(`"maxCompletionsPerUser"`);
    expect(sql).toContain(`"totalMaxCompletions"`);
    expect(sql).toContain(`v_task."pointsReward"`);
    expect(sql).not.toMatch(/p_points|p_amount/);
  });
});

describe('claiming a task reward', () => {
  it('the app asks the server and sends no points amount or user id', () => {
    expect(rewardsService).toContain('trpcClient.rewards.claimTask.mutate({ taskId })');
  });

  it('the app never writes points tables directly', () => {
    expect(rewardsService).not.toMatch(/from\('user_task_completions'\)\s*\.(insert|update|delete)/);
    expect(rewardsService).not.toMatch(/claimTaskReward[\s\S]{0,400}from\('points_transactions'\)\s*\.insert/);
  });

  it('the server route authenticates, validates the id, and uses the session user', () => {
    expect(claimRoute).toContain('authedProcedure');
    expect(claimRoute).toContain('taskId: z.string().uuid()');
    expect(claimRoute).toContain('p_user_id: ctx.userId');
  });
});

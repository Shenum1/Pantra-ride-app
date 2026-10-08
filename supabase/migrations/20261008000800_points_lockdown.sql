-- ============================================================
-- Rewards points: read-only for app sessions, credited by the backend only
-- ============================================================
-- Before this, "points_own" and "completions_own" were FOR ALL policies, so any
-- signed-in user could insert points for themselves (any amount, any type),
-- edit them, or delete their spending history; and the app itself did exactly
-- that for task rewards (lib/rewards-service.ts claimTaskReward), trusting the
-- phone to supply the points amount and to check "already claimed".
--
-- After this:
--   * app sessions can only READ their own rows;
--   * task rewards are claimed through claim_reward_task(), which only the
--     backend (service role) can call. It takes the points amount from
--     reward_tasks, enforces active / valid-until / per-user and total limits
--     under a row lock, and writes the completion, the ledger row and the
--     task's completedCount in one transaction;
--   * the balance view stops bypassing row rules, and anon loses access.
-- Ad rewards already go through the backend (rewards.claimAdReward).
--
-- Not handled here: spending points (type 'ride_redemption'). No server code
-- applies points to a fare today, so with direct writes closed the old
-- client-side redemption is simply rejected. Needs a product decision.
-- Re-runnable.
-- ============================================================

-- 1. Read-only own rows ----------------------------------------------------
drop policy if exists "points_own" on public.points_transactions;
drop policy if exists "points_read_own" on public.points_transactions;
create policy "points_read_own"
  on public.points_transactions for select
  to authenticated
  using (auth.uid()::text = "userId");

drop policy if exists "completions_own" on public.user_task_completions;
drop policy if exists "completions_read_own" on public.user_task_completions;
create policy "completions_read_own"
  on public.user_task_completions for select
  to authenticated
  using (auth.uid()::text = "userId");

revoke all on table public.points_transactions from anon, authenticated;
revoke all on table public.user_task_completions from anon, authenticated;
grant select on table public.points_transactions to authenticated;
grant select on table public.user_task_completions to authenticated;

-- 2. Balance view: apply the caller's row rules, no anonymous access --------
alter view public.user_points_balance set (security_invoker = true);
revoke all on table public.user_points_balance from anon, authenticated;
grant select on table public.user_points_balance to authenticated;

-- 3. Server-side task claim --------------------------------------------------
create or replace function public.claim_reward_task(p_user_id text, p_task_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.reward_tasks;
  v_done integer;
begin
  -- Lock the task row so concurrent claims can't overshoot the limits.
  select * into v_task from public.reward_tasks where "id" = p_task_id for update;

  if not found
     or not v_task."isActive"
     or (v_task."validUntil" is not null and v_task."validUntil" <= now())
  then
    raise exception 'TASK_UNAVAILABLE';
  end if;

  select count(*) into v_done
  from public.user_task_completions
  where "userId" = p_user_id and "taskId" = p_task_id;

  if v_done >= v_task."maxCompletionsPerUser" then
    raise exception 'TASK_ALREADY_CLAIMED';
  end if;

  if v_task."totalMaxCompletions" is not null
     and v_task."completedCount" >= v_task."totalMaxCompletions"
  then
    raise exception 'TASK_FULLY_CLAIMED';
  end if;

  insert into public.user_task_completions ("userId", "taskId", "pointsEarned")
  values (p_user_id, p_task_id, v_task."pointsReward");

  -- Same 90-day expiry the app has always used for earned points.
  insert into public.points_transactions
    ("userId", "amount", "type", "referenceId", "description", "expiresAt")
  values
    (p_user_id, v_task."pointsReward", 'task_reward', p_task_id::text,
     'Task reward — ' || v_task."pointsReward" || ' points',
     now() + interval '90 days');

  update public.reward_tasks
  set "completedCount" = "completedCount" + 1
  where "id" = p_task_id;

  return v_task."pointsReward";
end;
$$;

revoke all on function public.claim_reward_task(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_reward_task(text, uuid) to service_role;

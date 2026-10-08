-- ============================================================
-- Video tasks: the server keeps the watch clock
-- ============================================================
-- The watch timer used to live only on the phone, so a modified app could claim
-- a video reward instantly. Now the app tells the server when the rider starts
-- (start_reward_task) and claim_reward_task refuses a video claim until the
-- required time has passed on the SERVER's clock.
--
-- This is a time gate, not proof of watching: the server cannot see what is on
-- the rider's screen, and social_share tasks have no equivalent check. The
-- required time is reward_tasks."minWatchSeconds", defaulting to 120 seconds
-- (the default the app has always used) when a video task doesn't set one.
--
-- Both functions are backend-only (service role), like claim_reward_task.
-- Re-runnable.
-- ============================================================

create table if not exists public.reward_task_starts (
  "userId"    text        not null,
  "taskId"    uuid        not null references public.reward_tasks("id") on delete cascade,
  "startedAt" timestamptz not null default now(),
  primary key ("userId", "taskId")
);

-- No policies and no grants: only the backend (service role) touches this table.
alter table public.reward_task_starts enable row level security;
revoke all on table public.reward_task_starts from anon, authenticated;

-- Records when this user started the task. Keeps the EARLIEST start, so
-- tapping Watch again can't reset or fake the clock. Returns the seconds the
-- user must wait in total, and how many are left.
create or replace function public.start_reward_task(p_user_id text, p_task_id uuid)
returns table (required_seconds integer, remaining_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.reward_tasks;
  v_required integer;
  v_started timestamptz;
begin
  select * into v_task from public.reward_tasks where "id" = p_task_id;

  if not found
     or not v_task."isActive"
     or (v_task."validUntil" is not null and v_task."validUntil" <= now())
  then
    raise exception 'TASK_UNAVAILABLE';
  end if;

  v_required := case when v_task."type" = 'youtube_video'
                     then coalesce(v_task."minWatchSeconds", 120) else 0 end;

  insert into public.reward_task_starts ("userId", "taskId")
  values (p_user_id, p_task_id)
  on conflict ("userId", "taskId") do nothing;

  select "startedAt" into v_started
  from public.reward_task_starts
  where "userId" = p_user_id and "taskId" = p_task_id;

  return query select
    v_required,
    greatest(0, v_required - floor(extract(epoch from (now() - v_started)))::integer);
end;
$$;

revoke all on function public.start_reward_task(text, uuid) from public, anon, authenticated;
grant execute on function public.start_reward_task(text, uuid) to service_role;

-- claim_reward_task: same as 20261008000800, plus the watch-time gate.
create or replace function public.claim_reward_task(p_user_id text, p_task_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.reward_tasks;
  v_done integer;
  v_required integer;
  v_started timestamptz;
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

  if v_task."type" = 'youtube_video' then
    v_required := coalesce(v_task."minWatchSeconds", 120);

    select "startedAt" into v_started
    from public.reward_task_starts
    where "userId" = p_user_id and "taskId" = p_task_id;

    if v_started is null
       or extract(epoch from (now() - v_started)) < v_required
    then
      raise exception 'TASK_NOT_WATCHED';
    end if;
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

  -- A repeatable task needs a fresh start (and a fresh wait) for the next claim.
  delete from public.reward_task_starts
  where "userId" = p_user_id and "taskId" = p_task_id;

  return v_task."pointsReward";
end;
$$;

revoke all on function public.claim_reward_task(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_reward_task(text, uuid) to service_role;

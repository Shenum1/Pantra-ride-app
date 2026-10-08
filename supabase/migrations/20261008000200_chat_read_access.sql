-- ============================================================
-- Chat: let the two people in a conversation read it
-- ============================================================
-- Production has row level security on conversations and messages but no
-- SELECT policy on either, so no app session can read any chat (found by
-- comparing the 2026-10-08 production snapshot with database/schemas/).
-- supabase-schema.sql defines "Participants can read conversations/messages",
-- but they never reached production, and the wave 1 security hardening
-- migration assumes they exist.
--
-- Same participant test as the insert/update policies in
-- 20261008000100_security_hardening.sql: the rider on the conversation, or the
-- user who owns the conversation's drivers row. Re-runnable.
-- ============================================================

drop policy if exists "Participants can read conversations" on public.conversations;
create policy "Participants can read conversations"
  on public.conversations for select
  to authenticated
  using (
    auth.uid() = conversations."userId"
    or exists (
      select 1 from public.drivers d
      where d."id" = conversations."driverId" and d."userId" = auth.uid()
    )
  );

drop policy if exists "Participants can read messages" on public.messages;
create policy "Participants can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c."id" = messages."conversationId"
        and (
          c."userId" = auth.uid()
          or exists (
            select 1 from public.drivers d
            where d."id" = c."driverId" and d."userId" = auth.uid()
          )
        )
    )
  );

-- The indexes supabase-schema.sql also defines, missing from production for the
-- same reason. The policies above look conversations up by these columns.
create index if not exists idx_messages_conversationId on public.messages ("conversationId");
create index if not exists idx_conversations_userId on public.conversations ("userId");
create index if not exists idx_conversations_driverId on public.conversations ("driverId");

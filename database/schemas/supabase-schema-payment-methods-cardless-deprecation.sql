-- ============================================================
-- Pantra Ride App — Cardless Wallet Architecture: deprecate card
-- payment_methods rows (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-payment-methods.sql.
--
-- Pantra has committed to a cardless, prepaid-wallet architecture: no saved
-- cards, no per-ride authorization holds, no tokenization. Confirmed by
-- code audit that app/add-payment-method.tsx was a cosmetic demo form —
-- it collected a card number/CVV and stored only the last 4 digits +
-- expiry, with its own on-screen disclaimer "This is a demo. In production,
-- use Paystack/Flutterwave for secure card processing." No full card number
-- or CVV was ever persisted anywhere, so deleting these rows loses no real
-- financial data — only cosmetic display rows for a screen that has been
-- removed from the app.
-- ============================================================

-- Remove existing cosmetic 'card' rows — nothing of financial value in them
-- (see header). Safe to run even if the table is empty or has none.
delete from public.payment_methods where "type" = 'card';

-- Narrow the CHECK constraint so no new 'card' row can ever be inserted
-- again, closing this off at the database level rather than relying only on
-- the app no longer offering the UI for it.
do $$
declare con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.payment_methods'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.payment_methods drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.payment_methods
  add constraint payment_methods_type_check
  check ("type" in ('cash', 'wallet'));

-- Public contact form inserts
-- ---------------------------
-- The public /contact form writes through a Next.js Server Action using the
-- anon (or authenticated) Supabase key. contact_messages already exists with
-- admin-only SELECT/UPDATE policies and no INSERT policy, so submissions
-- would be rejected by RLS. This migration only adds a narrow insert grant
-- and policy; it does not recreate the table or change existing columns.
--
-- Inserts are limited to name, email, phone, subject, and message. Status
-- and timestamps stay at their table defaults ('new', now()). Admins remain
-- the only role that can read or update rows.

do $$
begin
  if to_regclass('public.contact_messages') is null then
    return;
  end if;

  execute 'alter table public.contact_messages enable row level security';

  execute 'drop policy if exists "Anyone can submit contact messages" on public.contact_messages';
  execute $policy$
    create policy "Anyone can submit contact messages"
    on public.contact_messages
    for insert
    to anon, authenticated
    with check (
      length(btrim(name)) > 0
      and length(btrim(email)) > 0
      and length(btrim(message)) > 0
    )
  $policy$;

  execute 'grant insert (name, email, phone, subject, message) on public.contact_messages to anon, authenticated';
end;
$$;

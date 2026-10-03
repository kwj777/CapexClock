-- CapexClock 0006: automatic owner emails. Run once in the Supabase SQL editor, after 0005.
-- It's safe to run again, and the site works both before and after it runs. Before it runs,
-- My properties shows the email settings as unavailable.
--
-- 1. memberships: who is a founding member. Only members get the three emails (replacement
--    reminders, the yearly budget summary and the yearly condition report). Owners can read
--    their own row but never change it. Until Stripe sets it, add a row by hand in the
--    Supabase table editor: user_id = the account's id (Authentication > Users), active = true.
-- 2. email_settings: one row per account, with an on/off switch for each email and the
--    random token in every unsubscribe link. No row means all three are on.
-- 3. email_log: every email sent, so a rerun never sends the same one twice. Only the
--    daily sender (with the server-only secret key) reads or writes it.
-- 4. email_unsubscribe(token, kind): what an unsubscribe link calls. It needs no sign-in,
--    and the token is the only way to find the account.

-- 1. Memberships ----------------------------------------------------------------

create table if not exists public.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active boolean not null default true,
  -- Free text for you, such as "Paid by Payment Link 2026-10-04".
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists memberships_updated_at on public.memberships;
create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

alter table public.memberships enable row level security;

drop policy if exists "Owners read their membership" on public.memberships;
create policy "Owners read their membership" on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 2. Email settings -------------------------------------------------------------

create table if not exists public.email_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  reminders boolean not null default true,
  budget_summary boolean not null default true,
  condition_report boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_settings_updated_at on public.email_settings;
create trigger email_settings_updated_at before update on public.email_settings
  for each row execute function public.set_updated_at();

alter table public.email_settings enable row level security;

drop policy if exists "Owners read their email settings" on public.email_settings;
create policy "Owners read their email settings" on public.email_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owners add their email settings" on public.email_settings;
create policy "Owners add their email settings" on public.email_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Owners change their email settings" on public.email_settings;
create policy "Owners change their email settings" on public.email_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Owners may only set the three switches; the token always comes from the default.
revoke insert, update on public.email_settings from anon, authenticated;
grant insert (reminders, budget_summary, condition_report) on public.email_settings to authenticated;
grant update (reminders, budget_summary, condition_report) on public.email_settings to authenticated;

-- 3. Email log -----------------------------------------------------------------

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'budget_summary', 'condition_report')),
  -- The due year for a reminder; the year the email is about for the others.
  year integer not null check (year between 2000 and 2200),
  -- Reminders only: the component it was about.
  component_id uuid references public.components (id) on delete cascade,
  sent_at timestamptz not null default now(),
  check ((kind = 'reminder') = (component_id is not null))
);
create unique index if not exists email_log_once_idx
  on public.email_log (user_id, kind, year, component_id) nulls not distinct;

-- Row Level Security with no policies: only the secret key can read or write it.
alter table public.email_log enable row level security;

-- 4. Unsubscribe links ----------------------------------------------------------

-- Turns off one email (or all three) for the account the token belongs to. Returns false
-- when the token matches no account. Security definer, so it works without signing in.
create or replace function public.email_unsubscribe(p_token uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('reminders', 'budget_summary', 'condition_report', 'all') then
    raise exception 'Unknown email kind' using errcode = '22023';
  end if;
  update public.email_settings set
    reminders = case when p_kind in ('reminders', 'all') then false else reminders end,
    budget_summary = case when p_kind in ('budget_summary', 'all') then false else budget_summary end,
    condition_report = case when p_kind in ('condition_report', 'all') then false else condition_report end
  where unsubscribe_token = p_token;
  return found;
end;
$$;

revoke execute on function public.email_unsubscribe(uuid, text) from public;
grant execute on function public.email_unsubscribe(uuid, text) to anon, authenticated;

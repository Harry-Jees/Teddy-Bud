-- Recovery keys are never stored in plaintext. The gateway stores only a
-- keyed HMAC verifier and the associated normalized login email.
create table if not exists public.account_recovery_verifiers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  verifier text not null check (length(verifier) = 43),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_recovery_verifiers enable row level security;
revoke all on table public.account_recovery_verifiers from public, anon, authenticated;
grant select, insert, update, delete on table public.account_recovery_verifiers to service_role;

create or replace function public.set_account_recovery_verifier_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_account_recovery_verifier_updated_at() from public, anon, authenticated;
drop trigger if exists set_account_recovery_verifier_updated_at on public.account_recovery_verifiers;
create trigger set_account_recovery_verifier_updated_at
  before update on public.account_recovery_verifiers
  for each row execute procedure public.set_account_recovery_verifier_updated_at();

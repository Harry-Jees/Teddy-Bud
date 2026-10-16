alter table public.user_profiles
  add column if not exists full_name text;

update public.user_profiles as profile
set full_name = nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), '')
from auth.users as auth_user
where profile.user_id = auth_user.id
  and profile.full_name is null;

create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, full_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

revoke all on function public.create_user_profile() from public, anon, authenticated;

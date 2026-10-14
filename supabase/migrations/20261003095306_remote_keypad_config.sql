-- Remote keypad configuration
-- The PIN itself is never stored in plaintext. The client sends SHA-256(pin).
create extension if not exists pgcrypto;

create table if not exists public.door_keypad_configs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique references public.devices(id) on delete cascade,
  pin_hash text not null check (pin_hash ~ '^[0-9a-f]{64}$'),
  pin_length smallint not null default 4 check (pin_length between 4 and 8),
  pin_version bigint not null default 1 check (pin_version >= 1),
  keypad_enabled boolean not null default true,
  confirm_key text not null default '#' check (confirm_key ~ '^[0-9ABCD*#]$'),
  clear_key text not null default '*' check (clear_key ~ '^[0-9ABCD*#]$'),
  applied_version bigint not null default 0 check (applied_version >= 0),
  updated_at timestamptz not null default now()
);

alter table public.door_keypad_configs enable row level security;
revoke all on table public.door_keypad_configs from anon, authenticated;
grant all on table public.door_keypad_configs to service_role;

drop policy if exists "Admins can read keypad config" on public.door_keypad_configs;
create policy "Admins can read keypad config"
on public.door_keypad_configs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'
      and is_active = true
  )
);

insert into public.door_keypad_configs (
  device_id,
  pin_hash,
  pin_length,
  pin_version,
  keypad_enabled,
  confirm_key,
  clear_key,
  applied_version
)
select
  d.id,
  encode(digest('1234', 'sha256'), 'hex'),
  4,
  1,
  true,
  '#',
  '*',
  0
from public.devices d
where d.device_code = 'ESP-MAIN-DOOR'
on conflict (device_id) do nothing;

create or replace function public.get_door_keypad_config()
returns table (
  device_id uuid,
  pin_length smallint,
  pin_version bigint,
  keypad_enabled boolean,
  confirm_key text,
  clear_key text,
  applied_version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
      and is_active = true
  ) then
    raise exception 'ADMIN_ONLY';
  end if;

  return query
  select
    c.device_id,
    c.pin_length,
    c.pin_version,
    c.keypad_enabled,
    c.confirm_key,
    c.clear_key,
    c.applied_version,
    c.updated_at
  from public.door_keypad_configs c
  join public.devices d on d.id = c.device_id
  where d.device_code = 'ESP-MAIN-DOOR'
  limit 1;
end;
$function$;

create or replace function public.update_door_keypad_config(
  new_pin_hash text,
  new_pin_length smallint default 4,
  new_keypad_enabled boolean default true,
  new_confirm_key text default '#',
  new_clear_key text default '*'
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target_device_id uuid;
  next_version bigint;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
      and is_active = true
  ) then
    raise exception 'ADMIN_ONLY';
  end if;

  if new_pin_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_PIN_HASH';
  end if;

  if new_pin_length < 4 or new_pin_length > 8 then
    raise exception 'INVALID_PIN_LENGTH';
  end if;

  if new_confirm_key !~ '^[0-9ABCD*#]$' then
    raise exception 'INVALID_CONFIRM_KEY';
  end if;

  if new_clear_key !~ '^[0-9ABCD*#]$' then
    raise exception 'INVALID_CLEAR_KEY';
  end if;

  select id
  into target_device_id
  from public.devices
  where device_code = 'ESP-MAIN-DOOR'
  limit 1;

  if target_device_id is null then
    raise exception 'DEVICE_NOT_FOUND';
  end if;

  select coalesce(pin_version, 0) + 1
  into next_version
  from public.door_keypad_configs
  where device_id = target_device_id;

  if next_version is null then
    next_version := 1;
  end if;

  insert into public.door_keypad_configs (
    device_id,
    pin_hash,
    pin_length,
    pin_version,
    keypad_enabled,
    confirm_key,
    clear_key,
    applied_version,
    updated_at
  )
  values (
    target_device_id,
    new_pin_hash,
    new_pin_length,
    next_version,
    new_keypad_enabled,
    new_confirm_key,
    new_clear_key,
    0,
    now()
  )
  on conflict (device_id) do update
  set
    pin_hash = excluded.pin_hash,
    pin_length = excluded.pin_length,
    pin_version = excluded.pin_version,
    keypad_enabled = excluded.keypad_enabled,
    confirm_key = excluded.confirm_key,
    clear_key = excluded.clear_key,
    applied_version = public.door_keypad_configs.applied_version,
    updated_at = now();

  return next_version;
end;
$function$;

revoke all on function public.get_door_keypad_config() from public;
grant execute on function public.get_door_keypad_config() to authenticated;

revoke all on function public.update_door_keypad_config(text, smallint, boolean, text, text) from public;
grant execute on function public.update_door_keypad_config(text, smallint, boolean, text, text) to authenticated;


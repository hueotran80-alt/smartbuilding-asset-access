-- Tenant app second layer: use the ADMIN-managed door PIN and optional Android biometric.
-- The existing pin_version remains untouched because it is also used for physical keypad sync.

alter table public.door_keypad_configs
  add column if not exists pin_auth_generation bigint not null default 1;

create or replace function public.bump_door_keypad_auth_generation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.pin_hash is distinct from old.pin_hash then
      new.pin_auth_generation := coalesce(old.pin_auth_generation, 1) + 1;
    else
      new.pin_auth_generation := coalesce(old.pin_auth_generation, 1);
    end if;
  else
    new.pin_auth_generation := coalesce(new.pin_auth_generation, 1);
  end if;
  return new;
end;
$function$;

revoke all on function public.bump_door_keypad_auth_generation() from public, anon, authenticated;
drop trigger if exists door_keypad_auth_generation_trigger on public.door_keypad_configs;
create trigger door_keypad_auth_generation_trigger
before insert or update on public.door_keypad_configs
for each row execute function public.bump_door_keypad_auth_generation();

create table if not exists public.tenant_app_biometrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  occupant_id uuid not null references public.room_occupants(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, occupant_id)
);

alter table public.tenant_app_biometrics enable row level security;
revoke all on table public.tenant_app_biometrics from public, anon, authenticated;
grant all on table public.tenant_app_biometrics to service_role;

create or replace function public.get_tenant_app_lock_status()
returns table (pin_generation bigint, biometric_ready boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  caller_room uuid;
  current_pin_generation bigint;
  has_biometric boolean;
begin
  if caller_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select p.role, p.room_id
  into caller_role, caller_room
  from public.profiles p
  where p.id = caller_id and p.is_active = true;

  if caller_role is distinct from 'TENANT' then raise exception 'TENANT_ONLY'; end if;
  if caller_room is null then raise exception 'TENANT_ROOM_NOT_FOUND'; end if;

  select c.pin_auth_generation
  into current_pin_generation
  from public.door_keypad_configs c
  join public.devices d on d.id = c.device_id
  where d.device_code = 'ESP-MAIN-DOOR'
  limit 1;

  if current_pin_generation is null then raise exception 'PIN_CONFIG_NOT_FOUND'; end if;

  select exists (
    select 1
    from public.room_occupants ro
    where ro.room_id = caller_room
      and ro.is_active = true
      and (
        exists (
          select 1 from public.biometric_credentials bc
          where bc.occupant_id = ro.id
            and bc.is_active = true
            and bc.biometric_type = 'WEBAUTHN'
            and bc.credential_id is not null
        )
        or exists (
          select 1 from public.tenant_app_biometrics ab
          where ab.user_id = caller_id
            and ab.room_id = caller_room
            and ab.occupant_id = ro.id
            and ab.is_active = true
        )
      )
  ) into has_biometric;

  return query select current_pin_generation, has_biometric;
end;
$function$;

create or replace function public.verify_tenant_app_lock_pin(input_pin_hash text)
returns table (pin_generation bigint)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  caller_room uuid;
  current_pin_hash text;
  current_pin_generation bigint;
begin
  if caller_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if input_pin_hash is null or input_pin_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'PIN_REQUIRED';
  end if;

  select p.role, p.room_id
  into caller_role, caller_room
  from public.profiles p
  where p.id = caller_id and p.is_active = true;

  if caller_role is distinct from 'TENANT' then raise exception 'TENANT_ONLY'; end if;
  if caller_room is null then raise exception 'TENANT_ROOM_NOT_FOUND'; end if;

  select c.pin_hash, c.pin_auth_generation
  into current_pin_hash, current_pin_generation
  from public.door_keypad_configs c
  join public.devices d on d.id = c.device_id
  where d.device_code = 'ESP-MAIN-DOOR'
  limit 1;

  if current_pin_hash is null or current_pin_generation is null then
    raise exception 'PIN_CONFIG_NOT_FOUND';
  end if;
  if input_pin_hash <> current_pin_hash then raise exception 'INVALID_PIN'; end if;

  return query select current_pin_generation;
end;
$function$;

create or replace function public.register_tenant_app_biometric(target_occupant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  caller_room uuid;
begin
  if caller_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select p.role, p.room_id
  into caller_role, caller_room
  from public.profiles p
  where p.id = caller_id and p.is_active = true;

  if caller_role is distinct from 'TENANT' then raise exception 'TENANT_ONLY'; end if;
  if caller_room is null then raise exception 'TENANT_ROOM_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.room_occupants ro
    where ro.id = target_occupant_id
      and ro.room_id = caller_room
      and ro.is_active = true
  ) then raise exception 'OCCUPANT_NOT_IN_ROOM'; end if;

  insert into public.tenant_app_biometrics (user_id, room_id, occupant_id, is_active, updated_at)
  values (caller_id, caller_room, target_occupant_id, true, now())
  on conflict (user_id, occupant_id) do update
  set room_id = excluded.room_id, is_active = true, updated_at = now();

  return true;
end;
$function$;

create or replace function public.get_tenant_app_biometric_occupants()
returns table (occupant_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  caller_room uuid;
begin
  if caller_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select p.role, p.room_id into caller_role, caller_room
  from public.profiles p where p.id = caller_id and p.is_active = true;
  if caller_role is distinct from 'TENANT' then raise exception 'TENANT_ONLY'; end if;
  if caller_room is null then raise exception 'TENANT_ROOM_NOT_FOUND'; end if;

  return query
  select ab.occupant_id
  from public.tenant_app_biometrics ab
  join public.room_occupants ro on ro.id = ab.occupant_id
  where ab.user_id = caller_id
    and ab.room_id = caller_room
    and ab.is_active = true
    and ro.is_active = true;
end;
$function$;

revoke all on function public.get_tenant_app_lock_status() from public, anon;
revoke all on function public.verify_tenant_app_lock_pin(text) from public, anon;
revoke all on function public.register_tenant_app_biometric(uuid) from public, anon;
revoke all on function public.get_tenant_app_biometric_occupants() from public, anon;
grant execute on function public.get_tenant_app_lock_status() to authenticated;
grant execute on function public.verify_tenant_app_lock_pin(text) to authenticated;
grant execute on function public.register_tenant_app_biometric(uuid) to authenticated;
grant execute on function public.get_tenant_app_biometric_occupants() to authenticated;

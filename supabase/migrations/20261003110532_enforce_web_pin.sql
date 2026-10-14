drop function if exists public.request_remote_door_open(uuid, text);

create function public.request_remote_door_open(
  target_device_id uuid,
  command_source text default 'WEB',
  pin_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid;
  caller_role text;
  caller_room uuid;
  command_id uuid;
  actual_source text;
  expected_pin_hash text;
begin  caller_id := auth.uid();

  if caller_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.role, p.room_id
  into caller_role, caller_room
  from public.profiles p
  where p.id = caller_id
    and p.is_active = true;

  if caller_role is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if caller_role = 'ADMIN' then
    actual_source := 'ADMIN';
  elsif command_source = 'WEB_PIN' then
    actual_source := 'WEB_PIN';
  elsif command_source = 'PHONE_BIOMETRIC' then
    actual_source := 'PHONE_BIOMETRIC';
  else
    raise exception 'INVALID_COMMAND_SOURCE';
  end if;  if caller_role = 'CAMERA' then
    raise exception 'CAMERA_ACCOUNT_CANNOT_OPEN_DOOR';
  end if;

  if caller_role = 'TENANT' then
    if caller_room is null then
      raise exception 'TENANT_ROOM_NOT_FOUND';
    end if;

    if actual_source = 'WEB_PIN' then
      if pin_hash is null or pin_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'PIN_REQUIRED';
      end if;

      select c.pin_hash
      into expected_pin_hash
      from public.door_keypad_configs c
      where c.device_id = target_device_id
      limit 1;

      if expected_pin_hash is null then
        raise exception 'PIN_CONFIG_NOT_FOUND';
      end if;

      if pin_hash <> expected_pin_hash then
        insert into public.access_logs (
          user_id,
          tenant_id,
          room_id,
          device_id,
          person_name,
          room_number,
          method,
          result
        )        select
          caller_id,
          caller_id,
          caller_room,
          target_device_id,
          p.full_name,
          null,
          'WEB_PIN',
          'FAILED'
        from public.profiles p
        where p.id = caller_id;

        raise exception 'INVALID_PIN';
      end if;
    end if;
  elsif caller_role <> 'ADMIN' then
    raise exception 'UNAUTHORIZED_ROLE';
  end if;

  if caller_role = 'TENANT'
     and not public.room_has_active_occupants(caller_room) then
    insert into public.door_commands (
      device_id,
      user_id,
      command,
      source,
      status,
      block_reason
    )
    values (
      target_device_id,
      caller_id,
      'OPEN',
      actual_source,
      'BLOCKED',
      'ROOM_EMPTY'
    )
    returning id into command_id;

    raise exception 'ROOM_EMPTY';
  end if;  insert into public.door_commands (
    device_id,
    user_id,
    command,
    source,
    status
  )
  values (
    target_device_id,
    caller_id,
    'OPEN',
    case when caller_role = 'ADMIN' then 'ADMIN' else actual_source end,
    'PENDING'
  )
  returning id into command_id;

  return command_id;
end;
$function$;

revoke all on function public.request_remote_door_open(uuid, text, text) from public;
grant execute on function public.request_remote_door_open(uuid, text, text) to authenticated;

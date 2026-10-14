-- Face recognition v2: keep old data, harden the write path.
-- No DELETE/TRUNCATE/RESET of biometric data is performed.

DROP POLICY IF EXISTS "face_credentials_camera_select" ON public.face_credentials;
DROP POLICY IF EXISTS "face_credentials_camera_insert" ON public.face_credentials;

REVOKE EXECUTE
  ON FUNCTION public.request_face_door_open(uuid, uuid, real)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE
  ON FUNCTION public.save_face_credential(
    uuid, uuid, uuid, uuid, text, public.vector
  )
  FROM PUBLIC, anon;

GRANT EXECUTE
  ON FUNCTION public.save_face_credential(
    uuid, uuid, uuid, uuid, text, public.vector
  )
  TO authenticated;

CREATE OR REPLACE FUNCTION public.save_face_credential(
  p_user_id uuid,
  p_room_id uuid,
  p_camera_id uuid,
  p_enrollment_session_id uuid,
  p_angle text,
  p_embedding public.vector
)
RETURNS TABLE(id uuid, angle text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_role text;
  v_session public.face_enrollment_sessions%rowtype;
  v_camera_owner uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_embedding is null
     or public.vector_dims(p_embedding) <> 128
     or public.vector_norm(p_embedding) <= 1e-12 then
    raise exception 'Embedding khuôn mặt không hợp lệ';
  end if;
  v_role := public.current_user_role();

  if v_role not in ('ADMIN', 'CAMERA') then
    raise exception 'Only ADMIN or CAMERA may save face credentials';
  end if;

  if p_angle not in ('STRAIGHT', 'LEFT', 'RIGHT') then
    raise exception 'Invalid face angle';
  end if;

  select *
    into v_session
  from public.face_enrollment_sessions s
  where s.id = p_enrollment_session_id
  for update;

  if not found then
    raise exception 'Enrollment session not found';
  end if;

  if v_session.user_id <> p_user_id
     or v_session.room_id <> p_room_id
     or v_session.camera_id <> p_camera_id then
    raise exception 'Enrollment data does not match session';
  end if;

  if v_session.status not in ('PENDING', 'CAPTURING') then
    raise exception 'Enrollment session is not active';
  end if;

  if v_session.expires_at <= now() then
    raise exception 'Enrollment session has expired';
  end if;

  select c.user_id
    into v_camera_owner
  from public.camera_devices c
  where c.id = p_camera_id;
  if not found then
    raise exception 'Camera not found';
  end if;

  if v_role = 'CAMERA' and v_camera_owner <> (select auth.uid()) then
    raise exception 'Camera account does not own this camera';
  end if;

  if v_role = 'ADMIN' and v_session.created_by is distinct from (select auth.uid()) then
    raise exception 'Admin did not create this enrollment session';
  end if;

  if exists (
    select 1
    from public.face_credentials fc
    where fc.enrollment_session_id = p_enrollment_session_id
      and fc.angle = p_angle
  ) then
    raise exception 'This face angle has already been captured';
  end if;

  return query
  insert into public.face_credentials (
    user_id,
    room_id,
    camera_id,
    enrollment_session_id,
    angle,
    embedding,
    model_version,
    status
  )
  values (
    p_user_id,
    p_room_id,
    p_camera_id,
    p_enrollment_session_id,
    p_angle,
    public.l2_normalize(p_embedding),
    'MobileFaceNet-128-v2',
    'PENDING'
  )
  returning face_credentials.id, face_credentials.angle, face_credentials.status;
end;
$function$;

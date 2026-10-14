-- Face recognition v3: bind enrollment and credentials to room occupants.
-- Existing face data was intentionally cleared before this migration.

BEGIN;

DROP FUNCTION IF EXISTS public.save_face_credential(uuid, uuid, uuid, uuid, text, vector);
DROP FUNCTION IF EXISTS public.request_face_door_open(uuid, uuid, real);

ALTER TABLE public.face_enrollment_sessions
  DROP COLUMN user_id,
  DROP COLUMN room_id,
  ADD COLUMN occupant_id uuid NOT NULL REFERENCES public.room_occupants(id) ON DELETE CASCADE;

ALTER TABLE public.face_credentials
  DROP COLUMN user_id,
  DROP COLUMN room_id,
  ADD COLUMN occupant_id uuid NOT NULL REFERENCES public.room_occupants(id) ON DELETE CASCADE;

ALTER TABLE public.door_commands
  ADD COLUMN IF NOT EXISTS occupant_id uuid REFERENCES public.room_occupants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_face_enrollment_sessions_occupant
  ON public.face_enrollment_sessions(occupant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_face_credentials_occupant_camera_active
  ON public.face_credentials(occupant_id, camera_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_face_credentials_camera_model_active
  ON public.face_credentials(camera_id, model_version)
  WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION public.save_face_credential(
  p_occupant_id uuid,
  p_camera_id uuid,
  p_enrollment_session_id uuid,
  p_angle text,
  p_embedding vector(128)
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
  v_occupant public.room_occupants%rowtype;
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
    into v_occupant
  from public.room_occupants o
  where o.id = p_occupant_id
    and o.is_active = true;

  if not found then
    raise exception 'Người ở không tồn tại hoặc đã ngừng hoạt động';
  end if;

  select *
    into v_session
  from public.face_enrollment_sessions s
  where s.id = p_enrollment_session_id
  for update;

  if not found then
    raise exception 'Enrollment session not found';
  end if;

  if v_session.occupant_id <> p_occupant_id
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
    occupant_id,
    camera_id,
    enrollment_session_id,
    angle,
    embedding,
    model_version,
    status
  )
  values (
    p_occupant_id,
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

REVOKE EXECUTE ON FUNCTION public.save_face_credential(uuid, uuid, uuid, text, vector) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_face_credential(uuid, uuid, uuid, text, vector) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_face_credential(uuid, uuid, uuid, text, vector) TO authenticated;

COMMIT;

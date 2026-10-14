-- Canonical local schema derived from Supabase project dbfewoprssgqaqgunvbo.
-- IMPORTANT: This file is local only. It does not modify the remote project.
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists vector;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  floor integer not null,
  status text not null default 'EMPTY' check (status in ('EMPTY','OCCUPIED')),
  max_occupants integer not null default 3 check (max_occupants between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id),
  room_id uuid references public.rooms(id),
  username text not null unique,
  email text not null unique,
  role text not null check (role in ('ADMIN','TENANT','CAMERA')),
  full_name text not null default '',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_occupants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  full_name text not null,
  phone text,
  date_of_birth date,
  identity_number text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.biometric_credentials (
  id uuid primary key default gen_random_uuid(),
  occupant_id uuid not null references public.room_occupants(id),
  biometric_type text not null check (biometric_type in ('FINGERPRINT','FACE')),
  template_id integer,
  credential_id text,
  device_id uuid,
  credential_data jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  device_code text not null unique,
  device_type text not null,
  location text,
  online boolean not null default false,
  last_seen timestamptz,
  firmware_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.door_states (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique references public.devices(id),
  door_status text not null default 'CLOSED' check (door_status in ('OPEN','CLOSED')),
  lock_status text not null default 'LOCKED' check (lock_status in ('LOCKED','UNLOCKED')),
  alarm_status text not null default 'OFF' check (alarm_status in ('ON','OFF')),
  device_online boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.door_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id),
  user_id uuid references public.profiles(id),
  occupant_id uuid references public.room_occupants(id) on delete set null,
  command text not null check (command in ('OPEN','LOCK','UNLOCK','CLOSE')),
  source text not null check (source in ('WEB','WEB_PIN','PHONE_BIOMETRIC','BIOMETRIC','KEYPAD','SYSTEM','ADMIN','FACE')),
  status text not null default 'PENDING' check (status in ('PENDING','SENT','SUCCESS','FAILED','BLOCKED')),
  block_reason text,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create table public.door_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id),
  event_type text not null check (event_type in ('DOOR_OPEN','DOOR_CLOSE','LOCK','UNLOCK','ALARM_ON','ALARM_OFF','DEVICE_ONLINE','DEVICE_OFFLINE','ACCESS_GRANTED','ACCESS_DENIED')),
  source text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  room_id uuid references public.rooms(id),
  occupant_id uuid references public.room_occupants(id),
  device_id uuid references public.devices(id),
  person_name text,
  room_number text,
  method text not null check (method in ('KEYPAD','WEB_PIN','PHONE_BIOMETRIC','FINGERPRINT','FACE','PASSKEY','ADMIN')),
  result text not null check (result in ('SUCCESS','FAILED','BLOCKED')),
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.camera_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id),
  device_name text not null,
  camera_type text not null default 'WEB_CAMERA' check (camera_type in ('WEB_CAMERA','USB_CAMERA','IP_CAMERA')),
  online boolean not null default false,
  streaming boolean not null default false,
  person_detected boolean not null default false,
  person_count integer not null default 0 check (person_count >= 0),
  detection_confidence numeric check (detection_confidence is null or detection_confidence between 0 and 1),
  stream_id text unique,
  last_seen timestamptz,
  last_detection_at timestamptz,
  detection_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.camera_sessions (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.camera_devices(id),
  session_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  is_active boolean not null default true
);

create table public.camera_detections (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references public.camera_devices(id),
  person_detected boolean not null,
  person_count integer not null default 0 check (person_count >= 0),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  bounding_boxes jsonb,
  detected_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  title text not null,
  message text not null,
  type text not null default 'INFO' check (type in ('INFO','SUCCESS','WARNING','ERROR')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  session_identifier text not null,
  device_name text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  credential_id text not null,
  public_key text not null,
  counter bigint not null default 0,
  device_type text,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  challenge text not null,
  challenge_type text not null check (challenge_type in ('REGISTRATION','AUTHENTICATION')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.face_enrollment_sessions (
  id uuid primary key default gen_random_uuid(),
  occupant_id uuid not null references public.room_occupants(id) on delete cascade,
  camera_id uuid not null references public.camera_devices(id),
  status text not null default 'PENDING' check (status in ('PENDING','CAPTURING','COMPLETED','APPROVED','EXPIRED')),
  expected_samples smallint not null default 3 check (expected_samples = 3),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id)
);

create table public.face_credentials (
  id uuid primary key default gen_random_uuid(),
  occupant_id uuid not null references public.room_occupants(id) on delete cascade,
  camera_id uuid not null references public.camera_devices(id),
  enrollment_session_id uuid not null references public.face_enrollment_sessions(id),
  angle text not null check (angle in ('STRAIGHT','LEFT','RIGHT')),
  embedding vector(128) not null,
  model_version text not null default 'MobileFaceNet-128-v2',
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_face_credentials_embedding on public.face_credentials using hnsw (embedding vector_cosine_ops);

alter table public.rooms enable row level security;
alter table public.profiles enable row level security;
alter table public.room_occupants enable row level security;
alter table public.biometric_credentials enable row level security;
alter table public.devices enable row level security;
alter table public.door_states enable row level security;
alter table public.door_commands enable row level security;
alter table public.door_events enable row level security;
alter table public.access_logs enable row level security;
alter table public.camera_devices enable row level security;
alter table public.camera_sessions enable row level security;
alter table public.camera_detections enable row level security;
alter table public.notifications enable row level security;
alter table public.app_sessions enable row level security;
alter table public.webauthn_credentials enable row level security;
alter table public.webauthn_challenges enable row level security;
alter table public.face_enrollment_sessions enable row level security;
alter table public.face_credentials enable row level security;


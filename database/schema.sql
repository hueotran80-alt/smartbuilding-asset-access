-- =========================================================
-- SMART BUILDING LOCK
-- DATABASE SCHEMA
-- PostgreSQL / Supabase
--
-- AUTHENTICATION:
--   1. KEYPAD
--   2. WEB_PIN
--   3. PHONE_BIOMETRIC / PASSKEY
--
-- R558S / fingerprint sensor đã được loại bỏ.
-- =========================================================

create extension if not exists "pgcrypto";


-- =========================================================
-- 1. PROFILES
-- =========================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,

    username text not null unique,

    email text not null unique,

    full_name text not null,

    role text not null
        check (role in ('ADMIN', 'TENANT')),

    phone text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


-- =========================================================
-- 2. ROOMS
-- =========================================================

create table if not exists public.rooms (
    id uuid primary key default gen_random_uuid(),

    room_number text not null unique,

    floor integer not null,

    status text not null default 'EMPTY'
        check (status in ('EMPTY', 'RENTED')),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


-- =========================================================
-- 3. TENANTS
--
-- KHÔNG CÒN:
--   fingerprint_id
--   fingerprint_registered
--
-- WebAuthn credential được lưu riêng trong
-- webauthn_credentials.
-- =========================================================

create table if not exists public.tenants (
    id uuid primary key default gen_random_uuid(),

    user_id uuid references public.profiles(id)
        on delete set null,

    room_id uuid not null references public.rooms(id)
        on delete cascade,

    full_name text not null,

    phone text,

    email text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique(user_id)
);


-- =========================================================
-- 4. DEVICES
-- =========================================================

create table if not exists public.devices (
    id uuid primary key default gen_random_uuid(),

    device_code text not null unique,

    device_type text not null,

    location text not null,

    online boolean not null default false,

    last_seen timestamptz,

    firmware_version text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


-- =========================================================
-- 5. DOOR STATES
-- =========================================================

create table if not exists public.door_states (
    id uuid primary key default gen_random_uuid(),

    device_id uuid not null references public.devices(id)
        on delete cascade,

    door_status text not null default 'CLOSED'
        check (door_status in ('OPEN', 'CLOSED')),

    lock_status text not null default 'LOCKED'
        check (lock_status in ('LOCKED', 'UNLOCKED')),

    alarm_status text not null default 'OFF'
        check (alarm_status in ('ON', 'OFF')),

    device_online boolean not null default false,

    updated_at timestamptz not null default now(),

    unique(device_id)
);


-- =========================================================
-- 6. ACCESS LOGS
--
-- PHƯƠNG THỨC MỞ CỬA:
--
-- KEYPAD
-- WEB_PIN
-- PHONE_BIOMETRIC
--
-- R558S ĐÃ LOẠI BỎ.
-- =========================================================

create table if not exists public.access_logs (
    id uuid primary key default gen_random_uuid(),

    user_id uuid references public.profiles(id)
        on delete set null,

    tenant_id uuid references public.tenants(id)
        on delete set null,

    room_id uuid references public.rooms(id)
        on delete set null,

    device_id uuid references public.devices(id)
        on delete set null,

    person_name text,

    room_number text,

    method text not null
        check (
            method in (
                'KEYPAD',
                'WEB_PIN',
                'PHONE_BIOMETRIC'
            )
        ),

    result text not null
        check (
            result in (
                'SUCCESS',
                'FAILED'
            )
        ),

    created_at timestamptz not null default now()
);


-- =========================================================
-- 7. NOTIFICATIONS
-- =========================================================

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),

    user_id uuid references public.profiles(id)
        on delete cascade,

    title text,

    message text not null,

    type text not null default 'INFO'
        check (
            type in (
                'INFO',
                'SUCCESS',
                'WARNING',
                'ERROR'
            )
        ),

    is_read boolean not null default false,

    created_at timestamptz not null default now()
);


-- =========================================================
-- 8. APP SESSIONS
-- =========================================================

create table if not exists public.app_sessions (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null references public.profiles(id)
        on delete cascade,

    session_identifier text not null unique,

    device_name text,

    ip_address inet,

    user_agent text,

    created_at timestamptz not null default now(),

    last_active_at timestamptz not null default now(),

    expires_at timestamptz,

    revoked_at timestamptz
);


-- =========================================================
-- 9. WEBAUTHN CREDENTIALS
--
-- Mỗi điện thoại/passkey có thể có một credential.
--
-- KHÔNG lưu vân tay.
-- KHÔNG lưu Face ID.
-- KHÔNG lưu PIN điện thoại.
--
-- Chỉ lưu:
--   credential_id
--   public_key
--   counter
-- =========================================================

create table if not exists public.webauthn_credentials (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null references public.profiles(id)
        on delete cascade,

    credential_id text not null unique,

    public_key text not null,

    counter bigint not null default 0,

    device_type text,

    transports text[],

    created_at timestamptz not null default now(),

    last_used_at timestamptz
);


-- =========================================================
-- 10. WEBAUTHN CHALLENGES
--
-- Challenge tồn tại tạm thời trong quá trình
-- đăng ký / xác thực Passkey.
-- =========================================================

create table if not exists public.webauthn_challenges (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null references public.profiles(id)
        on delete cascade,

    challenge text not null,

    challenge_type text not null
        check (
            challenge_type in (
                'REGISTRATION',
                'AUTHENTICATION'
            )
        ),

    expires_at timestamptz not null,

    created_at timestamptz not null default now()
);


-- =========================================================
-- INDEX
-- =========================================================

create index if not exists idx_tenants_room
on public.tenants(room_id);


create index if not exists idx_tenants_user
on public.tenants(user_id);


create index if not exists idx_access_logs_user
on public.access_logs(user_id);


create index if not exists idx_access_logs_room
on public.access_logs(room_id);


create index if not exists idx_access_logs_created
on public.access_logs(created_at desc);


create index if not exists idx_notifications_user
on public.notifications(user_id);


create index if not exists idx_sessions_user
on public.app_sessions(user_id);


create index if not exists idx_webauthn_credentials_user
on public.webauthn_credentials(user_id);


create index if not exists idx_webauthn_challenges_user
on public.webauthn_challenges(user_id);


create index if not exists idx_webauthn_challenges_expiry
on public.webauthn_challenges(expires_at);


-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


drop trigger if exists profiles_updated_at
on public.profiles;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.update_updated_at();


drop trigger if exists rooms_updated_at
on public.rooms;

create trigger rooms_updated_at
before update on public.rooms
for each row
execute function public.update_updated_at();


drop trigger if exists tenants_updated_at
on public.tenants;

create trigger tenants_updated_at
before update on public.tenants
for each row
execute function public.update_updated_at();


drop trigger if exists devices_updated_at
on public.devices;

create trigger devices_updated_at
before update on public.devices
for each row
execute function public.update_updated_at();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles
enable row level security;

alter table public.rooms
enable row level security;

alter table public.tenants
enable row level security;

alter table public.devices
enable row level security;

alter table public.door_states
enable row level security;

alter table public.access_logs
enable row level security;

alter table public.notifications
enable row level security;

alter table public.app_sessions
enable row level security;

alter table public.webauthn_credentials
enable row level security;

alter table public.webauthn_challenges
enable row level security;


-- =========================================================
-- HELPER FUNCTION
-- =========================================================

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
    select role
    from public.profiles
    where id = auth.uid();
$$;


-- =========================================================
-- PROFILES POLICIES
-- =========================================================

drop policy if exists profiles_select_own
on public.profiles;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.current_user_role() = 'ADMIN'
);


drop policy if exists profiles_admin_update
on public.profiles;

create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (
    public.current_user_role() = 'ADMIN'
);


-- =========================================================
-- ROOMS POLICIES
-- =========================================================

drop policy if exists rooms_authenticated_select
on public.rooms;

create policy rooms_authenticated_select
on public.rooms
for select
to authenticated
using (true);


drop policy if exists rooms_admin_insert
on public.rooms;

create policy rooms_admin_insert
on public.rooms
for insert
to authenticated
with check (
    public.current_user_role() = 'ADMIN'
);


drop policy if exists rooms_admin_update
on public.rooms;

create policy rooms_admin_update
on public.rooms
for update
to authenticated
using (
    public.current_user_role() = 'ADMIN'
);


drop policy if exists rooms_admin_delete
on public.rooms;

create policy rooms_admin_delete
on public.rooms
for delete
to authenticated
using (
    public.current_user_role() = 'ADMIN'
);


-- =========================================================
-- TENANTS POLICIES
-- =========================================================

drop policy if exists tenants_admin_all
on public.tenants;

create policy tenants_admin_all
on public.tenants
for all
to authenticated
using (
    public.current_user_role() = 'ADMIN'
)
with check (
    public.current_user_role() = 'ADMIN'
);


drop policy if exists tenants_own_select
on public.tenants;

create policy tenants_own_select
on public.tenants
for select
to authenticated
using (
    user_id = auth.uid()
);


-- =========================================================
-- DEVICES POLICIES
-- =========================================================

drop policy if exists devices_authenticated_select
on public.devices;

create policy devices_authenticated_select
on public.devices
for select
to authenticated
using (true);


drop policy if exists devices_admin_all
on public.devices;

create policy devices_admin_all
on public.devices
for all
to authenticated
using (
    public.current_user_role() = 'ADMIN'
)
with check (
    public.current_user_role() = 'ADMIN'
);


-- =========================================================
-- DOOR STATES POLICIES
-- =========================================================

drop policy if exists door_states_authenticated_select
on public.door_states;

create policy door_states_authenticated_select
on public.door_states
for select
to authenticated
using (true);


drop policy if exists door_states_admin_update
on public.door_states;

create policy door_states_admin_update
on public.door_states
for update
to authenticated
using (
    public.current_user_role() = 'ADMIN'
);


-- =========================================================
-- ACCESS LOG POLICIES
-- =========================================================

drop policy if exists access_logs_admin_select
on public.access_logs;

create policy access_logs_admin_select
on public.access_logs
for select
to authenticated
using (
    public.current_user_role() = 'ADMIN'
);


drop policy if exists access_logs_own_select
on public.access_logs;

create policy access_logs_own_select
on public.access_logs
for select
to authenticated
using (
    user_id = auth.uid()
);


drop policy if exists access_logs_authenticated_insert
on public.access_logs;

create policy access_logs_authenticated_insert
on public.access_logs
for insert
to authenticated
with check (
    user_id = auth.uid()
);


-- =========================================================
-- NOTIFICATIONS POLICIES
-- =========================================================

drop policy if exists notifications_own_select
on public.notifications;

create policy notifications_own_select
on public.notifications
for select
to authenticated
using (
    user_id = auth.uid()
    or public.current_user_role() = 'ADMIN'
);


drop policy if exists notifications_own_update
on public.notifications;

create policy notifications_own_update
on public.notifications
for update
to authenticated
using (
    user_id = auth.uid()
);


-- =========================================================
-- SESSIONS POLICIES
-- =========================================================

drop policy if exists sessions_own_select
on public.app_sessions;

create policy sessions_own_select
on public.app_sessions
for select
to authenticated
using (
    user_id = auth.uid()
);


drop policy if exists sessions_own_insert
on public.app_sessions;

create policy sessions_own_insert
on public.app_sessions
for insert
to authenticated
with check (
    user_id = auth.uid()
);


drop policy if exists sessions_own_update
on public.app_sessions;

create policy sessions_own_update
on public.app_sessions
for update
to authenticated
using (
    user_id = auth.uid()
);


-- =========================================================
-- WEBAUTHN CREDENTIAL POLICIES
--
-- Frontend KHÔNG được tự ghi credential.
-- Edge Function dùng service role để xử lý.
-- =========================================================

drop policy if exists webauthn_credentials_own_select
on public.webauthn_credentials;

create policy webauthn_credentials_own_select
on public.webauthn_credentials
for select
to authenticated
using (
    user_id = auth.uid()
);


-- =========================================================
-- WEBAUTHN CHALLENGES
--
-- Không cho frontend truy cập trực tiếp.
-- Edge Function service role xử lý.
-- =========================================================


-- =========================================================
-- REALTIME
-- =========================================================

alter table public.door_states
replica identity full;

alter table public.access_logs
replica identity full;

alter table public.notifications
replica identity full;


-- =========================================================
-- SUPABASE REALTIME PUBLICATION
-- =========================================================

do $$
begin

    begin
        alter publication supabase_realtime
        add table public.door_states;
    exception
        when duplicate_object then null;
    end;

    begin
        alter publication supabase_realtime
        add table public.access_logs;
    exception
        when duplicate_object then null;
    end;

    begin
        alter publication supabase_realtime
        add table public.notifications;
    exception
        when duplicate_object then null;
    end;

end
$$;
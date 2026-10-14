-- Seed/demo data. Run after schema.sql.
-- Account passwords are intentionally NOT seeded here; create users through Supabase Auth.
insert into public.rooms (room_number, floor, status) values
('101',1,'RENTED'),('102',1,'EMPTY'),('201',2,'RENTED'),('202',2,'EMPTY'),
('301',3,'EMPTY'),('302',3,'EMPTY')
on conflict (room_number) do nothing;

insert into public.devices (device_uid, device_type, online, firmware_version)
values ('ESP-MAIN-DOOR','MAIN_DOOR',false,'0.1.0')
on conflict (device_uid) do nothing;

insert into public.main_door_state(id,door,lock,alarm,device_online)
values(true,'CLOSED','LOCKED','OFF',false)
on conflict(id) do update set door=excluded.door, lock=excluded.lock, alarm=excluded.alarm;

-- Tenants and profiles should be created after Auth users exist.
-- Example:
-- insert into public.profiles(id,full_name,role) values('<AUTH_USER_UUID>','Nguyễn Văn An','TENANT');
-- insert into public.tenants(room_id,user_id,full_name,phone,email)
-- select id,'<AUTH_USER_UUID>','Nguyễn Văn An','0900000001',null
-- from public.rooms where room_number='101';

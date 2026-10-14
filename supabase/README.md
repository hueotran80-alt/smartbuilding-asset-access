# Supabase

Schema/seed chính đã được chuyển sang:
- `database/schema.sql`
- `database/seed.sql`

Frontend dùng Supabase Auth + Realtime khi có `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.

Remote unlock không được thực hiện bằng client-side update trực tiếp; hãy triển khai API/Edge Function bảo vệ bằng JWT và MQTT command/ACK.

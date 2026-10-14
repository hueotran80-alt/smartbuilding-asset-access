# Authentication & authorization

- Supabase Auth quản lý tài khoản và refresh/access session.
- `profiles.role`: ADMIN hoặc TENANT.
- TENANT chỉ được điều khiển cửa chính nếu thuộc tenant đang ACTIVE.
- ADMIN quản lý phòng/người thuê nhưng UI không có thao tác mở cửa.
- Không lưu access/refresh token thô trong bảng ứng dụng.
- Nếu cần audit session, lưu session_id/hash + created_at + last_seen_at + revoked_at + metadata.

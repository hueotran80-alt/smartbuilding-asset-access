# API

Production nên dùng API/Edge Function cho các thao tác nhạy cảm.

Endpoints đề xuất:
- `POST /api/auth/session` – quản lý phiên phía server nếu cần.
- `GET /api/door/state` – đọc trạng thái cửa.
- `POST /api/door/unlock` – yêu cầu mở cửa từ mobile/web tenant.
- `POST /api/devices/heartbeat` – ESP heartbeat.
- `POST /api/devices/events` – event từ ESP.
- `GET /api/access-logs` – nhật ký theo quyền.

Remote unlock bắt buộc:
JWT -> TENANT -> tenant được phép -> device online -> publish command -> chờ ACK -> ghi access_log.

Không đặt service-role key trong frontend.

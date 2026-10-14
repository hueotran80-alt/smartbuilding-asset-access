# MQTT

Topic đề xuất:
- `building/door/main/state`
- `building/door/main/events`
- `building/door/main/command`
- `building/door/main/ack`
- `building/door/main/heartbeat`

Khuyến nghị:
- TLS
- username/password hoặc client certificate
- ACL để ESP chỉ publish/subscribe đúng topic
- command có `request_id`, `issued_at`, `expires_at`
- chống replay bằng nonce/request_id + TTL

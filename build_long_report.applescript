tell application "Pages"
activate
set d to make new document
tell d
set body text to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/00_cover.txt") as «class utf8»)
tell body text
set font to "Times New Roman"
set size to 12
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/00_intro.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
make new section
set body text of last section to "MỤC LỤC

"
tell body text of last section
set font to "Times New Roman"
set size to 11
end tell
end tell

tell d
set body text of section 3 to "MỤC LỤC\n\n1.1. Phân rã bài toán kiểm soát ra vào\n1.2. Yêu cầu chức năng của hệ thống\n1.3. Yêu cầu phi chức năng\n1.4. Mô hình tác nhân và quyền hạn\n1.5. Phân tích luồng dữ liệu end-to-end\n1.6. Phạm vi phần cứng và phần mềm\n1.7. Các rủi ro kỹ thuật\n1.8. Nguyên tắc thiết kế hệ thống\n2.1. Lựa chọn ESP8266\n2.2. Phân bổ chân GPIO\n2.3. Nguyên lý quét keypad 4x4\n2.4. Lưu cấu hình bằng EEPROM\n2.5. Băm PIN bằng SHA-256\n2.6. Điều khiển relay\n2.7. Thiết kế an toàn điện cho khóa\n2.8. Máy trạng thái LOCKED/UNLOCKED\n2.9. Tham số thời gian mở khóa\n3.1. Kiến trúc MQTT\n3.2. Quy ước topic\n3.3. Thiết kế payload lệnh\n3.4. QoS và retain\n3.5. Cơ chế reconnect Wi-Fi\n3.6. Cơ chế reconnect MQTT\n3.7. MQTT bridge Node.js\n3.8. Mô hình dữ liệu Supabase\n3.9. RLS và phân quyền dữ liệu\n3.10. Luồng ghi nhật ký truy cập\n4.1. Trình tự khởi động ESP8266\n4.2. Khởi tạo cấu hình mặc định\n4.3. Luồng mở cửa bằng keypad\n4.4. Xử lý PIN sai\n4.5. Luồng nhận lệnh MQTT\n4.6. Tự khóa sau 10 giây\n4.7. Xử lý mất mạng trong trạng thái mở\n4.8. Cập nhật cấu hình keypad\n4.9. Xử lý lỗi và khôi phục\n4.10. Đánh giá khả năng mở rộng firmware\n5.1. Luồng đăng nhập tài khoản\n5.2. WebAuthn và passkey\n5.3. Không lưu dữ liệu sinh trắc học thô\n5.4. Phân quyền mở cửa\n5.5. Gửi lệnh từ Web\n5.6. Đồng bộ Android\n5.7. Supabase Realtime\n5.8. Phản hồi âm thanh và trạng thái\n5.9. Phiên và nhật ký\n6.1. Kiến trúc camera IoT\n6.2. Signaling qua Supabase Broadcast\n6.3. SDP offer/answer\n6.4. ICE candidate\n6.5. STUN\n6.6. TURN\n6.7. Cơ chế viewer-request lặp lại\n6.8. Face AI và chống spam\n6.9. Đánh giá camera liên mạng\n7.1. Chiến lược kiểm thử theo lớp\n7.2. Kiểm thử keypad\n7.3. Kiểm thử relay và auto-lock\n7.4. Kiểm thử MQTT\n7.5. Kiểm thử database và RLS\n7.6. Kiểm thử WebAuthn\n7.7. Kiểm thử Web/Android\n7.8. Kiểm thử WebRTC\n7.9. Kiểm thử bảo mật và giới hạn\n8.1. Kết quả triển khai phần nhúng\n8.2. Kết quả triển khai backend\n8.3. Kết quả xác thực đa lớp\n8.4. Kết quả giám sát camera\n8.5. Đánh giá tính nhất quán kiến trúc\n8.6. Đánh giá hiệu năng và độ tin cậy\n8.7. Hạn chế hiện tại\n8.8. Lộ trình phát triển\nPHỤ LỤC 1 — CẤU TRÚC FIRMWARE\nPHỤ LỤC 2 — DANH MỤC TOPIC MQTT\nPHỤ LỤC 3 — CẤU TRÚC DỮ LIỆU\nPHỤ LỤC 4 — MA TRẬN KIỂM THỬ\nPHỤ LỤC 5 — PHÂN TÍCH SỰ CỐ\nPHỤ LỤC 6 — HƯỚNG DẪN NGHIỆM THU"
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/01.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/02.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/03.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/04.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/05.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/06.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/07.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/08.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/09.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/10.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/11.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/12.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to "HÌNH 1. KIẾN TRÚC TỔNG THỂ HỆ THỐNG"
tell body text of last section
set font to "Times New Roman"
set size to 14
end tell
tell current page
set im to make new image with properties {file:(POSIX file "/Users/trantuan/vercel-recovery/recovered-project/drawio/png2/01_kien_truc_he_thong.png"), width:500, position:{50,150}}
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/13.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/14.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/15.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/16.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/17.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/18.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/19.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/20.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/21.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/22.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to "HÌNH 2. LUỒNG MỞ CỬA TỪ YÊU CẦU ĐẾN RELAY"
tell body text of last section
set font to "Times New Roman"
set size to 14
end tell
tell current page
set im to make new image with properties {file:(POSIX file "/Users/trantuan/vercel-recovery/recovered-project/drawio/png2/02_luong_mo_cua.png"), width:500, position:{50,150}}
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/23.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/24.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/25.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/26.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/27.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/28.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/29.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/30.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/31.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/32.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to "HÌNH 3. LUỒNG HOẠT ĐỘNG FIRMWARE ESP8266"
tell body text of last section
set font to "Times New Roman"
set size to 14
end tell
tell current page
set im to make new image with properties {file:(POSIX file "/Users/trantuan/vercel-recovery/recovered-project/drawio/png2/03_luong_esp8266.png"), width:500, position:{50,150}}
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/33.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/34.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/35.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/36.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/37.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/38.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/39.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/40.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/41.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/42.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/43.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/44.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to "HÌNH 4. LUỒNG XÁC THỰC WEBAUTHN/PASSKEY"
tell body text of last section
set font to "Times New Roman"
set size to 14
end tell
tell current page
set im to make new image with properties {file:(POSIX file "/Users/trantuan/vercel-recovery/recovered-project/drawio/png2/04_webauthn.png"), width:500, position:{50,150}}
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/45.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/46.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/47.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/48.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/49.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/50.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/51.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/52.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/53.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/54.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/55.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/56.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to "HÌNH 5. LUỒNG SIGNALING VÀ ICE CỦA WEBRTC"
tell body text of last section
set font to "Times New Roman"
set size to 14
end tell
tell current page
set im to make new image with properties {file:(POSIX file "/Users/trantuan/vercel-recovery/recovered-project/drawio/png2/05_webrtc.png"), width:500, position:{50,150}}
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/57.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/58.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/59.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/60.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/61.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/62.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/63.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/64.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/65.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/66.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to "HÌNH 6. LUỒNG ĐỒNG BỘ TRẠNG THÁI REALTIME"
tell body text of last section
set font to "Times New Roman"
set size to 14
end tell
tell current page
set im to make new image with properties {file:(POSIX file "/Users/trantuan/vercel-recovery/recovered-project/drawio/png2/06_realtime.png"), width:500, position:{50,150}}
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/67.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/68.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/69.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/70.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/71.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/72.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/73.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/74.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/75.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/76.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/77.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
make new section
set body text of last section to (read (POSIX file "/Users/trantuan/vercel-recovery/recovered-project/report_sections/78.txt") as «class utf8»)
tell body text of last section
set font to "Times New Roman"
set size to 12
end tell
tell first paragraph of body text of last section
set font to "Times New Roman"
set size to 16
end tell
end tell

tell d
save d in POSIX file "/Users/trantuan/vercel-recovery/recovered-project/Bao_cao_Nhung_IoT_HUNRE_2026_80trang.pages"
export d to POSIX file "/Users/trantuan/vercel-recovery/recovered-project/Bao_cao_Nhung_IoT_HUNRE_2026_80trang.docx" as Microsoft Word
export d to POSIX file "/Users/trantuan/vercel-recovery/recovered-project/Bao_cao_Nhung_IoT_HUNRE_2026_80trang.pdf" as PDF
set pageCount to count pages
return pageCount
end tell
end tell

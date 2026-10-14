TRƯỜNG ĐẠI HỌC TÀI NGUYÊN VÀ MÔI TRƯỜNG HÀ NỘI
KHOA CÔNG NGHỆ THÔNG TIN

BÁO CÁO BÀI TẬP LỚN
MÔN HỌC: NHÚNG VÀ IoT

XÂY DỰNG HỆ THỐNG QUẢN LÝ VÀ KIỂM SOÁT TRUY CẬP TÒA NHÀ THÔNG MINH TÍCH HỢP XÁC THỰC SINH TRẮC HỌC, GIÁM SÁT CAMERA VÀ ĐIỀU KHIỂN KHÓA

Nhóm sinh viên thực hiện:
1. Nguyễn Hữu Tùng
2. Nguyễn Quang Phúc
3. Nguyễn Đức Mạnh
4. Trần Xuân Hùng
5. Nguyễn Đình Đức

Lớp: ĐH13C5

GIẢNG VIÊN GIẢNG DẠY: ThS. Nguyễn Văn Hách

HÀ NỘI, 10/2026

# LỜI MỞ ĐẦU

Trong các mô hình tòa nhà hiện đại, kiểm soát người ra vào không còn chỉ là bài toán đóng và mở một cánh cửa. Một hệ thống thực tế cần xác định đúng người được phép truy cập, truyền yêu cầu tới thiết bị chấp hành, xác nhận trạng thái sau khi điều khiển và cung cấp khả năng giám sát từ xa. Khi các thành phần này được kết nối qua Internet, bài toán trở thành một hệ thống Internet of Things (IoT), trong đó thiết bị nhúng giữ vai trò trực tiếp tác động lên môi trường vật lý.

Đề tài của nhóm tập trung xây dựng một mô hình kiểm soát cửa thông minh sử dụng ESP8266 làm bộ điều khiển thiết bị. ESP8266 kết nối Wi-Fi, giao tiếp với hệ thống thông qua MQTT, điều khiển relay của khóa điện và xử lý bàn phím vật lý 4x4. Ở phía phần mềm, hệ thống sử dụng nền tảng Supabase để quản lý tài khoản, trạng thái thiết bị, nhật ký truy cập và đồng bộ dữ liệu thời gian thực. Người dùng có thể thao tác thông qua giao diện Web hoặc ứng dụng Android. Bên cạnh kiểm soát cửa, hệ thống còn tích hợp xác thực sinh trắc học/passkey trên thiết bị người dùng và camera WebRTC nhằm mở rộng khả năng giám sát.

Điểm trọng tâm của đề tài là mối liên hệ giữa thiết bị nhúng và nền tảng IoT. Web và Android được xem là lớp giao diện điều khiển, còn ESP8266, relay, keypad, kết nối Wi-Fi, MQTT, trạng thái cửa và quá trình phản hồi thiết bị là phần cốt lõi. Cách tiếp cận này phù hợp với mục tiêu của học phần Nhúng và IoT: từ một thiết bị vật lý có khả năng xử lý tín hiệu và điều khiển tải, xây dựng thành một nút IoT có thể giao tiếp, nhận lệnh, phát trạng thái và được giám sát từ xa.

Báo cáo trình bày từ cơ sở lý thuyết, yêu cầu, thiết kế kiến trúc, thiết kế phần cứng, lập trình ESP8266, giao tiếp MQTT, cơ chế xác thực, đồng bộ dữ liệu, camera WebRTC cho tới kiểm thử và đánh giá. Các sơ đồ luồng được chuẩn bị dưới dạng tệp draw.io đi kèm báo cáo để có thể tiếp tục chỉnh sửa khi cần.

# CHƯƠNG 1. TỔNG QUAN VỀ HỆ THỐNG IoT KIỂM SOÁT RA VÀO

## 1.1. Tổng quan về Internet of Things

Internet of Things là mô hình trong đó các thiết bị vật lý được kết nối với mạng để trao đổi dữ liệu, nhận lệnh và cung cấp trạng thái cho các hệ thống phần mềm. Khác với một ứng dụng chỉ xử lý dữ liệu trên máy tính, IoT tạo ra mối liên hệ hai chiều giữa thế giới vật lý và thế giới số.

Trong đề tài này, ESP8266 là nút thiết bị chính. Nó đọc trạng thái mạng, tiếp nhận thao tác từ keypad, thực hiện kiểm tra mã PIN, điều khiển relay và phát trạng thái khóa lên MQTT. Phía hệ thống máy chủ nhận dữ liệu và cung cấp thông tin cho Web/Android. Như vậy, hệ thống có thể được mô tả theo bốn lớp:

- Lớp thiết bị: ESP8266, keypad 4x4, relay và khóa điện.
- Lớp mạng: Wi-Fi và giao thức TCP/IP.
- Lớp giao tiếp IoT: MQTT, các topic lệnh, trạng thái và sự kiện.
- Lớp ứng dụng: Supabase, Web, Android và hệ thống giám sát camera.

Mô hình này cho phép tách biệt trách nhiệm. ESP8266 không cần biết giao diện đang được sử dụng là Web hay Android; nó chỉ cần hiểu các lệnh IoT đã quy ước. Ngược lại, giao diện người dùng không điều khiển trực tiếp chân GPIO mà gửi yêu cầu qua lớp trung gian.

## 1.2. IoT trong bài toán tòa nhà thông minh

Trong tòa nhà thông minh, kiểm soát ra vào là một trong những bài toán điển hình của IoT vì nó kết hợp cả cảm nhận, xử lý, truyền thông và tác động vật lý. Một yêu cầu mở cửa bắt đầu từ người dùng, nhưng kết quả cuối cùng phải xuất hiện ở một thiết bị thật: relay thay đổi trạng thái và khóa điện được kích hoạt.

Hệ thống của nhóm được xây dựng xoay quanh một cửa chính. Người dùng có thể xác thực bằng keypad vật lý, mã PIN trên Web/App hoặc sinh trắc học/passkey trên điện thoại tùy luồng được cấu hình. Khi yêu cầu hợp lệ được tạo, hệ thống chuyển lệnh tới thiết bị. ESP8266 thực hiện thao tác và phát lại trạng thái. Trạng thái đó tiếp tục được lưu và đồng bộ tới các giao diện.

Camera được xem là nhánh giám sát bổ sung. Camera không trực tiếp thay thế bộ điều khiển khóa mà cung cấp hình ảnh thời gian thực và dữ liệu nhận diện người. Cách tổ chức này tránh việc biến camera thành thành phần điều khiển duy nhất và vẫn giữ vai trò trung tâm của thiết bị nhúng.

## 1.3. Bài toán đặt ra

Bài toán kỹ thuật của đề tài gồm các yêu cầu chính:

1. ESP8266 phải kết nối được với mạng Wi-Fi.
2. Thiết bị phải duy trì kết nối MQTT hoặc có cơ chế tự kết nối lại.
3. Thiết bị phải nhận lệnh mở/khóa từ hệ thống.
4. Thiết bị phải điều khiển relay theo đúng trạng thái.
5. Thiết bị phải tự khóa lại sau khoảng thời gian mở đã cấu hình.
6. Keypad vật lý phải cho phép nhập PIN và xác thực tại thiết bị.
7. PIN lưu trong thiết bị không được lưu dưới dạng văn bản thuần.
8. Hệ thống phải lưu trạng thái và nhật ký truy cập.
9. Web và Android phải có khả năng quan sát cùng một trạng thái thiết bị.
10. Hệ thống phải có cơ chế xác thực người dùng và phân quyền.
11. Camera phải hỗ trợ truyền hình ảnh thời gian thực qua WebRTC.
12. Hệ thống phải xử lý các tình huống mất Wi-Fi, mất MQTT hoặc kết nối WebRTC thất bại.

## 1.4. Phạm vi đề tài

Phần cứng tập trung vào ESP8266, keypad 4x4, relay và khóa điện. Firmware hiện tại sử dụng GPIO D1-D8 cho keypad và GPIO 16 cho relay. Thiết bị sử dụng EEPROM để lưu cấu hình keypad và SHA-256 để lưu dạng băm của PIN.

Phần IoT sử dụng MQTT với các topic phục vụ lệnh, trạng thái, sự kiện và cấu hình keypad. Phần nền tảng sử dụng PostgreSQL/Supabase, RLS và Realtime. Phần giao diện sử dụng React/Vite, PWA/Capacitor Android. Phần camera sử dụng WebRTC, Supabase Broadcast cho signaling và STUN/TURN cho quá trình ICE.

Đề tài là mô hình học tập, không được xem là thiết kế khóa thương mại hoặc hệ thống kiểm soát an ninh cấp doanh nghiệp. Đặc biệt, broker MQTT hiện tại trong firmware là broker thử nghiệm công khai; khi triển khai thực tế cần chuyển sang broker có xác thực và mã hóa TLS.

# CHƯƠNG 2. CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ

## 2.1. ESP8266

ESP8266 là vi điều khiển có khả năng kết nối Wi-Fi, phù hợp với các nút IoT có yêu cầu trao đổi dữ liệu qua mạng. Trong đề tài, ESP8266 đảm nhiệm đồng thời vai trò xử lý cục bộ và nút mạng.

Firmware khởi tạo GPIO, đọc keypad, kết nối Wi-Fi, tạo MQTT client và duy trì vòng lặp chính. Nếu Wi-Fi bị mất, hàm ensureWiFi() thử kết nối lại mạng hiện tại rồi thử các cấu hình mạng khác. Nếu MQTT bị mất, firmware định kỳ thực hiện reconnect.

Việc xử lý một phần logic ngay trên ESP giúp thiết bị vẫn có thể xác thực PIN từ keypad mà không cần gửi PIN lên Internet. Đây là nguyên tắc quan trọng trong hệ thống IoT: những xử lý cần phản hồi nhanh hoặc có thể thực hiện cục bộ nên được giữ gần thiết bị.

## 2.2. Relay và khóa điện

ESP8266 không được cấp tải trực tiếp cho khóa điện. GPIO chỉ tạo tín hiệu điều khiển relay hoặc tầng công suất phù hợp. Relay sau đó đóng/cắt nguồn cho tải khóa.

Trong firmware, relay được điều khiển bởi GPIO 16. Trạng thái logic HIGH được dùng trong hàm unlockDoor(), còn LOW được dùng trong lockDoor(). Khi mở cửa, firmware ghi nhận thời điểm bắt đầu bằng unlockStartTime. Sau UNLOCK_DURATION_MS, thiết bị tự gọi lockDoor().

Mô hình này tạo thành một máy trạng thái đơn giản:

LOCKED → UNLOCKED → LOCKED.

Nếu có lỗi mạng sau khi cửa đã được mở, cơ chế tự khóa cục bộ vẫn có thể hoạt động vì bộ đếm thời gian nằm trên ESP.

## 2.3. MQTT

MQTT là giao thức truyền thông theo mô hình publish/subscribe, phù hợp với các thiết bị có tài nguyên hạn chế và nhu cầu trao đổi sự kiện nhỏ. Trong hệ thống, ESP8266 không giao tiếp trực tiếp với từng giao diện. Nó kết nối broker và subscribe các topic cần thiết.

Các topic hiện được firmware sử dụng gồm:

| Topic | Vai trò |
|---|---|
| smartbuilding/door/command | Nhận lệnh OPEN, UNLOCK, LOCK, WRONG |
| smartbuilding/door/state | Phát LOCKED, UNLOCKED hoặc trạng thái lỗi |
| smartbuilding/door/event | Phát sự kiện xác thực và thao tác |
| smartbuilding/door/config/... | Nhận cấu hình keypad |

Ưu điểm của mô hình này là Web và Android không cần biết chi tiết GPIO. Hệ thống chỉ cần tạo lệnh theo hợp đồng IoT, còn ESP xử lý lệnh.

Theo chuẩn MQTT, publisher và subscriber được tách khỏi nhau bởi broker. Đây là đặc điểm phù hợp với hệ thống có nhiều loại client và thiết bị.

## 2.4. Supabase và PostgreSQL

Supabase cung cấp PostgreSQL làm nền tảng dữ liệu và Realtime để đồng bộ thay đổi tới client. Trong hệ thống, các bảng chính gồm profiles, rooms, tenants/room_occupants, devices, door_states, access_logs, camera_devices, camera_sessions, camera_detections, notifications, app_sessions, webauthn_credentials và webauthn_challenges.

Bảng door_states biểu diễn trạng thái thiết bị. access_logs lưu lịch sử truy cập với phương thức như KEYPAD, WEB_PIN, PHONE_BIOMETRIC, FACE hoặc PASSKEY tùy luồng. camera_devices lưu trạng thái camera và stream_id.

RLS được bật để giới hạn quyền truy cập dữ liệu. Đây là lớp bảo vệ quan trọng vì ứng dụng Web/Android không nên có quyền tùy ý đọc hoặc sửa dữ liệu của người dùng khác.

## 2.5. WebAuthn và passkey

WebAuthn cho phép ứng dụng sử dụng cặp khóa mật mã gắn với authenticator của thiết bị. Máy chủ lưu public key, trong khi private key được giữ bởi thiết bị/authenticator. Khi xác thực, máy chủ gửi challenge và thiết bị ký challenge để tạo assertion.

Điểm quan trọng trong đề tài là hệ thống không cần lưu dữ liệu vân tay hoặc Face ID thô. Sinh trắc học được xử lý ở lớp xác thực của thiết bị và kết quả được sử dụng để giải phóng credential/passkey. Cơ sở dữ liệu lưu credential_id, public_key, counter và metadata cần thiết.

## 2.6. WebRTC, STUN, TURN và ICE

WebRTC cung cấp cơ chế kết nối truyền thông thời gian thực giữa các peer. Để hai thiết bị ở các mạng khác nhau có thể kết nối, ICE sử dụng các candidate và có thể cần STUN để phát hiện địa chỉ công khai hoặc TURN để chuyển tiếp dữ liệu khi kết nối trực tiếp không khả thi.

Trong hệ thống, Supabase Broadcast được dùng làm kênh signaling cho offer, answer và ICE candidate. Sau khi signaling hoàn tất, luồng video được truyền qua RTCPeerConnection.

Một vấn đề thực tế của WebRTC là candidate có thể đến trước khi peer hoặc remote description được thiết lập. Vì vậy, mã hiện tại có hàng đợi pending ICE và chỉ thêm candidate sau khi remote description tồn tại. Viewer cũng gửi lại viewer-request theo chu kỳ vì Broadcast không phải hàng đợi bền vững.

# CHƯƠNG 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG

## 3.1. Kiến trúc tổng thể

Hệ thống gồm bốn khối chính: thiết bị nhúng, nền tảng IoT, giao diện người dùng và camera.

[FIGURE:01_kien_truc_he_thong.svg]

Hình 3.1. Kiến trúc tổng thể của hệ thống

Luồng dữ liệu chính đi từ Web/Android tới nền tảng điều khiển, sau đó tới MQTT broker và ESP8266. Ở chiều ngược lại, ESP phát trạng thái và sự kiện để hệ thống lưu trữ, đồng bộ và hiển thị.

Camera có luồng riêng: camera phát video WebRTC; Supabase Broadcast chỉ đảm nhiệm signaling. Điều này tránh việc đưa toàn bộ dữ liệu video qua cơ sở dữ liệu.

## 3.2. Thiết kế phần cứng

Bảng 3.1. Thành phần phần cứng

| Thành phần | Vai trò |
|---|---|
| ESP8266 | Bộ điều khiển và nút IoT |
| Keypad 4x4 | Nhập PIN cục bộ |
| Relay | Tầng chấp hành đóng/cắt tải |
| Khóa điện | Cơ cấu khóa/mở cửa |
| Nguồn cho khóa | Cấp năng lượng cho tải |
| Wi-Fi | Kết nối ESP với Internet |

Keypad sử dụng 8 chân dữ liệu, gồm 4 chân hàng và 4 chân cột. Relay dùng GPIO 16. Trong thiết kế phần cứng thực tế cần bảo đảm nguồn cho khóa phù hợp, có tầng bảo vệ và không đưa tải công suất vào GPIO.

## 3.3. Thiết kế firmware

Firmware được chia thành các nhóm chức năng:

- Quản lý Wi-Fi.
- Quản lý MQTT.
- Lưu/đọc cấu hình keypad bằng EEPROM.
- Băm SHA-256 cho PIN.
- Điều khiển relay.
- Xử lý keypad.
- Phát trạng thái.
- Phát sự kiện.
- Reconnect khi mất kết nối.

Firmware sử dụng vòng lặp loop() để gọi ensureWiFi(), reconnectMQTT(), client.loop(), sendHeartbeat(), handleKeypadPhysical() và kiểm tra thời gian tự khóa.

## 3.4. Thiết kế dữ liệu

Bảng 3.2. Các nhóm dữ liệu chính

| Nhóm | Dữ liệu |
|---|---|
| Người dùng | profiles, room_occupants |
| Thiết bị | devices, door_states |
| Truy cập | access_logs, events |
| Camera | camera_devices, camera_sessions, camera_detections |
| Xác thực | webauthn_credentials, webauthn_challenges |
| Phiên | app_sessions |
| Thông báo | notifications |

Thiết kế này cho phép tách trạng thái hiện tại khỏi lịch sử. door_states trả lời câu hỏi “thiết bị đang ở trạng thái nào”, trong khi access_logs trả lời “ai đã truy cập bằng phương thức nào”.

## 3.5. Phân quyền

Hệ thống có vai trò quản trị và người dùng/tenant. Quản trị có thể quản lý người dùng, thiết bị, phòng và nhật ký. Tenant chủ yếu được phép xem dữ liệu liên quan tới bản thân và thao tác các chức năng được cấp quyền.

RLS được dùng ở tầng PostgreSQL để bổ sung bảo vệ bên cạnh kiểm tra quyền ở giao diện. Đây là điểm cần thiết vì ẩn nút trên giao diện không phải là một cơ chế bảo mật.

# CHƯƠNG 4. XÂY DỰNG HỆ THỐNG THIẾT BỊ NHÚNG

## 4.1. Khởi tạo ESP8266

Khi khởi động, ESP mở Serial 115200, cấu hình relay về LOW, đọc cấu hình keypad từ EEPROM, sau đó tìm Wi-Fi. Nếu EEPROM chưa có cấu hình hợp lệ, firmware tạo cấu hình mặc định với PIN 1234 và lưu lại.

Cấu hình keypad gồm version, độ dài PIN, trạng thái enabled, phím xác nhận, phím xóa và chuỗi hash SHA-256. Cơ chế version giúp thiết bị chỉ nhận cấu hình mới hơn khi cấu hình được truyền qua MQTT.

## 4.2. Luồng xử lý mở cửa bằng keypad

[FIGURE:02_luong_mo_cua.svg]

Hình 4.1. Luồng xác thực và mở cửa bằng keypad

Người dùng nhập các chữ số. Khi nhấn phím xác nhận, ESP kiểm tra độ dài và tính SHA-256 của chuỗi nhập. Kết quả được so sánh với hash đã lưu bằng phép so sánh theo thời gian cố định. Nếu đúng, relay được kích hoạt và sự kiện SUCCESS được phát. Nếu sai, thiết bị thực hiện tín hiệu báo lỗi và phát sự kiện FAILED.

Ưu điểm của luồng này là PIN không cần truyền lên Internet. Việc xác thực cơ bản xảy ra ngay trên thiết bị.

## 4.3. Luồng xử lý MQTT

[FIGURE:03_luong_esp8266.svg]

Hình 4.2. Vòng đời hoạt động của ESP8266

Sau khi kết nối MQTT, ESP subscribe topic command và config. Khi nhận OPEN hoặc UNLOCK, hàm unlockDoor() kích relay và cập nhật trạng thái. Khi nhận LOCK, hàm lockDoor() tắt relay. Khi nhận WRONG, thiết bị tạo sự kiện thất bại.

Heartbeat được gửi định kỳ để thông báo trạng thái. Nếu kết nối MQTT bị mất, reconnectMQTT() được gọi theo chu kỳ 5 giây. Nếu Wi-Fi mất, ensureWiFi() thực hiện kết nối lại.

## 4.4. Cơ chế tự khóa

Thời gian mở cửa được cấu hình bằng UNLOCK_DURATION_MS, hiện tại là 10 giây. Khi unlockDoor() được gọi, unlockStartTime được ghi lại. Trong loop(), nếu cửa đang mở và thời gian đã vượt giới hạn, lockDoor() được gọi.

Đây là một cơ chế fail-safe ở cấp độ ứng dụng: lệnh mở không cần gửi thêm lệnh khóa từ server để kết thúc thời gian mở.

## 4.5. Quản lý cấu hình keypad

Cấu hình từ MQTT có dạng:

CFG|version|pin_hash|pin_length|enabled|confirm_key|clear_key

ESP kiểm tra định dạng, version, độ dài hash, độ dài PIN và các phím điều khiển. Nếu hợp lệ và version mới hơn, cấu hình được lưu vào EEPROM.

Cách làm này cho phép thay đổi PIN hoặc trạng thái keypad mà không cần nạp lại firmware.

# CHƯƠNG 5. XÂY DỰNG HỆ THỐNG ĐIỀU KHIỂN VÀ GIÁM SÁT

## 5.1. Đăng nhập và quản lý tài khoản

Ứng dụng sử dụng Supabase Auth để quản lý phiên đăng nhập. Hồ sơ người dùng được lưu trong profiles. Hệ thống xác định vai trò từ dữ liệu hồ sơ và áp dụng các chính sách RLS tương ứng.

Thông tin phiên được ghi nhận trong app_sessions phục vụ audit. Refresh token không được lưu thô trong bảng này.

## 5.2. Xác thực nhiều lớp

Hệ thống có nhiều phương thức truy cập. Keypad là phương thức trực tiếp tại thiết bị. Web/App PIN là phương thức xác thực trên giao diện. Passkey/sinh trắc học điện thoại là phương thức dựa trên WebAuthn. Ngoài ra, hệ thống hiện có nhánh Face AI trong camera cho mục đích nhận diện và tạo lệnh truy cập theo luồng đã triển khai.

[FIGURE:04_webauthn.svg]

Hình 5.1. Luồng xác thực passkey/sinh trắc học

Với WebAuthn, máy chủ lưu public key và credential ID thay vì lưu sinh trắc học thô. Khi xác thực, thiết bị ký challenge và server xác minh chữ ký.

## 5.3. Luồng điều khiển khóa từ Web/Android

Luồng điều khiển được tổ chức theo các bước:

1. Người dùng đăng nhập.
2. Hệ thống xác định vai trò.
3. Người dùng thực hiện phương thức xác thực mở cửa.
4. Hệ thống kiểm tra quyền và trạng thái cửa.
5. Lệnh OPEN được tạo.
6. Lệnh được chuyển tới lớp IoT/MQTT.
7. ESP nhận lệnh.
8. ESP kích relay.
9. ESP phát trạng thái UNLOCKED.
10. Hệ thống lưu và đồng bộ trạng thái.
11. Sau thời gian cấu hình, ESP tự khóa và phát LOCKED.

Cách thiết kế này giúp tách phần “quyết định có được phép mở hay không” khỏi phần “điều khiển chân GPIO”.

## 5.4. Đồng bộ thời gian thực

Supabase Realtime được dùng để theo dõi thay đổi ở các bảng trạng thái và nhật ký. Web và Android có thể đăng ký cùng nguồn dữ liệu, nhờ đó khi trạng thái cửa thay đổi, giao diện không cần liên tục tải lại trang.

[FIGURE:06_realtime.svg]

Hình 5.2. Đồng bộ trạng thái thiết bị tới Web và Android

Một trạng thái thay đổi cần được phân biệt giữa dữ liệu nguồn và dữ liệu hiển thị. PostgreSQL là nguồn dữ liệu trạng thái; Realtime là cơ chế phân phối sự kiện; Web/Android là nơi trình bày.

## 5.5. Phản hồi âm thanh

Ứng dụng có các âm thanh cho các trường hợp xác thực thất bại, xác thực thành công và cửa được mở. Sound service preload các tệp âm thanh và phát theo sự kiện.

Cơ chế này không ảnh hưởng tới logic IoT nhưng giúp giao diện phản hồi rõ ràng hơn, đặc biệt trên Android.

# CHƯƠNG 6. TÍCH HỢP CAMERA GIÁM SÁT

## 6.1. Kiến trúc camera

Camera được mô hình hóa trong camera_devices với trạng thái online, streaming, person_detected, person_count, detection_confidence và stream_id. Ngoài ra hệ thống có camera_sessions và camera_detections để lưu phiên và dữ liệu phát hiện.

Camera có thể được khởi tạo từ webcam của máy tính hoặc thiết bị tương thích với các loại WEB_CAMERA, USB_CAMERA và IP_CAMERA theo mô hình dữ liệu.

## 6.2. Signaling bằng Supabase Broadcast

Supabase Broadcast được dùng để trao đổi các tín hiệu:

- viewer-request
- offer
- answer
- ice-candidate
- viewer-stop

Kênh signaling được đặt theo stream ID. Viewer tạo request, camera tạo RTCPeerConnection, gắn track video và gửi offer. Viewer nhận offer, tạo answer và trả về camera.

## 6.3. Xử lý ICE candidate

Một lỗi thường gặp trong WebRTC là ICE candidate đến trước remote description. Nếu bỏ qua candidate, hai peer có thể không tìm được đường truyền phù hợp.

Trong implementation hiện tại, viewer có pendingIceRef và camera có pendingViewerIceRef. Candidate được lưu tạm khi peer chưa sẵn sàng, sau đó được addIceCandidate khi remote description đã tồn tại.

## 6.4. STUN và TURN

Hệ thống có STUN server để hỗ trợ phát hiện đường đi mạng. Khi kết nối trực tiếp không thể thực hiện do NAT/firewall, TURN có thể làm relay.

[FIGURE:05_webrtc.svg]

Hình 6.1. Luồng thiết lập kết nối WebRTC qua signaling và ICE

Mã hiện tại có cơ chế fallback TURN thử nghiệm thông qua Open Relay và cho phép cấu hình TURN riêng bằng VITE_TURN_URL, VITE_TURN_USERNAME và VITE_TURN_CREDENTIAL. Đối với triển khai thật, cần sử dụng dịch vụ TURN có tài khoản quản lý riêng và giám sát chi phí/băng thông.

## 6.5. Face AI

Nhánh camera hiện có xử lý frame định kỳ, phát hiện khuôn mặt, đánh giá chất lượng, tạo embedding và gửi yêu cầu nhận diện. Hệ thống yêu cầu sự ổn định qua nhiều frame và thời gian đứng trước camera trước khi tạo lệnh mở.

Sau khi mở thành công, Face Access được latch để tránh phát nhiều lệnh OPEN trong cùng một lượt đứng trước camera. Chỉ khi camera xác nhận không còn khuôn mặt trong một số lần liên tiếp, hệ thống mới cho phép một lượt nhận diện mới.

Cơ chế này là lớp chống lặp ở giao diện/AI. Quyền cuối cùng vẫn cần được kiểm soát ở phía server và thiết bị.

# CHƯƠNG 7. KIỂM THỬ HỆ THỐNG

## 7.1. Nguyên tắc kiểm thử

Kiểm thử được chia thành bốn nhóm: thiết bị nhúng, giao tiếp IoT, giao diện điều khiển và camera. Với mỗi trường hợp cần ghi nhận điều kiện đầu vào, thao tác, kết quả mong đợi và kết quả thực tế.

Do một số điều kiện phụ thuộc môi trường mạng và thiết bị thật, báo cáo không đánh dấu “đạt” cho các bài kiểm thử chưa được thực hiện đầy đủ trên hai mạng độc lập.

## 7.2. Kiểm thử ESP8266

| Mã | Nội dung | Kết quả mong đợi |
|---|---|---|
| ESP-01 | Khởi động ESP | Serial hiển thị trạng thái sẵn sàng |
| ESP-02 | Kết nối Wi-Fi | ESP nhận IP |
| ESP-03 | Kết nối MQTT | Subscribe các topic cần thiết |
| ESP-04 | Nhập PIN đúng | Relay mở, phát SUCCESS |
| ESP-05 | Nhập PIN sai | Phát FAILED và trạng thái lỗi |
| ESP-06 | Hết thời gian mở | Relay về LOCKED |
| ESP-07 | Mất Wi-Fi | Thiết bị thử kết nối lại |
| ESP-08 | Mất MQTT | Thiết bị reconnect theo chu kỳ |
| ESP-09 | Cấu hình keypad mới | EEPROM lưu version mới |
| ESP-10 | Cấu hình version cũ | Thiết bị bỏ qua |

## 7.3. Kiểm thử Web và Android

| Mã | Nội dung | Kết quả mong đợi |
|---|---|---|
| APP-01 | Đăng nhập | Tạo session hợp lệ |
| APP-02 | PIN đúng | Xác thực thành công |
| APP-03 | PIN sai | Từ chối và phát âm thanh lỗi |
| APP-04 | Passkey | Thiết bị xác thực và server kiểm tra credential |
| APP-05 | Trạng thái cửa | UI cập nhật theo dữ liệu Realtime |
| APP-06 | Trạng thái ESP offline | UI phản ánh thiết bị không online |
| APP-07 | Android quyền camera | Người dùng được yêu cầu cấp quyền khi dùng camera |
| APP-08 | Âm thanh | Phản hồi đúng theo sự kiện |

## 7.4. Kiểm thử camera

| Mã | Điều kiện | Nội dung cần kiểm tra |
|---|---|---|
| CAM-01 | Cùng mạng | Offer/answer và video |
| CAM-02 | Hai mạng khác nhau | ICE candidate và đường truyền |
| CAM-03 | Có TURN | Kiểm tra relay candidate |
| CAM-04 | Candidate đến sớm | Candidate được xếp hàng |
| CAM-05 | Viewer mở muộn | viewer-request được gửi lại |
| CAM-06 | Camera mất kết nối | Peer được đóng và trạng thái cập nhật |

Trong trạng thái hiện tại, mã nguồn đã được bổ sung TURN fallback, hàng đợi ICE và cơ chế gửi lại viewer-request. Tuy nhiên, việc xác nhận hoàn toàn luồng camera giữa hai mạng độc lập cần được thực hiện trên thiết bị thật; không nên coi đây là kết quả đã đạt nếu chưa có bài test thực tế.

## 7.5. Kiểm thử bảo mật

Các điểm cần kiểm tra:

- Không đưa service-role key vào frontend.
- RLS giới hạn truy cập bảng.
- PIN keypad được lưu dưới dạng hash.
- WebAuthn không lưu dữ liệu sinh trắc học thô.
- Lệnh điều khiển phải được kiểm tra quyền trước khi tới thiết bị.
- MQTT production phải dùng broker có xác thực và TLS.
- Cấu hình TURN production không sử dụng credential thử nghiệm công khai.

# CHƯƠNG 8. KẾT QUẢ, ĐÁNH GIÁ VÀ HƯỚNG PHÁT TRIỂN

## 8.1. Kết quả đạt được

Đề tài đã xây dựng được một mô hình IoT trong đó ESP8266 là nút điều khiển chính. Firmware thực hiện kết nối Wi-Fi, MQTT, xử lý keypad, lưu cấu hình EEPROM, băm SHA-256 cho PIN, điều khiển relay, phát trạng thái và tự kết nối lại.

Ở lớp nền tảng, hệ thống có PostgreSQL/Supabase để quản lý người dùng, thiết bị, trạng thái cửa, nhật ký truy cập, phiên, credential WebAuthn và dữ liệu camera. Realtime giúp Web và Android quan sát trạng thái chung.

Ở lớp ứng dụng, hệ thống có Web và Android, nhiều phương thức xác thực, phản hồi âm thanh, camera WebRTC và nhánh Face AI. Kiến trúc được tổ chức để các giao diện không điều khiển GPIO trực tiếp mà thông qua lớp IoT.

## 8.2. Đánh giá kiến trúc

Ưu điểm nổi bật của thiết kế là phân tách được ba loại trách nhiệm: thiết bị vật lý, nền tảng dữ liệu và giao diện. ESP có thể thực hiện một số logic cục bộ ngay cả khi mạng không ổn định. Supabase giúp quản lý dữ liệu và đồng bộ. Web/Android có thể thay đổi mà không phải viết lại toàn bộ firmware.

Một điểm khác là hệ thống có khả năng mở rộng. Từ một cửa có thể phát triển thành nhiều device_id, mỗi thiết bị có trạng thái riêng. MQTT topic có thể bổ sung định danh cửa. Database đã có device_id để liên kết dữ liệu.

## 8.3. Hạn chế

Thứ nhất, firmware hiện sử dụng broker MQTT thử nghiệm công khai với cổng 1883. Đây không phải cấu hình phù hợp cho môi trường thực tế vì thiếu lớp TLS và cơ chế credential riêng.

Thứ hai, hệ thống hiện tập trung vào một cửa chính. Chưa có kiểm thử tải nhiều ESP và nhiều client đồng thời.

Thứ ba, camera WebRTC phụ thuộc vào chất lượng mạng và NAT. TURN public fallback chỉ phù hợp mục đích thử nghiệm; production cần TURN riêng.

Thứ tư, việc kiểm thử cross-network camera phải được thực hiện trên các mạng thực tế. Một cấu hình ICE đúng trên mã nguồn không tự động chứng minh rằng mọi NAT/firewall đều hoạt động.

Thứ năm, mô hình khóa điện cần được kiểm tra về nguồn, relay, diode/flyback và trạng thái an toàn trước khi triển khai vật lý.

## 8.4. Hướng phát triển

1. Chuyển MQTT sang broker riêng có TLS, username/password hoặc certificate.
2. Bổ sung request_id, TTL, ACK và chống replay cho lệnh mở.
3. Xây dựng OTA firmware cho ESP8266.
4. Bổ sung giám sát health của thiết bị, RSSI, uptime và firmware version.
5. Hỗ trợ nhiều cửa và nhiều ESP.
6. Bổ sung cơ chế offline/local policy khi Internet mất.
7. Hoàn thiện TURN server riêng.
8. Chuẩn hóa provisioning Wi-Fi thay vì ghi SSID/password trực tiếp trong firmware.
9. Bổ sung cảm biến cửa thực để phân biệt “relay đã kích” và “cửa thực sự mở”.
10. Mở rộng camera AI thành cảnh báo xâm nhập và phát hiện bất thường.
11. Tách các topic MQTT theo device_id và namespace của tòa nhà.
12. Bổ sung dashboard giám sát tập trung cho trạng thái online/offline.

# KẾT LUẬN

Đề tài đã tiếp cận bài toán kiểm soát ra vào theo hướng IoT thay vì chỉ xây dựng một ứng dụng điều khiển khóa. Thành phần trung tâm là ESP8266, kết nối Wi-Fi và MQTT, xử lý keypad, điều khiển relay và phát trạng thái. Xung quanh thiết bị là nền tảng dữ liệu Supabase, giao diện Web/Android, cơ chế xác thực WebAuthn/passkey và hệ thống camera WebRTC.

Qua quá trình xây dựng, nhóm đã xử lý một số vấn đề đặc trưng của hệ thống IoT và truyền thông thời gian thực: reconnect Wi-Fi/MQTT, lưu cấu hình trên thiết bị, đồng bộ trạng thái, xử lý candidate WebRTC đến sớm, signaling không bền vững và nhu cầu TURN khi các peer nằm sau NAT khác nhau.

Mô hình hiện tại phù hợp với mục tiêu của bài tập lớn môn Nhúng và IoT vì thể hiện được chu trình từ thiết bị vật lý, xử lý cục bộ, kết nối mạng, giao thức IoT, nền tảng dữ liệu đến ứng dụng điều khiển và giám sát. Các giới hạn về broker thử nghiệm, camera cross-network, phần cứng tải và kiểm thử quy mô lớn được xác định rõ để làm cơ sở cho các bước phát triển tiếp theo.

# TÀI LIỆU THAM KHẢO

[1] ESP8266 Arduino Core Documentation, tài liệu về Wi-Fi, GPIO và lập trình ESP8266: https://arduino-esp8266.readthedocs.io/

[2] OASIS, MQTT Version 3.1.1, OASIS Standard, 2014: https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.pdf

[3] Supabase Documentation, Realtime và Postgres Changes: https://supabase.com/docs/guides/realtime

[4] MDN Web Docs, Passkeys và Web Authentication API: https://developer.mozilla.org/en-US/docs/Web/Security/Authentication/Passkeys

[5] MDN Web Docs, WebRTC API: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

[6] WebRTC Project, tài liệu kỹ thuật về peer connection và ICE: https://webrtc.org/

# PHỤ LỤC A. CẤU TRÚC FIRMWARE

Firmware chính được tổ chức theo các nhóm:

- Wi-Fi: connectToWiFiNetwork(), setup_wifi(), ensureWiFi().
- Hash: sha256Hex(), constantTimeEquals().
- EEPROM: setDefaultKeypadConfig(), saveKeypadConfig(), loadKeypadConfig().
- MQTT: callback(), reconnectMQTT(), publishState(), publishEvent().
- Door: unlockDoor(), lockDoor().
- Keypad: handleKeypadPhysical().
- Runtime: setup(), loop().

# PHỤ LỤC B. CÁC TOPIC MQTT

| Topic | Publisher | Subscriber | Nội dung |
|---|---|---|---|
| smartbuilding/door/command | Hệ thống điều khiển | ESP8266 | OPEN, UNLOCK, LOCK, WRONG |
| smartbuilding/door/state | ESP8266 | Bridge/UI | LOCKED, UNLOCKED |
| smartbuilding/door/event | ESP8266 | Hệ thống | SUCCESS, FAILED |
| smartbuilding/door/config/... | Hệ thống | ESP8266 | Cấu hình keypad |

# PHỤ LỤC C. DANH MỤC SƠ ĐỒ DRAW.IO

1. 01_kien_truc_he_thong.drawio – Kiến trúc tổng thể.
2. 02_luong_mo_cua.drawio – Luồng xác thực và mở cửa.
3. 03_luong_esp8266.drawio – Luồng hoạt động firmware.
4. 04_webauthn.drawio – Luồng xác thực passkey.
5. 05_webrtc.drawio – Luồng signaling và ICE.
6. 06_realtime.drawio – Luồng đồng bộ trạng thái.

Các tệp draw.io được cung cấp ở dạng XML để có thể mở trực tiếp bằng diagrams.net/draw.io và chỉnh sửa.

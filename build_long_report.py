import os, textwrap, re
base='/Users/trantuan/vercel-recovery/recovered-project'
secdir=base+'/report_sections'
os.makedirs(secdir,exist_ok=True)

def write(n,title,chapter,focus,details,code=''):
    paras=[]
    paras.append(f'{chapter}. {title}. Nội dung này được trình bày từ góc nhìn của một hệ thống nhúng có kết nối, trong đó ESP8266 là nút chấp hành tại hiện trường, còn các dịch vụ phía máy chủ chịu trách nhiệm xác thực, lưu trạng thái, ghi nhật ký và cung cấp giao diện điều khiển. Mục tiêu của phân tích là làm rõ vì sao thành phần được chọn, nó giao tiếp với thành phần nào, dữ liệu đi qua đâu và điều kiện nào được xem là thành công.')
    paras.append(f'Trong phạm vi triển khai hiện tại, {focus} Đây không phải một thành phần độc lập: giá trị của nó chỉ được xác định khi đặt trong chuỗi từ yêu cầu người dùng đến lệnh điều khiển, từ lệnh điều khiển đến MQTT, từ MQTT đến ESP8266 và từ ESP8266 quay trở lại trạng thái quan sát. Vì vậy, thiết kế ưu tiên ranh giới rõ ràng giữa quyết định mở khóa và thao tác vật lý mở khóa; điều này giúp kiểm thử từng lớp và hạn chế việc một lỗi giao diện trực tiếp biến thành thao tác chấp hành.')
    dtext='; '.join(details)
    paras.append(f'Các điểm kỹ thuật cần kiểm soát gồm: {dtext}. Với mỗi điểm, nhóm cần phân biệt dữ liệu cấu hình, dữ liệu trạng thái và dữ liệu sự kiện. Dữ liệu cấu hình có thể được lưu dài hạn; trạng thái phải phản ánh tình trạng hiện tại; còn sự kiện phải giữ được ngữ cảnh về nguồn yêu cầu, thời điểm và kết quả. Cách phân loại này giúp hệ thống dễ mở rộng sang nhiều cửa mà không phải viết lại toàn bộ luồng.')
    paras.append('Ở mức kiểm thử, cần quan sát cả trường hợp bình thường và trường hợp lỗi. Một lệnh mở cửa hợp lệ phải đi qua đầy đủ các bước xác thực và phân quyền trước khi tạo thông điệp điều khiển. Khi Wi-Fi hoặc MQTT mất kết nối, firmware phải tiếp tục duy trì trạng thái khóa an toàn và chủ động khôi phục kết nối. Khi giao diện nhận trạng thái chậm, giao diện không được tự suy diễn rằng relay đã đóng hoặc mở; trạng thái hiển thị phải dựa trên dữ liệu thiết bị hoặc sự kiện đã xác nhận.')
    paras.append('Về mặt đánh giá, thiết kế hiện tại phù hợp với mục tiêu bài tập lớn vì nó thể hiện đầy đủ đặc trưng của IoT: cảm nhận hoặc nhận yêu cầu tại biên, kết nối qua mạng, xử lý dịch vụ, điều khiển cơ cấu chấp hành và giám sát ngược trở lại. Tuy nhiên, các giới hạn của môi trường thử nghiệm vẫn phải được ghi rõ. Đặc biệt, broker MQTT công khai trên cổng 1883 không nên được xem là cấu hình triển khai sản xuất; hệ thống thực tế cần broker có xác thực, TLS, phân quyền topic và cơ chế chống phát lại lệnh.')
    if code:
        paras.append('Đoạn cấu hình hoặc mã tiêu biểu cần đối chiếu trong quá trình nghiệm thu:')
        paras.append(code)
    return title+'\n\n'+'\n\n'.join(paras)

items=[]
chapters=[
('CHƯƠNG 1 — PHÂN TÍCH BÀI TOÁN VÀ YÊU CẦU',[
('1.1. Phân rã bài toán kiểm soát ra vào','bài toán được chia thành xác thực người dùng, quyết định quyền, truyền lệnh, chấp hành vật lý, phản hồi trạng thái và ghi nhật ký','xác thực; phân quyền; MQTT; relay; trạng thái khóa; nhật ký truy cập'),
('1.2. Yêu cầu chức năng của hệ thống','người dùng có thể mở khóa bằng keypad hoặc qua giao diện sau khi vượt qua cơ chế xác thực tương ứng','mở cửa; khóa tự động; cập nhật cấu hình keypad; theo dõi trạng thái; lưu access log'),
('1.3. Yêu cầu phi chức năng','hệ thống phải ưu tiên trạng thái khóa an toàn, phản hồi có thể quan sát và khả năng khôi phục kết nối','độ trễ; khả năng phục hồi; tính nhất quán; bảo mật; khả năng mở rộng'),
('1.4. Mô hình tác nhân và quyền hạn','các tác nhân Tenant, Admin, thiết bị ESP và camera có trách nhiệm khác nhau','vai trò; quyền mở cửa; quyền cấu hình; quyền xem camera; nhật ký'),
('1.5. Phân tích luồng dữ liệu end-to-end','một thao tác mở cửa được theo dõi từ giao diện hoặc keypad đến relay và quay lại trạng thái','request; authorization; command; MQTT; relay; state; event'),
('1.6. Phạm vi phần cứng và phần mềm','trọng tâm là ESP8266, keypad, relay, khóa điện, MQTT bridge, Supabase và hai giao diện Web/Android','firmware; bridge; database; WebAuthn; WebRTC; Android WebView'),
('1.7. Các rủi ro kỹ thuật','các điểm dễ gây lỗi gồm mất Wi-Fi, MQTT disconnect, lệnh trùng, sai trạng thái UI và ICE candidate đến muộn','reconnect; duplicate command; pending ICE; stale state; public broker'),
('1.8. Nguyên tắc thiết kế hệ thống','thiết kế được tổ chức theo lớp để thay thế broker, giao diện hoặc cơ cấu chấp hành mà không phá toàn bộ hệ thống','separation of concerns; fail-safe; observable state; auditability'),
]),
('CHƯƠNG 2 — THIẾT KẾ NÚT NHÚNG ESP8266 VÀ CƠ CẤU KHÓA',[
('2.1. Lựa chọn ESP8266','ESP8266 được dùng làm nút điều khiển có Wi-Fi, đủ cho keypad, relay và giao tiếp MQTT','Wi-Fi; GPIO; bộ nhớ; Arduino Core; vòng lặp firmware'),
('2.2. Phân bổ chân GPIO','firmware hiện dùng D1-D8 cho keypad 4x4 và GPIO16 cho relay','row/column scan; relay pin; tránh xung đột chân; mức logic'),
('2.3. Nguyên lý quét keypad 4x4','keypad được đọc theo ma trận hàng-cột thay vì cần một GPIO cho từng phím','scan matrix; debounce; phím #; phím *; buffer PIN'),
('2.4. Lưu cấu hình bằng EEPROM','cấu hình keypad được giữ qua khởi động lại bằng vùng EEPROM của ESP8266','EEPROM.begin; commit; dữ liệu cấu hình; giới hạn ghi'),
('2.5. Băm PIN bằng SHA-256','firmware không cần lưu PIN dạng rõ trong luồng kiểm tra','hash; constant-time compare; nhập lại PIN; sai PIN'),
('2.6. Điều khiển relay','relay là lớp trung gian giữa GPIO và cơ cấu khóa điện','GPIO16; active level; relay isolation; trạng thái mặc định'),
('2.7. Thiết kế an toàn điện cho khóa','khóa điện và ESP không nên coi là cùng một tải trực tiếp','nguồn riêng; dòng tải; diode bảo vệ khi cần; cách ly; kiểm tra thực tế'),
('2.8. Máy trạng thái LOCKED/UNLOCKED','trạng thái khóa được mô hình hóa rõ để tránh các lệnh mở/đóng mâu thuẫn','LOCKED; UNLOCKED; transition; timeout; event'),
('2.9. Tham số thời gian mở khóa','firmware hiện sử dụng thời lượng mở khoảng 10 giây trước khi tự khóa','UNLOCK_DURATION_MS; millis; timeout; không block loop'),
]),
('CHƯƠNG 3 — THIẾT KẾ KẾT NỐI IoT VÀ DỮ LIỆU',[
('3.1. Kiến trúc MQTT','MQTT được đặt giữa dịch vụ điều khiển và ESP8266 để tách giao diện khỏi thiết bị','broker; publish; subscribe; topic; payload'),
('3.2. Quy ước topic','các topic hiện gồm smartbuilding/door/command, state, event và nhóm config','command; state; event; config; namespace'),
('3.3. Thiết kế payload lệnh','payload cần đủ thông tin để ESP phân biệt OPEN, nguồn yêu cầu và tham số liên quan','action; source; room/device; timestamp; request_id'),
('3.4. QoS và retain','QoS và retain phải được chọn theo ý nghĩa của từng loại dữ liệu chứ không dùng một cấu hình cho mọi topic','QoS 0/1; retained state; duplicate; idempotency'),
('3.5. Cơ chế reconnect Wi-Fi','firmware chủ động thử lại Wi-Fi khi kết nối bị mất','retry; backoff; non-blocking loop; trạng thái offline'),
('3.6. Cơ chế reconnect MQTT','ESP phải khôi phục subscription sau khi broker hoặc đường truyền trở lại','client reconnect; resubscribe; keepalive; last state'),
('3.7. MQTT bridge Node.js','bridge làm cầu nối giữa broker và các dịch vụ phía ứng dụng','server/MQTT; node process; publish; subscribe; logging'),
('3.8. Mô hình dữ liệu Supabase','cơ sở dữ liệu lưu người dùng, phòng, thiết bị, trạng thái, log và dữ liệu camera','profiles; rooms; devices; door_states; access_logs; cameras'),
('3.9. RLS và phân quyền dữ liệu','Row Level Security là lớp kiểm soát truy cập ở mức dữ liệu bên cạnh logic ứng dụng','RLS; authenticated role; tenant scope; admin scope'),
('3.10. Luồng ghi nhật ký truy cập','mọi yêu cầu mở cửa cần có dấu vết để đối chiếu với trạng thái thiết bị','actor; source; result; timestamp; device; reason'),
]),
('CHƯƠNG 4 — XÂY DỰNG VÀ PHÂN TÍCH FIRMWARE',[
('4.1. Trình tự khởi động ESP8266','firmware khởi tạo chân GPIO, đọc cấu hình, kết nối Wi-Fi rồi khởi tạo MQTT','setup; EEPROM; keypad; relay; Wi-Fi; MQTT'),
('4.2. Khởi tạo cấu hình mặc định','thiết bị cần có giá trị khởi tạo hợp lệ khi chưa có dữ liệu EEPROM','default PIN; config version; validation; migration'),
('4.3. Luồng mở cửa bằng keypad','PIN hợp lệ dẫn đến yêu cầu mở relay, sau đó firmware chuyển sang trạng thái UNLOCKED','input buffer; verify; relay; timer; event'),
('4.4. Xử lý PIN sai','PIN sai không được kích hoạt relay và cần phản hồi phù hợp','hash mismatch; reset buffer; rate limit; audit event'),
('4.5. Luồng nhận lệnh MQTT','ESP nhận command, kiểm tra action và thực hiện chuyển trạng thái nếu hợp lệ','callback; payload parsing; OPEN; CLOSE; invalid command'),
('4.6. Tự khóa sau 10 giây','timer dựa trên millis giúp tránh block toàn bộ vòng lặp trong thời gian mở','millis; deadline; relay off; state event'),
('4.7. Xử lý mất mạng trong trạng thái mở','mất mạng không được làm mất cơ chế tự khóa cục bộ','local timer; network independence; safe state'),
('4.8. Cập nhật cấu hình keypad','cấu hình từ dịch vụ phải được kiểm tra trước khi ghi EEPROM','validation; persistence; commit; rollback'),
('4.9. Xử lý lỗi và khôi phục','firmware cần phân biệt lỗi tạm thời của mạng với lỗi logic của lệnh','retry; serial log; fallback; watchdog considerations'),
('4.10. Đánh giá khả năng mở rộng firmware','thiết kế hiện tại có thể tách device_id và cấu hình theo từng cửa','device_id; multi-door; per-device topics; OTA'),
]),
('CHƯƠNG 5 — XÁC THỰC, WEB, ANDROID VÀ ĐỒNG BỘ THỜI GIAN THỰC',[
('5.1. Luồng đăng nhập tài khoản','giao diện phải tạo được phiên hợp lệ trước khi thực hiện thao tác nhạy cảm','session; profile; role; expiration'),
('5.2. WebAuthn và passkey','xác thực sinh trắc học được thực hiện qua authenticator và public-key credential','challenge; assertion; credential ID; public key; counter'),
('5.3. Không lưu dữ liệu sinh trắc học thô','server giữ thông tin credential cần để xác minh chữ ký thay vì ảnh hoặc dấu vân tay thô','credential ID; public key; RP scope; privacy'),
('5.4. Phân quyền mở cửa','xác thực thành công chưa đồng nghĩa với có quyền mở mọi cửa','role; room occupant; device scope; authorization'),
('5.5. Gửi lệnh từ Web','Web tạo command theo cùng giao thức MQTT thay vì điều khiển relay trực tiếp','UI action; authorization; publish; optimistic vs confirmed state'),
('5.6. Đồng bộ Android','Android dùng cùng backend và luồng quyền để tránh tạo một hệ thống song song','WebView; permissions; session; same API/backend'),
('5.7. Supabase Realtime','Realtime cung cấp đường truyền cập nhật trạng thái tới Web và Android','Broadcast; WebSocket; topic; authorization'),
('5.8. Phản hồi âm thanh và trạng thái','âm thanh chỉ là phản hồi UX, không phải bằng chứng rằng relay đã thực sự đóng/mở','sound; event; device state; error feedback'),
('5.9. Phiên và nhật ký','phiên người dùng và access log phải đủ thông tin để truy vết thao tác','app_sessions; access_logs; actor; device; timestamp'),
]),
('CHƯƠNG 6 — CAMERA, WEBRTC VÀ FACE AI',[
('6.1. Kiến trúc camera IoT','camera là nhánh giám sát chạy song song với nhánh điều khiển cửa','camera device; signaling; viewer; WebRTC'),
('6.2. Signaling qua Supabase Broadcast','Broadcast chỉ chuyển metadata đàm phán, còn media đi qua WebRTC','offer; answer; candidate; channel; authorization'),
('6.3. SDP offer/answer','hai đầu kết nối trao đổi mô tả phiên trước khi bắt đầu truyền media','SDP; offer; answer; setLocalDescription; setRemoteDescription'),
('6.4. ICE candidate','candidate có thể xuất hiện trước khi phía nhận sẵn sàng nên cần cơ chế hàng đợi','icecandidate; pending queue; flush; remote description'),
('6.5. STUN','STUN giúp endpoint phát hiện địa chỉ có thể dùng khi NAT cho phép kết nối trực tiếp','srflx; NAT; candidate gathering'),
('6.6. TURN','TURN cung cấp đường relay khi kết nối trực tiếp không khả thi','relay candidate; UDP/TCP/TLS; credential; production TURN'),
('6.7. Cơ chế viewer-request lặp lại','viewer gửi lại yêu cầu để bù cho tính không bền của signaling broadcast','request retry; timeout; session state; duplicate handling'),
('6.8. Face AI và chống spam','Face AI cần tránh phát lệnh OPEN liên tục khi cùng một khuôn mặt vẫn nằm trước camera','5 matches; dwell; preparation; one FACE command; cooldown'),
('6.9. Đánh giá camera liên mạng','kết nối cùng mạng và khác mạng phải được kiểm thử riêng; hiện trạng khác mạng chưa được xác nhận end-to-end','LAN; NAT; STUN; TURN; packet loss; real device test'),
]),
('CHƯƠNG 7 — KIỂM THỬ VÀ ĐÁNH GIÁ',[
('7.1. Chiến lược kiểm thử theo lớp','kiểm thử từ GPIO và firmware đến MQTT, backend, giao diện và camera','unit-like; integration; end-to-end; regression'),
('7.2. Kiểm thử keypad','kiểm tra đủ phím, debounce, PIN đúng/sai và reset buffer','4x4 matrix; wrong PIN; repeated entry; boundary cases'),
('7.3. Kiểm thử relay và auto-lock','đo thời gian từ command đến relay và xác nhận khóa trở lại sau khoảng 10 giây','latency; 10-second timeout; repeated commands'),
('7.4. Kiểm thử MQTT','kiểm tra publish/subscribe, reconnect, duplicate và payload không hợp lệ','topic; QoS; reconnect; malformed payload'),
('7.5. Kiểm thử database và RLS','xác minh tenant không đọc hoặc sửa dữ liệu ngoài phạm vi được phép','profiles; rooms; access_logs; policy denial'),
('7.6. Kiểm thử WebAuthn','kiểm tra challenge, assertion, credential lookup và trường hợp xác thực thất bại','challenge; credential; counter; invalid assertion'),
('7.7. Kiểm thử Web/Android','cùng một command phải cho kết quả nhất quán ở hai giao diện','session; permissions; command; realtime state'),
('7.8. Kiểm thử WebRTC','tách bài test signaling, ICE, media và reconnect để khoanh vùng lỗi','offer/answer; candidate queue; STUN; TURN; reconnect'),
('7.9. Kiểm thử bảo mật và giới hạn','ghi nhận những gì đã kiểm thử và những gì chưa đủ bằng chứng để kết luận','public MQTT; TLS; replay; hardware safety; cross-network camera'),
]),
('CHƯƠNG 8 — KẾT QUẢ, ĐÁNH GIÁ VÀ HƯỚNG PHÁT TRIỂN',[
('8.1. Kết quả triển khai phần nhúng','ESP8266 đã đảm nhiệm vai trò nút chấp hành và kết nối MQTT','keypad; relay; EEPROM; Wi-Fi; MQTT'),
('8.2. Kết quả triển khai backend','Supabase cung cấp xác thực, dữ liệu, RLS và realtime','PostgreSQL; Auth; RLS; Realtime'),
('8.3. Kết quả xác thực đa lớp','WebAuthn bổ sung lớp xác thực dựa trên public-key credential','passkey; challenge; assertion; authorization'),
('8.4. Kết quả giám sát camera','WebRTC tạo nhánh truyền video độc lập với kênh MQTT điều khiển cửa','signaling; ICE; STUN; TURN; Face AI'),
('8.5. Đánh giá tính nhất quán kiến trúc','các nhánh đều quy về trạng thái thiết bị và nhật ký thay vì tin hoàn toàn vào UI','source of truth; event; state; audit'),
('8.6. Đánh giá hiệu năng và độ tin cậy','độ tin cậy cần nhìn qua thời gian reconnect, độ trễ command và khả năng tự phục hồi','latency; reconnect; timeout; availability'),
('8.7. Hạn chế hiện tại','một số cấu hình còn phù hợp thử nghiệm hơn là sản xuất','public broker; TURN test; chưa E2E cross-network; hardware validation'),
('8.8. Lộ trình phát triển','các bước tiếp theo tập trung vào MQTT TLS, request_id, ACK, OTA, health monitoring và multi-door','TLS; idempotency; OTA; health; multi-door; private TURN'),
])]

n=1
for ch, arr in chapters:
    for title,focus,details in arr:
        text=write(n,title,ch,focus,details)
        with open(f'{secdir}/{n:02d}.txt','w',encoding='utf-8') as f:f.write(text)
        n+=1
print('technical text sections:',n-1)
# intro and toc
intro='''LỜI MỞ ĐẦU\n\nĐề tài được thực hiện trong học phần Nhúng và IoT với trọng tâm là xây dựng một hệ thống kiểm soát truy cập có nút thiết bị thật ở biên mạng. Khác với một ứng dụng web chỉ mô phỏng trạng thái khóa, hệ thống phải giải quyết đồng thời bài toán phần cứng, firmware, kết nối không dây, giao thức IoT, dịch vụ dữ liệu, xác thực người dùng và phản hồi trạng thái. ESP8266 đảm nhiệm vai trò điều khiển tại hiện trường; keypad cung cấp phương thức thao tác cục bộ; relay và khóa điện thực hiện chấp hành; MQTT làm kênh truyền lệnh; Supabase cung cấp dữ liệu, xác thực và đồng bộ; Web và Android là các giao diện vận hành; WebRTC và Face AI tạo nhánh giám sát camera.\n\nBáo cáo được xây dựng theo hướng khóa luận kỹ thuật, tập trung vào quá trình phân tích, lựa chọn kiến trúc, thiết kế, triển khai, kiểm thử và đánh giá. Các sơ đồ luồng được chuẩn bị bằng Draw.io, đồng thời bản báo cáo đưa các sơ đồ vào những vị trí tương ứng để người đọc có thể đối chiếu giữa mô tả và hệ thống.\n\nMột nguyên tắc quan trọng của báo cáo là không đánh đồng trạng thái hiển thị với trạng thái thiết bị. Một nút mở cửa trên giao diện chỉ tạo yêu cầu; quyền được kiểm tra ở tầng dịch vụ; command được chuyển qua MQTT; ESP8266 mới là thành phần thực hiện thao tác relay. Tương tự, kết nối camera được tách thành signaling và media để có thể phân tích riêng các lỗi WebRTC.\n\nBáo cáo cũng ghi rõ các giới hạn của môi trường thử nghiệm. Những điểm chưa có phép thử thực tế đủ mạnh, chẳng hạn camera qua hai mạng Internet khác nhau hoặc độ an toàn điện của khóa khi triển khai thật, không được trình bày như kết quả đã được chứng minh. Cách trình bày này nhằm bảo đảm giá trị kỹ thuật và khả năng nghiệm thu của đề tài.'''
open(secdir+'/00_intro.txt','w',encoding='utf-8').write(intro)
cover='''TRƯỜNG ĐẠI HỌC TÀI NGUYÊN VÀ MÔI TRƯỜNG HÀ NỘI\nKHOA CÔNG NGHỆ THÔNG TIN\n\nBÁO CÁO BÀI TẬP LỚN\nMÔN HỌC: NHÚNG VÀ IoT\n\nXÂY DỰNG HỆ THỐNG QUẢN LÝ VÀ KIỂM SOÁT TRUY CẬP TÒA NHÀ THÔNG MINH TÍCH HỢP XÁC THỰC SINH TRẮC HỌC, GIÁM SÁT CAMERA VÀ ĐIỀU KHIỂN KHÓA\n\nNhóm sinh viên thực hiện:\n1. Nguyễn Hữu Tùng\n2. Nguyễn Quang Phúc\n3. Nguyễn Đức Mạnh\n4. Trần Xuân Hùng\n5. Nguyễn Đình Đức\n\nLớp: ĐH13C5\nGiảng viên: ThS. Nguyễn Văn Hách\n\nHÀ NỘI, 10/2026'''
open(secdir+'/00_cover.txt','w',encoding='utf-8').write(cover)
# reference and appendix sections to bring the document beyond 70 technical pages
extra=[
('PHỤ LỤC 1 — CẤU TRÚC FIRMWARE','Tổ chức firmware theo các nhóm khởi tạo, Wi-Fi, MQTT, keypad, relay, EEPROM và vòng lặp điều khiển. Mỗi nhóm có trách nhiệm rõ ràng để việc thay đổi một chức năng không kéo theo sửa đổi dây chuyền. Trong nghiệm thu, cần đối chiếu từng hàm với luồng trên sơ đồ ESP8266.'),
('PHỤ LỤC 2 — DANH MỤC TOPIC MQTT','Danh sách topic gồm smartbuilding/door/command, smartbuilding/door/state, smartbuilding/door/event và nhóm smartbuilding/door/config. Khi mở rộng nhiều cửa, topic nên bổ sung device_id hoặc room_id để tránh command đi nhầm thiết bị.'),
('PHỤ LỤC 3 — CẤU TRÚC DỮ LIỆU','Các nhóm bảng gồm profiles, rooms, room_occupants hoặc tenants, devices, door_states, access_logs, camera_devices, camera_sessions, camera_detections, notifications, app_sessions, webauthn_credentials và webauthn_challenges. Mỗi nhóm dữ liệu cần có khóa định danh, quan hệ và chính sách RLS phù hợp.'),
('PHỤ LỤC 4 — MA TRẬN KIỂM THỬ','Ma trận nên ghi mã ca kiểm thử, điều kiện đầu vào, thao tác, kết quả mong đợi, kết quả thực tế, trạng thái và ghi chú. Các ca liên quan đến relay phải được thực hiện với nguồn và tải đúng thiết kế, không suy luận an toàn điện chỉ từ mô phỏng.'),
('PHỤ LỤC 5 — PHÂN TÍCH SỰ CỐ','Các nhóm sự cố được phân loại thành lỗi nguồn, lỗi GPIO, lỗi Wi-Fi, lỗi MQTT, lỗi backend, lỗi authorization, lỗi Realtime và lỗi WebRTC. Cách phân loại này giúp kỹ thuật viên bắt đầu từ lớp thấp nhất có khả năng tạo ra triệu chứng thay vì sửa giao diện trước.'),
('PHỤ LỤC 6 — HƯỚNG DẪN NGHIỆM THU','Quy trình nghiệm thu gồm kiểm tra phần cứng, khởi động ESP, nhập PIN, mở cửa cục bộ, mở cửa từ Web, mở cửa từ Android, kiểm tra log, kiểm tra quyền, kiểm tra camera và cuối cùng là kiểm tra khả năng phục hồi khi ngắt mạng.'),
]
for title,txt in extra:
    text=title+'\n\n'+txt+'\n\n'+('Nội dung này được dùng như tài liệu nghiệm thu trực tiếp. Mọi thông số được ghi trong báo cáo phải có nguồn từ firmware, cấu hình dự án hoặc phép đo thực tế. Khi thay đổi cấu hình, cần cập nhật đồng thời firmware, backend và tài liệu để tránh sai lệch giữa hệ thống chạy thật và báo cáo. '*4)
    with open(f'{secdir}/{n:02d}.txt','w',encoding='utf-8') as f:f.write(text)
    n+=1
print('total text sections including appendices:',n-1)

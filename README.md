# SmartBuilding Asset — Smart Building Access

Ứng dụng quản lý và kiểm soát cửa chính của tòa nhà. Repository này chứa frontend React/Vite, ứng dụng Android dùng Capacitor, mã nguồn Supabase và các tài liệu hỗ trợ đi kèm.

## Công nghệ chính

- **Frontend:** React, TypeScript, Vite, CSS.
- **Mobile:** Capacitor 8, Android native Java, AndroidX BiometricPrompt.
- **Backend và dữ liệu:** Supabase Auth, PostgreSQL/RPC, Realtime, Supabase Edge Functions.
- **Build web:** Vite + PWA.
- **Build Android:** Vite legacy bundle cho WebView cũ, sau đó đồng bộ vào Capacitor và build APK bằng Gradle.

## Cấu trúc thư mục

| Đường dẫn | Nội dung |
| --- | --- |
| `src/App.tsx` | Luồng đăng nhập, phân quyền và các màn hình chính của app. |
| `src/components/` | Các thành phần giao diện. |
| `src/lib/` | Supabase client, dịch vụ dữ liệu, PIN và sinh trắc học. |
| `src/services/` | Các dịch vụ xử lý nghiệp vụ, gồm nhận diện khuôn mặt. |
| `android/` | Dự án Android native, plugin Java và cấu hình Gradle. |
| `supabase/functions/` | Edge Functions cho tài khoản phòng, mở cửa, nhận diện khuôn mặt và WebAuthn. |
| `supabase/migrations/` | Các migration SQL được quản lý trong repository. |
| `database/` | Tài liệu/schema dữ liệu bổ sung. |
| `firmware/` | Firmware ESP8266 dạng ví dụ đã bỏ thông tin Wi-Fi/PIN; file `main.ino` cấu hình thật chỉ lưu local. |
| `drawio/` | Sơ đồ kiến trúc và luồng xử lý. |

## Yêu cầu môi trường

- Node.js và npm tương thích với các phiên bản trong `package-lock.json`.
- Java/JDK và Android SDK phù hợp với Android Gradle Plugin trong dự án.
- Android SDK Platform/Build Tools đã được cài đặt nếu build APK.
- Quyền truy cập project Supabase tương ứng nếu cần kiểm tra hoặc triển khai backend.

## Cấu hình môi trường

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Điền các giá trị môi trường cần thiết:

```dotenv
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-or-publishable-key>
```

Các biến trên được Vite đưa vào frontend, vì vậy chỉ dùng URL và anon/publishable key. **Không đặt `SUPABASE_SERVICE_ROLE_KEY`, mật khẩu tài khoản, token Vercel hoặc secret backend trong biến `VITE_*` hay commit vào Git.** File `.env`, `.env.local` và các file môi trường triển khai đã được loại khỏi Git bằng `.gitignore`.

## Chạy ứng dụng web tại máy local

```bash
npm install
npm run dev
```

Vite mặc định dùng cổng `5173`. Để kiểm tra kiểu TypeScript:

```bash
npm run check
```

Build web/PWA:

```bash
npm run build
```

Xem bản build bằng Vite preview:

```bash
npm run preview
```

## Build APK Android

Từ thư mục gốc của repository:

```bash
npm install
npm run check
npm run build:android
npx cap sync android
cd android
./gradlew assembleDebug
```

APK debug được tạo tại:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run build:android` bật cờ `CAPACITOR_NATIVE_BUILD=1`. Ở chế độ này, Vite dùng bundle legacy để hỗ trợ Android WebView cũ và tắt đăng ký Service Worker PWA trong APK. Bản web build thông thường vẫn giữ cấu hình PWA.

Muốn cài APK qua ADB khi thiết bị Android đã bật USB debugging:

```bash
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Đây là APK debug, không phải bản phát hành đã ký để đưa lên Google Play.

## Luồng khóa lớp 2 cho TENANT trên Android

1. Người dùng đăng nhập bằng tài khoản Supabase như bình thường.
2. Nếu PIN do ADMIN cấu hình chưa được xác minh trên phiên bản hiện tại, app yêu cầu nhập PIN cửa chính hiện tại. App gọi RPC xác minh riêng, không gọi lệnh mở cửa để thử PIN.
3. Sau khi xác minh thành công, app ghi nhớ phiên bản PIN đã xác minh trên thiết bị; PIN không được lưu dạng chữ trong local storage.
4. Khi ADMIN thực sự thay PIN, số phiên bản PIN xác thực tăng và app yêu cầu xác minh lại ở lần vào app kế tiếp, nếu phòng chưa bật sinh trắc học.
5. Trong mục **Sinh trắc học**, TENANT chọn người ở phù hợp và xác nhận bằng sinh trắc học trên Android. Trạng thái này được liên kết với tài khoản/phòng/người ở trong Supabase. Sau khi bật, sinh trắc học được giữ như phương thức lớp 2 kể cả khi ADMIN đổi PIN; PIN ADMIN vẫn là phương án dự phòng.
6. Sau khi qua lớp bảo vệ, màn hình điều khiển Android chỉ cần một nút **Mở khóa**. Việc xác minh lớp 2 không tự gửi lệnh mở cửa.

Lưu ý: chỉ dùng được sinh trắc học mạnh nếu thiết bị đã thiết lập và đăng ký loại sinh trắc học mà Android hỗ trợ. Trạng thái thực tế cần được kiểm thử trên điện thoại thật; emulator không thay thế được cảm biến sinh trắc học.

## Supabase: kiểm tra migration và Edge Functions

Các migration nằm trong `supabase/migrations/`. Trước khi thay đổi database production, hãy kiểm tra project đang liên kết và đối chiếu lịch sử migration:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase migration list --linked
```

Chỉ chạy lệnh áp dụng migration sau khi đã review các chênh lệch Local/Remote và xác nhận project đích. Không tự động reset database production. Các Edge Functions có trong repository nằm dưới `supabase/functions/`; deploy từng function theo kế hoạch triển khai và bảo đảm secrets được cấu hình trong Supabase, không ghi secret vào mã nguồn.

## Kiểm thử nhanh trước khi commit

```bash
npm run check
npm run build
npm run build:android
```

Nếu có thay đổi native Android:

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

Build thành công không đồng nghĩa đã kiểm thử end-to-end trên điện thoại. Với thay đổi PIN/sinh trắc học, cần kiểm tra đăng nhập TENANT, nhập PIN đúng/sai, thay PIN từ ADMIN, đăng ký sinh trắc học và vào app lại trên thiết bị mục tiêu. Không thử PIN bằng RPC mở cửa vì việc đó có thể mở cửa thật.

## An toàn khi commit/push

- Không thêm `.env*` vào commit; chỉ `.env.example` là template được phép đưa lên Git.
- Không commit `node_modules/`, `dist/`, thư mục build của Gradle, APK/AAB, cache IDE, `.vercel/` hoặc các file backup có hậu tố `.bak*`.
- Không đưa thông tin tài khoản/mật khẩu thật, token, private key hay service-role key vào README, log, test fixture hoặc commit.
- `supabase/seed.sql` là snapshot dữ liệu local chứa email/tên/ID tài khoản, nên bị loại khỏi Git; dùng `database/seed.sql` cho seed tổng quát đã ẩn danh.
- Kiểm tra `git status --short` và nội dung staged trước khi push.

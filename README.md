# ChefChat - Mobile & Web

Dự án này đã được tích hợp **Capacitor** để có thể đóng gói thành ứng dụng Android (APK).

## 1. GitHub Actions (Tự động Build APK)
Mỗi khi bạn `push` code lên nhánh `main` hoặc `master` trên GitHub, một quy trình tự động sẽ được kích hoạt:
- **Tên Action:** `Build Android APK`
- **Kết quả:** Sau khi build xong, bạn có thể tải file APK trong mục **Actions** -> chọn lần chạy gần nhất -> mục **Artifacts**.

## 2. Cách Build thủ công (Local)
Nếu bạn muốn build trên máy cá nhân:
1. Cài đặt Android Studio.
2. Chạy lệnh:
   ```bash
   npm install
   npm run cap:build
   npm run cap:open
   ```
3. Trong Android Studio, chọn **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.

## 3. Cấu hình Capacitor
File cấu hình nằm tại `capacitor.config.ts`. Bạn có thể thay đổi `appId` (ví dụ: `com.yourname.chefchat`) tại đây.

---
*Lưu ý: Để GitHub Action hoạt động, bạn cần đồng bộ dự án này với một Repository trên GitHub.*

# Bootstrap tài khoản Admin

API đăng ký công khai chỉ chấp nhận `Customer` và `Merchant`. Admin đầu tiên phải
được tạo bằng script nội bộ để tránh lỗ hổng tự nâng quyền.

## Git Bash

```bash
export BOOTSTRAP_ADMIN_EMAIL="admin@ugem.vn"
export BOOTSTRAP_ADMIN_PASSWORD="ThayBangMatKhauManh123"
export BOOTSTRAP_ADMIN_FULL_NAME="UGem Admin"
export BOOTSTRAP_ADMIN_PHONE="0988888866"
npm run admin:create
```

## PowerShell

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL="admin@ugem.vn"
$env:BOOTSTRAP_ADMIN_PASSWORD="ThayBangMatKhauManh123"
$env:BOOTSTRAP_ADMIN_FULL_NAME="UGem Admin"
$env:BOOTSTRAP_ADMIN_PHONE="0988888866"
npm run admin:create
```

Mật khẩu phải dài ít nhất 12 ký tự và có chữ hoa, chữ thường, chữ số.

Script có thể chạy lại an toàn:

- Nếu Admin đã tồn tại, script không đổi mật khẩu.
- Nếu email thuộc role khác, script từ chối tự nâng quyền.
- Nếu Admin đang bị khóa, script không tự mở khóa.
- Khi tạo thành công, hệ thống ghi sự kiện `ADMIN_BOOTSTRAPPED` vào audit log.

Sau khi tạo xong, xóa các biến bootstrap khỏi terminal hiện tại và không lưu giá
trị thật vào `.env.example` hoặc Git.

# E2E testing

Chạy toàn bộ golden flow:

```bash
npm run test:e2e
```

Runner mặc định suy ra database test từ `DATABASE_URL`. Ví dụ database local là
`ugem_db` thì runner chỉ tạo và sử dụng `ugem_db_test`.

Có thể cấu hình URL riêng bằng `TEST_DATABASE_URL`; tên database bắt buộc kết
thúc bằng `_test`. Xem `.env.test.example`.

## Các lớp bảo vệ dữ liệu

1. Runner từ chối khởi động nếu tên database không kết thúc bằng `_test`.
2. Test kiểm tra lại `current_database()` trước khi reset bảng.
3. Chỉ database test bị `TRUNCATE`; database development không bị thay đổi.
4. Migration được chạy bằng `prisma migrate deploy` trước mỗi lượt test.

## Golden flow hiện được phủ

- Public registration không thể tạo Admin hoặc Staff.
- Customer không truy cập được Admin API.
- Admin tạo Staff và audit log được ghi đúng.
- Merchant đã duyệt đăng nhập với `MerchantId` hợp lệ.
- Customer tạo đơn và không thể hoàn tất quá sớm.
- Merchant chuyển đúng `Accepted → Preparing → Ready → Delivering`.
- Customer xác nhận `Completed` và timestamp được lưu.
- SePay từ chối API key sai.
- SePay xử lý giao dịch hợp lệ và idempotent khi webhook gửi lại.

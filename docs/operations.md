# Vận hành và quan sát Backend

Quy trình Docker, CI/CD, backup, restore và rollback production được ghi tại
[`production-runbook.md`](./production-runbook.md).

Quy ước response, pagination và tên field chuẩn được ghi tại
[`api-contract.md`](./api-contract.md).

## Health checks

- `GET /api/v1/health/live`: tiến trình Node đang hoạt động.
- `GET /api/v1/health/ready`: API sẵn sàng nhận traffic và PostgreSQL phản hồi.
- `GET /api/v1/health`: alias tương thích ngược của readiness.

Các endpoint health không đi qua rate limiter để probe của nền tảng deploy không
bị trả về `429`.

## Trace ID

Mỗi response có:

- Header `X-Request-Id`.
- Trường JSON `traceId`.

Client có thể gửi `X-Request-Id` riêng. Backend chỉ chấp nhận ID dài 8–128 ký tự
và chỉ gồm chữ, số, `.`, `_`, `:`, `-`; giá trị không an toàn sẽ được thay bằng
UUID mới.

Khi báo lỗi, dùng `traceId` để tìm đúng dòng `http.request.completed` hoặc
`http.request.failed` trong log.

## Structured logs

Log được ghi theo JSON một dòng để Render, Docker hoặc hệ thống thu thập log có
thể parse trực tiếp. Backend không ghi request body hay query string. Các key có
tên như password, token, secret, authorization, cookie và API key luôn được thay
bằng `[REDACTED]`.

## Graceful shutdown

Khi nhận `SIGINT` hoặc `SIGTERM`, readiness chuyển sang trạng thái không sẵn
sàng, server ngừng nhận connection mới, đóng connection nhàn rỗi và chờ tối đa
10 giây để hoàn tất request đang xử lý trước khi thoát.

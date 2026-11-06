# Phát hành, khôi phục và vận hành

## GitHub flow / CI

1. Mỗi ticket có mã, AC, ưu tiên và liên kết PR. Nhánh ngắn từ `main`; PR mô tả cách kiểm tra, ảnh demo UI khi cần, migration/config impact và cách rollback.
2. Bắt buộc review chéo và CI: install reproducible từ lockfile, generated API types đồng bộ, lint, unit/service tests, API/e2e cho luồng quan trọng, build web/API. Không merge khi đỏ. Web hiện chưa có script test riêng; tạo coverage cho luồng public và admin trước khi coi pipeline đầy đủ.
3. `main` luôn buildable; sprint demo gắn tag bất biến/release candidate, image gắn commit SHA (không deploy `latest`); lưu commit, image digest, migration version và cấu hình phát hành.
4. Trước khi push GitHub: thống nhất một repo gốc `D:\CNPM`, xác minh các `.git` lồng nhau và remote/history trước khi gộp; xác nhận `.gitignore` bỏ qua `.env` thật, node_modules, build output và `.venv`; chỉ commit `.env.example` không secret. Không ghi credential trong issue/log.

## Phát hành demo

- Chạy toàn bộ CI trên đúng commit; triển khai staging/demo từ artifact immutable, không build lại khác nội dung.
- Chụp backup DB và object storage; kiểm tra backup có thể đọc; ghi release commit/image digest và schema version.
- Chạy migration theo expand-contract: thêm schema tương thích trước, deploy app, chuyển dữ liệu, chỉ xóa schema cũ ở release sau khi đã xác nhận. Không chạy migration destructive cùng deploy mà chưa có đường forward-fix và backup đã thử restore.
- Smoke test đăng nhập, role, hồ sơ, ảnh, workflow, public search, QR và health check; theo dõi log/health trước khi công bố demo.

## Rollback ứng dụng

1. Dừng hoặc disable chức năng gây lỗi bằng feature flag nếu có; ghi nhận thời điểm, release và ảnh hưởng dữ liệu.
2. Redeploy image digest/tag trước đó; giữ nguyên schema nếu bản cũ còn tương thích (mục tiêu của expand-contract).
3. Chạy smoke test và xác nhận với PO. Ghi incident/issue, root cause, dữ liệu có cần sửa hay không.
4. Nếu schema đã thay đổi không tương thích, không tự restore DB ngay: restore có thể xóa giao dịch phát sinh sau backup. Ưu tiên forward-fix; chỉ phục hồi backup khi PO/nhóm chấp nhận mất dữ liệu trong khoảng thời gian đã nêu và đã lưu bản sao hiện trạng.

## Backup/restore

Trong demo, backup DB và object storage hằng ngày, giữ ít nhất 7 bản. Bản sao phải nằm ngoài volume/container nguồn; quyền đọc/ghi hạn chế; không chứa secret trong repo. Mỗi sprint thực hiện hoặc cập nhật restore drill: dựng môi trường cách ly, phục hồi DB và object files, đối chiếu checksum/đếm bản ghi/liên kết, ghi thời gian và kết quả. Chỉ nói “có backup” khi đã chứng minh restore được.

## Cấu hình môi trường

Hiện có root `.env.example` dùng Compose, `apps/api/.env.example` dùng API chạy native và `apps/api/.env` local bị ignore. Đây là hai đường chạy khác nhau, không phải ba file secret cần đưa lên GitHub. Trong Sprint 1 xác minh cấu hình nào cần thiết cho từng lệnh, loại bỏ giá trị mặc định nguy hiểm khỏi production, tài liệu hóa env bắt buộc; không commit `.env` thật. Trước production cần secret manager/CI secrets riêng và cấu hình production tách biệt khỏi dev.

## Giới hạn hiện tại cần đưa vào backlog

Theo README hiện có, Compose là local/dev, Docker chưa được xác nhận trên máy; chưa có root Git/CI, migrations đang chạy ở startup API và web chưa có test script. Đây là việc cần hoàn thiện trước tuyên bố production-ready. Rollback hiện là quy trình mục tiêu, chưa được tự động hóa hoặc xác nhận bằng lần triển khai thực tế.

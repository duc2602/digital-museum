# Museum Admin

Monorepo quản trị bảo tàng: React/Vite (web), NestJS (API), PostgreSQL, Redis và MinIO. Cả nhóm dùng Docker Compose để chạy cùng một bộ dịch vụ.

## Cấu trúc

- apps/web/: giao diện React/Vite, đóng gói thành Nginx image.
- apps/api/: API NestJS, Prisma schema, migrations, worker và seed.
- infra/docker/docker-compose.yml: cấu hình toàn bộ stack.
- tools/docker-helper/: cấu hình MinIO cho Docker.
- docs/: tài liệu kiến trúc, Agile và phối hợp nhóm.

## Yêu cầu

- Docker Desktop đã mở và Docker Engine đang chạy.
- Node.js 22.12 trở lên.
- pnpm 12.

## Cài đặt và chạy lần đầu

Mở PowerShell tại thư mục gốc D:\CNPM. Tạo file .env riêng từ mẫu, chỉ khi chưa có để tránh ghi đè cấu hình hiện tại:

~~~powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
~~~

Trong .env, đặt ADMIN_EMAIL là email đăng nhập quản trị và ADMIN_PASSWORD là mật khẩu dài ít nhất 12 ký tự. Không commit .env; không đưa mật khẩu thật vào .env.example.

Cài dependencies và khởi động:

~~~powershell
pnpm install
pnpm start
~~~

pnpm start nạp .env ở thư mục gốc rồi dựng và chạy stack qua Docker Compose. Giữ terminal mở khi xem log. Truy cập:

- Web: http://localhost:8080
- API health: http://localhost:3000/health
- MinIO Console: http://localhost:9001

### Tạo tài khoản quản trị đầu tiên

Sau khi các container đã chạy, mở terminal PowerShell thứ hai tại D:\CNPM và chạy seed:

~~~powershell
docker compose --env-file .env -f infra/docker/docker-compose.yml exec api pnpm --filter @museum/api db:seed
~~~

Seed thành công sẽ báo Admin account ready. Đăng nhập bằng email đầy đủ trong ADMIN_EMAIL và mật khẩu trong ADMIN_PASSWORD. Đây là bước tạo tài khoản ban đầu; Compose không tự tạo tài khoản khi khởi động.

Nếu seed báo thiếu ADMIN_EMAIL hoặc ADMIN_PASSWORD, kiểm tra file D:\CNPM\.env, rồi tạo lại API để nạp cấu hình:

~~~powershell
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --force-recreate api
docker compose --env-file .env -f infra/docker/docker-compose.yml exec api pnpm --filter @museum/api db:seed
~~~

Seed chỉ tạo admin bootstrap khi database chưa có admin. Nếu đã có admin, seed sẽ bỏ qua tạo admin mới để người khác không thể đổi ADMIN_EMAIL trong .env rồi tự cấp quyền admin trên database đã khởi tạo. Seed hiện không thay mật khẩu nếu user cùng email đã tồn tại.

## Tài khoản, đăng ký và quyền

Hiện chưa có chức năng tự đăng ký công khai. Tài khoản được tạo riêng cho từng người trong phần quản lý người dùng; không dùng chung một tài khoản admin và không gửi file .env thật cho thành viên khác.

Các vai trò được seed vào database:

- ADMIN: toàn quyền, có thể tạo/cấp vai trò quản lý.
- MANAGER (Quản lý nội dung): quản lý hồ sơ và tài khoản thường; không thể cấp MANAGER/ADMIN, xem hoặc sửa tài khoản quản lý khác.
- EDITOR (Biên tập viên): đọc và sửa danh mục/hồ sơ; không quản lý tài khoản.

Chỉ ADMIN có quyền role:grant-manager. Server kiểm tra quyền khi đọc danh sách, tạo tài khoản và đổi vai trò, nên gửi trực tiếp API request cũng không cho phép user thường tự nâng quyền. Với database dùng chung, admin tạo tài khoản riêng rồi giao MANAGER hoặc EDITOR cho từng người. File .env.example để trống ADMIN_EMAIL và ADMIN_PASSWORD; chỉ người tin cậy khởi tạo database mới điền hai giá trị này để chạy seed lần đầu. Nếu từng máy chạy database riêng, tài khoản bootstrap chỉ có quyền admin trên database local của máy đó.

API kiểm tra quyền ở server. Các API quản lý user yêu cầu session hợp lệ và user:manage; khi gán vai trò, server từ chối cấp quyền mà người thao tác không có. Vai trò editor không có quyền user:manage, nên không thể tự gọi API để nâng mình thành admin. Admin quản lý user và vai trò trong phạm vi các quyền admin đang có. Mọi thay đổi user được ghi audit event.

Mật khẩu được lưu dạng hash, không xem lại được mật khẩu gốc. Không chia sẻ .env hoặc mật khẩu admin với nhóm qua GitHub; mỗi máy dùng .env riêng.

## Các lệnh thường dùng

Chạy hoặc dựng lại stack:

~~~powershell
pnpm start
~~~

Xem trạng thái:

~~~powershell
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
~~~

Xem log API:

~~~powershell
docker compose --env-file .env -f infra/docker/docker-compose.yml logs api --tail 100
~~~

Liệt kê tài khoản đang hoạt động (không hiện password hash):

~~~powershell
docker compose --env-file .env -f infra/docker/docker-compose.yml exec -T postgres psql -U museum -d museum -c "SELECT u.email, u.display_name, u.status, COALESCE(string_agg(r.code, ', '), 'chưa có vai trò') AS roles FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id WHERE u.deleted_at IS NULL GROUP BY u.id ORDER BY u.created_at;"
~~~

Dừng stack nhưng giữ dữ liệu:

~~~powershell
pnpm stop
~~~

Cảnh báo: lệnh sau xóa cả các volume dữ liệu phát triển (PostgreSQL, Redis, MinIO):

~~~powershell
docker compose --env-file .env -f infra/docker/docker-compose.yml down -v
~~~

PostgreSQL trong Docker được ánh xạ ra cổng host 5433, tránh xung đột với PostgreSQL local cổng 5432. API kết nối PostgreSQL, Redis và MinIO qua mạng nội bộ Docker.

Compose dùng image MinIO từ kho Bitnami Legacy cho development; image này không còn được cập nhật. Production nên dùng S3 hoặc image đã được tổ chức kiểm duyệt.

## Build và kiểm tra

~~~powershell
pnpm build
pnpm test
pnpm --filter @museum/api test:e2e
pnpm lint
~~~

## Phạm vi hiện tại

MVP có đăng nhập bằng session cookie HttpOnly, RBAC cơ bản, catalog/term tiếng Việt, CRUD hồ sơ hiện vật với optimistic locking, soft archive và audit event. Workflow duyệt/xuất bản, upload media, search engine, import/export và các luồng khác chưa được triển khai. Worker hiện chỉ xử lý job system.ping.

## Quy trình Agile và cùng phát triển

Kế hoạch Scrum 4 sprint/8 tuần, Product Backlog, Definition of Done và hướng dẫn phát hành/rollback nằm tại docs/agile/README.md.

Quy ước branch/PR nằm tại CONTRIBUTING.md; cách phối hợp 3 người tại docs/team/README.md. CI chạy lint, test và build khi tạo PR.

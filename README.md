# Museum Admin

Monorepo cho hệ thống quản trị bảo tàng, dùng pnpm workspace với React/Vite,
NestJS, PostgreSQL/Prisma, Redis/BullMQ và MinIO.

## Cấu trúc dự án

```text
apps/
  api/                 NestJS API, Prisma schema, migrations và worker
  web/                 React/Vite frontend, Nginx config và web image
infra/
  docker/              Docker Compose và cấu hình dịch vụ local
tools/
  docker-helper/       Python helper scaffold
    docs-theme/        Theme cho tài liệu helper
docs/
  api/                 OpenAPI contract
  architecture/        Tài liệu kiến trúc
```

## Chạy bằng Docker Compose

Cần Docker Desktop, Node.js 22.12+ và pnpm 12. Tại thư mục gốc:

```powershell
Copy-Item .env.example .env
# Đặt ADMIN_EMAIL và ADMIN_PASSWORD (ít nhất 12 ký tự) trong .env.
# Thay các password development trước khi dùng môi trường chia sẻ.
docker compose -f infra/docker/docker-compose.yml up --build
```

Mở giao diện tại <http://localhost:8080>, API tại <http://localhost:3000> và
MinIO Console tại <http://localhost:9001>. Tạo tài khoản quản trị đầu tiên:

```powershell
docker compose -f infra/docker/docker-compose.yml exec api pnpm --filter @museum/api db:seed
```

Lệnh seed chỉ tạo tài khoản nếu email chưa có; chạy lại không đặt lại mật khẩu
hoặc kích hoạt tài khoản đã bị vô hiệu hóa. Dừng stack bằng `Ctrl+C`, hoặc chạy:

```powershell
docker compose -f infra/docker/docker-compose.yml down
```

Muốn xóa dữ liệu development, thêm `-v` vào lệnh `down`. Compose dùng image
MinIO từ kho Bitnami Legacy cho development; image này không còn được cập nhật.
Production nên dùng S3 hoặc image đã được tổ chức kiểm duyệt.

## Chạy ứng dụng trên máy

1. Tạo cấu hình API từ mẫu và đặt `ADMIN_EMAIL`/`ADMIN_PASSWORD`:

   ```powershell
   Copy-Item apps/api/.env.example apps/api/.env
   ```

2. Cài dependency, khởi động dịch vụ phụ trợ, tạo Prisma Client và migrate:

   ```powershell
   pnpm install
   pnpm infra:up
   pnpm db:generate
   pnpm --filter @museum/api db:deploy
   pnpm --filter @museum/api db:seed
   ```

3. Chạy ứng dụng:

   ```powershell
   pnpm dev
   pnpm --filter @museum/api dev:worker
   ```

Truy cập <http://localhost:5173>. Vite chuyển tiếp `/api` tới backend.

## Kiểm tra

```powershell
pnpm build
pnpm test
pnpm --filter @museum/api test:e2e
pnpm lint
```

## Phạm vi hiện tại

MVP có đăng nhập bằng session cookie HttpOnly, RBAC cơ bản, catalog/term tiếng
Việt, CRUD hồ sơ hiện vật có optimistic locking, soft archive và audit event.
Workflow duyệt/xuất bản, upload media, search engine, import/export và các luồng
khác chưa được triển khai. Worker hiện chỉ xử lý job `system.ping`.

## Quy trình Agile

Kế hoạch Scrum 4 sprint/8 tuần, Product Backlog, Definition of Done và hướng dẫn phát hành/rollback nằm tại [docs/agile/README.md](docs/agile/README.md).

## Cùng phát triển

Quy ước branch/PR và kiểm tra nằm trong [CONTRIBUTING.md](CONTRIBUTING.md); cách phối hợp 3 người nằm trong [docs/team/README.md](docs/team/README.md). CI chạy lint, test và build khi tạo PR.

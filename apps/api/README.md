# Museum Admin API

NestJS API với Prisma/PostgreSQL, BullMQ/Redis và MinIO. MVP có session
authentication, RBAC, catalog/term và hồ sơ hiện vật. Cấu hình
`ADMIN_EMAIL`/`ADMIN_PASSWORD`, chạy migration rồi gọi `pnpm db:seed` để tạo
tài khoản quản trị đầu tiên. Hướng dẫn chạy monorepo và test nằm trong
[README dự án](../../README.md).

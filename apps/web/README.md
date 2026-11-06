# Museum Admin web

Ứng dụng React + Vite + TypeScript. Trong development, Vite proxy `/api` tới
NestJS tại `http://localhost:3000`. Production image dùng Nginx phục vụ SPA và
proxy `/api/` tới backend.

Chạy từ thư mục gốc bằng `pnpm --filter @museum/web dev`; hướng dẫn đầy đủ nằm
trong [README dự án](../../README.md).

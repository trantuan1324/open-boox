# Open Boox

Trang web sách: mượn theo gói đăng ký, mua sách, giao tận nơi. Dự án học tập — thiết kế ở `builder/spec/app_design.md`.

## Yêu cầu

- Node 22 (`nvm use`), pnpm 10 (`corepack enable`), Docker

## Chạy lần đầu

```bash
pnpm install
cp .env.example .env
pnpm db:setup
pnpm dev
```

- Web: http://localhost:3000 — API: http://localhost:4000/api
- Tài khoản mẫu: xem `SEED_*` trong `.env`

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Bật Postgres (Docker, cổng 5433) + chạy web và API |
| `pnpm db:setup` | Migrate + seed DB dev (chạy lại an toàn) |
| `pnpm test` | Unit + integration (API dùng DB `bookstore_test`) |
| `pnpm typecheck` | Kiểm tra kiểu toàn repo |
| `pnpm lint` | ESLint cho web, api, shared |

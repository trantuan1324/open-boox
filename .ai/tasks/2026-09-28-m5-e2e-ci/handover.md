# M5 handover — ESLint, Playwright E2E, GitHub Actions CI

Nhánh `m5-e2e-ci` (worktree `.worktrees/m5-e2e-ci`), cắt từ `master` @ `adb6de0`. Thực thi inline theo `.ai/tasks/2026-09-28-m5-e2e-ci/plan.md`.

## Commits

| Commit | Nội dung |
|---|---|
| `8f01458` | `build:` ESLint flat configs cho web/api/shared + task `lint` turbo |
| `f405d87` | `test(e2e):` hạ tầng Playwright trên DB `bookstore_e2e` có guard, production build 4100/3100 |
| `72384e2` | `test(e2e):` kịch bản mua + thanh toán mock + admin giao |
| `1201f53` | `test(e2e):` kịch bản gói → mượn → giao → trả → thu hồi |
| `1fa4721` | `ci:` hai workflow `ci.yml` (push master/PR) và `e2e.yml` (nightly + dispatch) |

## Kết quả đã chạy thật (Task 6 Step 1–3)

- `pnpm lint`: exit 0 — web còn 3 warning (`react-hooks/incompatible-library`, `@next/next/no-location-assign-relative-destination`, `import/no-anonymous-default-export`), 0 error; api và shared sạch.
- `pnpm typecheck`: xanh (api, web, shared, e2e).
- `pnpm test`: xanh — api 275, web 128, shared 117 (jest/vitest, đúng số lúc merge M4) + e2e 5 test unit cho db-guard.
- `pnpm test:e2e` lần 1: `3 passed` (7.4s test, ~19s tổng gồm build lại).
- `pnpm test:e2e` lần 2 (liên tiếp): `3 passed` (6.4s test, ~18s tổng) — DB được reset giữa hai lần, không dính dữ liệu lần 1.
- Sau hai lần chạy, `git status` sạch (không sinh `test-results/` hay `playwright-report/` ngoài lúc fail).
- Review Focus #3: sau khi E2E ghi đè `.next` bằng bản build 4100, `pnpm dev` vẫn chạy đúng — `/login` 200, POST `/api/auth/login` qua proxy cổng 3000 → API 4000 trả 200 (customer seed), GET `/account` 200 với cookie phiên. Dev dùng `.next/dev` riêng nên không bị ảnh hưởng.
- `pnpm audit --prod` và `pnpm audit`: đúng 1 advisory `deepmerge-ts` (GHSA-ggr8-5vv4-36mx, high) qua `prisma > @prisma/config` — là advisory đã biết từ trước Prisma CLI, không có advisory mới nào do dependency M5.

## Bằng chứng bảo vệ DB dev (Task 2 Step 6)

- Trước/sau khi prepare: DB dev `bookstore` vẫn 4 users.
- `bookstore_e2e` được tạo mới: 2 users, seed đủ (`nha-gia-kim`, `rung-na-uy`).
- Chạy tay `DATABASE_URL_E2E=…bookstore tsx prepare.ts` → ném `Refusing to reset database "bookstore"` trước lệnh prisma nào.

## Lệch khỏi plan

- Không có lệch về nội dung. Ghi chú: `prisma migrate deploy` tự tạo DB chưa tồn tại đã được xác nhận thực nghiệm (`PostgreSQL database bookstore_e2e created` trong log chạy đầu) — đúng giả định của plan/spec.
- Các tag action (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, `pnpm/action-setup@v6`) đã đối chiếu bản release mới nhất trên GitHub trước khi commit.

## Diễn tập CI trên clone sạch (Task 5 Step 4)

Clone mới ở nhánh `m5-e2e-ci`: `pnpm install --frozen-lockfile` → `cp .env.example .env` → `pnpm lint` → `pnpm typecheck` → `pnpm turbo test` → `playwright install chromium` → `pnpm --filter e2e test:e2e` — đủ 8 bước OK, `3 passed`.

## Trạng thái CI trên GitHub: XANH CẢ HAI WORKFLOW — M5 XONG

- Repo: https://github.com/trantuan1324/open-boox (default branch `master`, xác nhận bằng `git ls-remote --symref`).
- PR #1 `m5-e2e-ci → master`: https://github.com/trantuan1324/open-boox/pull/1 — **merged** thành merge commit `2278010`.
- Workflow `CI` (ci.yml) trên head `b6bdd0a`: **success** — https://github.com/trantuan1324/open-boox/actions/runs/36446396131 (job `check`: lint + typecheck + turbo test với Postgres service container).
- Workflow `E2E` (e2e.yml) kích bằng `workflow_dispatch` trên `master` sau merge: **success** — https://github.com/trantuan1324/open-boox/actions/runs/36447983537 (job `e2e`: build production 4100/3100 + 3 kịch bản Playwright trên `bookstore_e2e`).
- Lịch chạy: `e2e.yml` sẽ tự chạy 02:00 giờ Việt Nam hằng đêm (cron `0 19 * * *` UTC).

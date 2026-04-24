# PomeloSMP 🍊

เว็บไซต์เซิร์ฟเวอร์ Minecraft **PomeloSMP** สไตล์ minimal สร้างด้วย [Astro](https://astro.build/) + [Tailwind CSS](https://tailwindcss.com/)

## คอนเซ็ปต์

- **พาเลทสี** แรงบันดาลใจจากส้มโอ — เปลือกส้มอมเหลือง, เนื้อชมพูอ่อน, ใบเขียวสดชื่น บนพื้น cream อบอุ่น
- **มินิมอล** เน้น whitespace, typography แข็งแรง, การ์ดโปร่งแสง, พาสเทลชีคี
- **ไม่มี image asset ภายนอก** — ใช้ SVG inline ทั้งหมด โหลดเร็ว ใช้งานแบบ offline-first ได้
- **2 ภาษา** — เนื้อหาเป็นภาษาไทย รองรับฟอนต์ Noto Sans Thai

## สแตก

| Layer | เครื่องมือ |
|------|-----------|
| Framework | Astro 4 (hybrid SSR) + `@astrojs/node` standalone adapter |
| UI | Tailwind CSS + SVG inline assets |
| Database | SQLite via `@libsql/client` (prebuilt bindings — zero native compile) |
| ORM / Migrations | Drizzle ORM + drizzle-kit |
| Validation | Zod |
| Logging | Pino (structured JSON in prod / pretty in dev) |

## โครงสร้าง

```text
src/
├── components/                 # Astro UI components (Hero, Features, FAQ, …)
├── layouts/Layout.astro
├── pages/
│   ├── index.astro
│   └── api/                    # SSR API routes (prerender=false)
│       ├── health.ts
│       ├── status.ts
│       ├── whitelist.ts
│       └── whitelist/[id].ts
├── middleware.ts               # security headers + request-id + logging
└── server/                     # isolated backend layer (never imported from UI)
    ├── env.ts                  # Zod-validated env vars (fail-fast at boot)
    ├── db/
    │   ├── schema.ts           # whitelist_applications, rate_limits
    │   └── client.ts
    ├── lib/
    │   ├── logger.ts           # pino
    │   ├── errors.ts           # AppError + JSON response helpers
    │   ├── cache.ts            # TTL cache with single-flight de-dup
    │   ├── crypto.ts           # HMAC IP-hash, random tokens, timing-safe eq
    │   ├── rate-limit.ts       # fixed-window, SQLite-persisted
    │   └── request.ts          # client-ip + same-origin (CSRF) guard
    ├── services/
    │   ├── minecraft.ts        # mcsrvstat.us client (cached 30 s)
    │   ├── whitelist.ts        # CRUD + validation
    │   └── discord.ts          # webhook notifier (fail-soft)
    └── schemas/
        └── whitelist.ts        # Zod input schemas + i18n errors
scripts/migrate.ts              # drizzle migrator CLI
drizzle/                        # generated SQL migrations
```

## เริ่มต้นใช้งาน (dev)

```bash
# 1) install deps
npm install

# 2) สร้าง .env (ดู .env.example — อย่าลืมใส่ APP_SECRET ยาว >= 32 ตัว)
cp .env.example .env
# Windows: Copy-Item .env.example .env

# 3) สร้าง database + migrate
npm run db:generate   # สร้าง SQL migration จาก schema.ts (ครั้งแรกเท่านั้น)
npm run db:migrate    # apply migration → data/pomelo.db

# 4) start dev server (http://localhost:4321)
npm run dev
```

build / preview / production:

```bash
npm run build         # → dist/
npm run preview       # test the prod build locally
npm start             # run the standalone Node server from dist/
```

## API

ทุก endpoint ตอบกลับในรูปแบบ `{ data: ... }` หรือ `{ error: { code, message, details?, requestId } }` พร้อม header `x-request-id`

| Method | Path | รายละเอียด |
|--------|------|-----------|
| `GET`  | `/api/health` | health + uptime + db probe |
| `GET`  | `/api/status` | สถานะเซิร์ฟเวอร์ Minecraft (cache 30 s) |
| `POST` | `/api/whitelist` | ส่งใบสมัคร (rate-limited, CSRF-protected) |
| `GET`  | `/api/whitelist/:id` | เช็กสถานะใบสมัคร |

ตัวอย่าง curl:

```bash
curl http://localhost:4321/api/health
curl http://localhost:4321/api/status
curl -X POST http://localhost:4321/api/whitelist \
  -H "content-type: application/json" \
  -H "origin: http://localhost:4321" \
  -d '{"minecraftUsername":"Steve","discordHandle":"steve","age":20,"whyJoin":"I want to join because ..."}'
```

รหัส error ที่ควรรู้: `validation_failed` (422), `rate_limited` (429), `forbidden` (403, CSRF/origin), `conflict` (409, ส่งซ้ำ), `not_found` (404), `upstream_error` (502)

## 🛡 Admin Panel

เข้าได้ที่ `/admin` — ใช้สำหรับดูสถิติ, review ใบสมัคร Whitelist, approve/reject

### เปิดใช้งาน

1. สร้าง password hash:
   ```bash
   npm run admin:hash -- "your-strong-password"
   ```
2. ใส่ค่าที่ได้ลง `.env`:
   ```env
   ADMIN_USERNAME=pomelo
   ADMIN_PASSWORD_HASH=scrypt:...:...
   SESSION_TTL_HOURS=24
   ```
3. ไปที่ `http://localhost:4321/admin` แล้วล็อกอิน

> ถ้าไม่ตั้ง `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` ทั้ง `/admin/*` และ `/api/admin/*` จะ **ปิดสนิท** (คืน 404)

### หน้าที่มี

- **`/admin`** — Dashboard: สถิติ pending/approved/rejected, กิจกรรม 24 ชม., สถานะเซิร์ฟเวอร์สด, ใบสมัครล่าสุด 5 รายการ
- **`/admin/applications`** — ตารางใบสมัครพร้อม filter (pending/approved/rejected) + pagination 25/หน้า
- **`/admin/applications/:id`** — รายละเอียดเต็ม + ปุ่มอนุมัติ/ปฏิเสธ + review note

### Admin API

| Method | Path | รายละเอียด |
|--------|------|-----------|
| `POST` | `/api/admin/login` | `{ username, password }` → ตั้ง session cookie HttpOnly |
| `POST` | `/api/admin/logout` | ลบ session |
| `POST` | `/api/admin/applications/:id/approve` | `{ note?: string }` — ต้องมี session |
| `POST` | `/api/admin/applications/:id/reject`  | `{ note?: string }` — ต้องมี session |

### ชั้นป้องกันเพิ่มเติมของ admin

- **scrypt** password hashing (N=2^15, r=8, p=1) — พอทน offline attack + เร็วพอสำหรับ login
- **Session cookie** `pomelo_admin` — HttpOnly + Secure (prod) + SameSite=Strict + path=/
- **Session revocation** — สร้าง token ใน DB (ไม่ใช่ JWT) → logout ลบ row ได้ทันที
- **Timing-safe username compare** กันไม่ให้ enumerate ว่า username ถูกไหม
- **Rate-limited login** — 5 ครั้ง / 15 นาที / IP (ตอบ 429 พร้อม retry-after)
- **State transition guard** — อนุมัติ/ปฏิเสธซ้ำ → 409 (idempotent)
- **`x-robots-tag: noindex, nofollow, noarchive`** + `cache-control: no-store` บนทุก response ของ `/admin/*`
- **Middleware-level auth gate** — route protection เป็น layer เดียว ไม่ต้องแปะ `requireAdmin` ทุกหน้า

## ความปลอดภัย

- **Env validation** — Zod ตรวจทุกตัวแปรที่ boot ถ้าขาดหรือผิด server ไม่สตาร์ท
- **CSRF / Origin** — POST/PUT/PATCH/DELETE ต้องมี `Origin` ที่อยู่ใน `ALLOWED_ORIGINS` + ปฏิเสธ `application/x-www-form-urlencoded` / `multipart/form-data`
- **Rate limiting** — fixed-window per-IP (`RATE_LIMIT_API_PER_MINUTE` + `RATE_LIMIT_WHITELIST_PER_HOUR`) เก็บใน SQLite → ข้าม restart ได้
- **Input validation** — Zod schemas ตรวจ body ทุก field + body ถูก cap ที่ 8 KB
- **Security headers** (middleware) — CSP, HSTS (prod), X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP
- **PII** — IP ถูก HMAC-SHA256 (`APP_SECRET`) ก่อนเก็บลง DB (`ip_hash`) / User-Agent ตัดเหลือ 500 ตัวอักษร
- **Logging** — pino พร้อม redact `authorization`, `cookie`, `password`, `token`, `DISCORD_WEBHOOK_URL`
- **Honeypot** — ฟิลด์ `website` ซ่อนด้วย `sr-only`; บอทกรอกมา → 422
- **Timing-safe compare** — `crypto.timingSafeEqual` สำหรับเทียบ secret
- **Graceful upstream failures** — `mcsrvstat.us` ล่ม → fallback เป็น `{online:false}` ไม่ 500 หน้าเว็บ

## ประสิทธิภาพ

- **Single-flight caching** — `/api/status` ใช้ TTL cache 30 s + de-dup concurrent misses กัน thundering herd
- **HTTP caching headers** — `/api/status` ส่ง `cache-control: max-age=15, s-maxage=30, stale-while-revalidate=60`
- **libsql pragmas** — `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000` → concurrent readers ทำงานได้ดี
- **Hybrid mode** — หน้า marketing prerender เป็น static HTML; API routes เท่านั้นที่ SSR
- **Static-only frontend assets** — ไม่มี JS framework ฝั่ง client (Astro เป็น zero-JS โดย default)

## ปรับแต่ง

- **เปลี่ยน Minecraft host/port** — แก้ `MC_HOST`, `MC_PORT` ใน `.env`
- **Discord webhook** — ใส่ `DISCORD_WEBHOOK_URL` ใน `.env` เพื่อแจ้งเตือนใบสมัครใหม่
- **Origin ที่ยอมรับ** — เพิ่มใน `ALLOWED_ORIGINS` (comma-separated) เช่น `https://pomelosmp.net,https://www.pomelosmp.net`
- **Rate limit** — ปรับ `RATE_LIMIT_WHITELIST_PER_HOUR` / `RATE_LIMIT_API_PER_MINUTE`
- **เปลี่ยน IP ที่แสดง** — แก้ `serverIp` ใน `src/components/Hero.astro`, `CTA.astro`, `Footer.astro`
- **ปรับพาเลทสี** — `tailwind.config.mjs` → `theme.extend.colors.pomelo / flesh / leaf / cream / ink`

## Deploy production

### 🐳 วิธีที่แนะนำ — Docker Compose

```bash
cp .env.example .env              # ใส่ APP_SECRET, ADMIN_*, MC_HOST, ALLOWED_ORIGINS
docker compose up -d --build      # build + start (auto-migrates ที่ boot)
docker compose logs -f web        # ดู log
docker compose ps                 # health status
```

- Image ~180 MB (Alpine + Node 22, non-root uid 10001)
- SQLite อยู่ใน volume `pomelo-smp-data` (persist ข้าม container restart)
- `HEALTHCHECK` ยิง `/api/health` ทุก 30s
- `security_opt: no-new-privileges`, CPU/memory caps ใน compose

### 🟦 ทางเลือก — Node โดยตรง (ไม่มี Docker)

```bash
npm ci --omit=dev
cp .env.example .env              # แก้ค่าจริง
npm run db:migrate
npm run build
NODE_ENV=production npm start     # ฟัง $PORT (default 4321)
```

ตั้ง reverse proxy (nginx/Caddy/Cloudflare) ให้ชี้มาที่ port 4321 เพื่อจัดการ TLS + compression

## 🧪 ทดสอบ / CI

```bash
npm test            # vitest (50+ unit tests, ~1s)
npm run test:watch
npm run check       # astro check (typecheck + .astro)
npm run build       # astro check + build
```

GitHub Actions (`.github/workflows/ci.yml`) รันให้อัตโนมัติทุก push/PR:

1. install deps (cached)
2. `npm run check`
3. `npm test`
4. `npm run build` — upload `dist/` artifact
5. Docker build smoke-test (no push, with gha cache)

## Database migrations

ทุกครั้งที่แก้ `src/server/db/schema.ts`:

```bash
npm run db:generate   # สร้างไฟล์ SQL ใหม่ใน drizzle/
npm run db:migrate    # apply ไปที่ DB
npm run db:studio     # (optional) เปิด Drizzle Studio UI ดูข้อมูล
```

## อัปขึ้น GitHub

มี 2 วิธี เลือกตามสะดวก:

### A) มี Git ติดตั้งในเครื่อง

```powershell
# 1) สร้าง repo เปล่าบน GitHub (เว็บ) ชื่อ pomelo-smp
# 2) ในโฟลเดอร์โปรเจกต์:
git init
git branch -M main
git add .
git commit -m "feat: initial PomeloSMP site"
git remote add origin https://github.com/<USERNAME>/pomelo-smp.git
git push -u origin main
```

หรือใช้ [GitHub CLI](https://cli.github.com/):

```powershell
gh auth login
gh repo create pomelo-smp --public --source . --remote origin --push
```

### B) ไม่มี Git — อัปโหลดผ่านเบราว์เซอร์ / Codespace

1. ซิปโฟลเดอร์โปรเจกต์ (ไม่รวม `node_modules` และ `dist`)
2. เข้า GitHub สร้าง repo ใหม่ชื่อ `pomelo-smp`
3. คลิก **"uploading an existing file"** แล้วลากไฟล์ทั้งหมดลงไป commit ได้เลย
4. หรือเปิด Codespace ของ repo นั้น แล้วลากไฟล์/โฟลเดอร์เข้า Explorer ของ VS Code ใน Codespace → `git add . && git commit -m "init" && git push`

## ใช้งานใน GitHub Codespaces

repo นี้มี `.devcontainer/devcontainer.json` ให้แล้ว เมื่อเปิด Codespace:

- ใช้ image `javascript-node:20` + GitHub CLI
- รัน `npm install` อัตโนมัติ
- พอ attach จะรัน `npm run dev -- --host 0.0.0.0`
- forward port **4321** อัตโนมัติและเปิด preview ให้

ติดตั้ง extension ที่แนะนำ: Astro, Tailwind CSS IntelliSense, Prettier, MDX

## License

MIT — ดูไฟล์ `LICENSE`

ไม่เกี่ยวข้องกับ Mojang AB / Microsoft ใด ๆ — โปรเจกต์แฟนเมดเพื่อชุมชน

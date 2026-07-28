# Hướng dẫn deploy Kizuna Nihongo (chi tiết từng bước)

**Kiến trúc:** Frontend → **Vercel** · Backend → **Render** (Docker) · Database → **Supabase** (đã có sẵn).

> **Vì sao backend không đặt trên Vercel?** Backend cần `ffmpeg` + `yt-dlp` (binary ngoài), chạy
> `node-cron` thường trú, và tạo transcript AI mất vài phút. Vercel serverless không có các binary
> này, không giữ process nền, và giới hạn 10s (Hobby) / 60s (Pro).

**Thời gian ước tính:** ~30 phút. Cần sẵn: tài khoản GitHub, Vercel, Render (đăng nhập bằng GitHub được).

---

## BƯỚC 0 — Đẩy code lên GitHub

Render và Vercel deploy từ Git, nên code phải có trên GitHub trước.

```bash
git add -A
git commit -m "Chore: thêm cấu hình deploy Vercel + Render"
git push origin vinhdd
```

> Nếu muốn deploy từ nhánh `main`, hãy tạo Pull Request từ `vinhdd` → `main` và merge trước.
> Ở các bước sau, nhớ chọn đúng nhánh bạn vừa push.

---

## BƯỚC 1 — Lấy thông tin Supabase

Database đã chạy sẵn (project **KizunaNihongo**), **không cần tạo mới**. Chỉ lấy 3 giá trị:

1. Vào https://supabase.com → mở project **KizunaNihongo**.
2. Vào **Settings** (bánh răng góc trái dưới) → **API**.
3. Ghi lại 3 giá trị:

| Tên trên Supabase | Dùng cho | Ghi chú |
|---|---|---|
| **Project URL** | `SUPABASE_URL` và `VITE_SUPABASE_URL` | dạng `https://kcjepoaksgbrhqytkjrw.supabase.co` |
| **anon / public** key | `VITE_SUPABASE_ANON_KEY` | công khai được, dùng cho frontend |
| **service_role** key | `SUPABASE_SERVICE_ROLE_KEY` | 🔒 **BÍ MẬT** — chỉ backend, bypass mọi RLS |

4. Kiểm tra **Settings → API → Exposed schemas** phải có đủ:
   `public, course_module, language_module, users_module, ai_module, practice_module,
   billing_module, dictionary_module, flashcard_module, exam_module, jlpt_module`

> 💡 Các giá trị này bạn đã có sẵn trong file `.env` ở thư mục gốc máy mình — mở ra copy cho nhanh.

---

## BƯỚC 2 — Deploy Backend lên Render

### 2.1. Tạo service

1. Vào https://render.com → **Sign in with GitHub**.
2. Bấm **New +** (góc phải trên) → chọn **Blueprint**.
3. Chọn repo `SUMMER2026SE/swp391-rbl-project-group4` → chọn **nhánh** bạn đã push ở Bước 0.
4. Render đọc file `render.yaml` và tự nhận cấu hình (Docker, health check `/api/health`).
   Nếu Render không thấy Blueprint, dùng cách thủ công: **New + → Web Service**, rồi điền:

   | Mục | Giá trị |
   |---|---|
   | Language / Runtime | **Docker** |
   | Dockerfile Path | `./backend/Dockerfile` |
   | Docker Build Context Directory | `./backend` |
   | Health Check Path | `/api/health` |
   | Region | Singapore (gần VN nhất) |

### 2.2. Điền biến môi trường

Ở mục **Environment Variables**, thêm từng biến theo file `.env.example` (copy giá trị từ `.env` local):

| Biến | Bắt buộc | Ghi chú |
|---|:---:|---|
| `SUPABASE_URL` | ✅ | Bước 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 🔒 Bước 1 |
| `NODE_ENV` | ✅ | `production` |
| `FRONTEND_URL` | ✅ | tạm điền `http://localhost:5173`, **sẽ sửa ở Bước 4** |
| `FPT_AI_API_KEY`, `FPT_AI_MODEL`, `FPT_AI_WHISPER_MODEL`, `FPT_AI_JLPT_MODEL` | ✅ | AI chat + transcript |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | ✅ | gửi mã OTP |
| `SEPAY_API_TOKEN`, `SEPAY_WEBHOOK_KEY` | ✅ | 🔒 thanh toán |
| `QR_BANK_CODE`, `QR_ACCOUNT_NUMBER`, `QR_PROVIDER`, `PAYMENT_PROVIDER` | ✅ | QR chuyển khoản |
| `PAYMENT_ORDER_EXPIRE_MINUTES`, `SUBSCRIPTION_DURATION_DAYS` | ✅ | `30` / `30` |

> ⚠️ **TUYỆT ĐỐI KHÔNG set `API_PORT` và `PORT`** trên Render. Render tự cấp `PORT`; nếu bạn ghi đè,
> app sẽ nghe sai cổng và health check fail → deploy báo lỗi.

### 2.3. Deploy & kiểm tra

1. Bấm **Create Web Service**. Lần build đầu mất **5–10 phút** (phải cài ffmpeg, yt-dlp, biên dịch
   native module `node-vad`). Theo dõi tab **Logs**.
2. Build xong, Render cho bạn URL dạng `https://kizuna-nihongo-api.onrender.com`.
3. **Kiểm tra:** mở `https://<url-cua-ban>.onrender.com/api/health` → phải hiện `{"status":"ok"}`.

📋 **Ghi lại URL này** — cần cho Bước 3.

> ⏰ Gói **Free** của Render ngủ sau ~15 phút không có request → lần gọi đầu sau đó chậm 30–60 giây.
> Khi demo/bảo vệ đồ án nên mở `/api/health` trước vài phút cho "nóng máy".

---

## BƯỚC 3 — Deploy Frontend lên Vercel

### 3.1. Sửa URL backend vào code

Mở file `frontend/vercel.json`, thay `REPLACE-ME-backend.onrender.com` bằng domain Render ở Bước 2.3:

```json
{
  "source": "/api/:path*",
  "destination": "https://kizuna-nihongo-api.onrender.com/api/:path*"
}
```

Rồi commit & push:

```bash
git add frontend/vercel.json
git commit -m "Chore: trỏ API rewrite sang backend Render"
git push origin vinhdd
```

### 3.2. Tạo project trên Vercel

1. Vào https://vercel.com → **Sign in with GitHub**.
2. **Add New… → Project** → chọn repo `swp391-rbl-project-group4` → **Import**.
3. Cấu hình:

   | Mục | Giá trị |
   |---|---|
   | **Root Directory** | **`frontend`** ⚠️ bắt buộc — đây là monorepo, bấm **Edit** để chọn |
   | Framework Preset | Vite (tự nhận) |
   | Build Command / Output | để mặc định (`vercel.json` đã khai báo) |

4. Mở **Environment Variables**, thêm 2 biến:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL ở Bước 1 |
   | `VITE_SUPABASE_ANON_KEY` | **anon** key ở Bước 1 |

   > 🔒 Chỉ dùng **anon** key. Mọi biến `VITE_*` đều bị nhúng vào bundle và ai cũng xem được —
   > không bao giờ đặt `service_role` key hay `SEPAY_*` ở đây.

5. Bấm **Deploy**, đợi ~1–2 phút → nhận URL dạng `https://swp391-xxx.vercel.app`.

📋 **Ghi lại URL này** — cần cho Bước 4.

---

## BƯỚC 4 — Nối hai đầu lại với nhau

Đây là bước hay bị quên nhất, thiếu là đăng nhập/API sẽ lỗi.

### 4.1. Cho backend biết frontend (CORS)
1. Về Render → service của bạn → **Environment**.
2. Sửa `FRONTEND_URL` = URL Vercel ở Bước 3 (vd `https://swp391-xxx.vercel.app`), **không có dấu `/` cuối**.
3. Bấm **Save Changes** → Render tự deploy lại.

### 4.2. Cho Supabase biết frontend (đăng nhập Google)
1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: điền URL Vercel.
3. **Redirect URLs**: thêm `https://<url-vercel>/login`
   *(code redirect về `${origin}/login` sau khi đăng nhập Google — thiếu dòng này là Google login hỏng).*

### 4.3. Webhook thanh toán (nếu dùng SePay thật)
Trong dashboard SePay, trỏ webhook về: `https://<url-render>/api/webhooks/sepay`

---

## BƯỚC 5 — Checklist kiểm tra sau khi deploy

- [ ] `https://<backend>/api/health` trả `{"status":"ok"}`
- [ ] Mở web Vercel lên được, không lỗi trắng trang (F12 → Console không có lỗi đỏ)
- [ ] Đăng ký tài khoản mới → **nhận được email OTP** → xác thực vào được dashboard
- [ ] Đăng nhập bằng **Google** chạy đúng (nếu lỗi → kiểm tra lại Bước 4.2)
- [ ] Đang ở `/dashboard` bấm **F5 không bị 404** (SPA fallback hoạt động)
- [ ] Vào **Luyện nghe** → tạo nội dung từ link YouTube → bấm tạo transcript AI chạy được
      *(đây là phép thử ffmpeg + yt-dlp trong container)*
- [ ] Trang **Pricing** hiện QR thanh toán đúng số tài khoản

---

## Xử lý lỗi thường gặp

| Triệu chứng | Nguyên nhân & cách sửa |
|---|---|
| Render build fail ở bước `npm ci` | Native module `node-vad` cần build tools — Dockerfile đã cài `make g++ python3`. Kiểm tra Docker Context có đúng `./backend` không. |
| Deploy xong nhưng health check fail | Bạn đã lỡ set `PORT` hoặc `API_PORT` trên Render → xoá 2 biến đó đi. |
| Web load được nhưng mọi API lỗi 404 | `frontend/vercel.json` còn `REPLACE-ME-...` → sửa thành URL Render thật rồi push lại. |
| API lỗi **CORS** | `FRONTEND_URL` trên Render sai hoặc còn dấu `/` ở cuối. |
| F5 ở `/dashboard` ra 404 | Thiếu rewrite SPA trong `vercel.json`, hoặc Root Directory chưa đặt là `frontend`. |
| Đăng nhập Google xong bị đá về trang chủ | Chưa thêm Redirect URL trong Supabase (Bước 4.2). |
| Request đầu tiên chậm 30–60s | Bình thường với gói Free Render (service ngủ). |
| Tạo transcript AI bị timeout | Video quá dài. Gói Free Render có RAM 512MB — thử video ngắn hơn hoặc nâng gói. |

---

## Ghi chú bảo mật

- 🔒 `SUPABASE_SERVICE_ROLE_KEY`, `SEPAY_API_TOKEN`, `SEPAY_WEBHOOK_KEY`, `SMTP_PASS` **chỉ** đặt ở backend (Render).
- Database **không bật RLS** — phân quyền nằm ở tầng controller, nên lộ service role key là lộ toàn bộ dữ liệu.
- File `.env` thật đã được `.gitignore` chặn. Đừng bao giờ commit nó.

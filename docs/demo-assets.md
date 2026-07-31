# Demo Assets — Kizuna Nihongo (20' / 5 người)

> Mở file này SẴN trong 1 tab lúc demo. Mỗi khối ``` là để **copy-paste thẳng**.
> Sắp theo đúng thứ tự 5 người trong kịch bản. Xem plan: `~/.claude/plans/mai-t-i-c-n-demo-compressed-quiche.md`.

**Tài khoản chuẩn bị sẵn (đăng nhập sẵn ở các cửa sổ):**

| Vai trò | Dùng cho | Ghi chú |
|---|---|---|
| Admin | Người 1, 3 | duyệt hồ sơ, mock exam, cấp gói |
| Teacher (đã duyệt) | Người 2 | dự phòng nếu duyệt live lỗi |
| Tài khoản mới (chưa là teacher) | Người 1 | để nộp hồ sơ AI screening LIVE |
| Student (đã nâng gói + enroll sẵn) | Người 4, 5 | né quota AI |

---

## 👤 NGƯỜI 1 — Teacher Application (AI screening)

### Thông tin nghề nghiệp (điền form `/teacher-application`)

- **Trình độ muốn dạy:** N5, N4, N3
- **Bằng cấp / chứng chỉ:** Chứng chỉ JLPT N1 (12/2023) · Cử nhân Ngôn ngữ & Văn hóa Nhật Bản
- **Kinh nghiệm giảng dạy:** 3 năm

**Giới thiệu bản thân (copy):**
```
Tôi có chứng chỉ JLPT N1 và 3 năm kinh nghiệm giảng dạy tiếng Nhật cho người mới bắt đầu
đến trình độ N3 tại trung tâm Nhật ngữ. Tôi chuyên luyện thi JLPT N5–N3, xây dựng lộ trình
học theo trình độ và thế mạnh của từng học viên. Tôi mong muốn đóng góp nội dung bài đọc,
từ vựng và đề luyện tập chất lượng cho nền tảng Kizuna Nihongo.
```

### Hồ sơ đính kèm (chuẩn bị TRƯỚC — file thật)
- **CV (PDF)** — dùng nội dung dưới, dán vào Word → xuất PDF (`cv-demo.pdf`).
- **Chứng chỉ (ảnh JPG/PNG)** — 1 ảnh chứng chỉ/bằng nhìn hợp lệ (`cert-demo.jpg`).
- Ghi chú: hồ sơ càng đầy đủ & rõ, AI càng dễ **auto-approve**; nếu thiếu → "Chờ duyệt" (đúng BR-04, vẫn demo được luồng admin review).

**Nội dung CV để tạo PDF (copy):**
```
NGUYỄN VĂN A — Giáo viên tiếng Nhật
Email: teacher.demo@kizuna.vn · SĐT: 09xx xxx xxx

HỌC VẤN
- Cử nhân Ngôn ngữ & Văn hóa Nhật Bản — 2020
- JLPT N1 — 12/2023 (điểm 142/180)

KINH NGHIỆM
- 2021–2024: Giáo viên tiếng Nhật, Trung tâm Nhật ngữ Sakura
  · Giảng dạy N5–N3, luyện thi JLPT
  · Biên soạn tài liệu từ vựng, kanji, bài đọc

KỸ NĂNG
- Luyện thi JLPT N5–N3 · Ngữ pháp · Hội thoại · Biên soạn đề
```

---

## 👤 NGƯỜI 2 — Teacher tạo nội dung bằng AI

### (1) Reading passage — nhập cho AI draft (UC-56)
- **Chủ đề:** `Cửa hàng tiện lợi ở Nhật (日本のコンビニ)`
- **Level:** `N4`
- Bấm lần lượt: **AI draft bài → tách đoạn + furigana → sinh câu hỏi → sinh vocab/grammar → Publish.**

#### ⛑️ FALLBACK — bài đọc đã sinh sẵn (dán nếu AI lag)
```
日本のコンビニはとても便利です。多くの店は二十四時間開いていて、朝でも夜でも買い物ができます。
コンビニでは、食べ物や飲み物だけでなく、雑誌や日用品も売っています。また、電気やガスの料金を
払ったり、宅配便を送ったりすることもできます。最近は、外国人の店員も増えてきました。
今では、コンビニは日本人の生活になくてはならないものです。
```

**Câu hỏi đọc hiểu (fallback):**
```
Q1. 多くのコンビニは何時間開いていますか。
  A. 8時間   B. 12時間   C. 24時間 ✅   D. 18時間

Q2. コンビニでできないことはどれですか。
  A. 料金を払う   B. 宅配便を送る   C. 飛行機の切符を予約する ✅   D. 日用品を買う

Q3. 最近、コンビニで増えているのは何ですか。
  A. 外国人の店員 ✅   B. 日本語の本   C. 子ども   D. 駐車場
```

**Vocab / Grammar trọng điểm (fallback):**
```
便利（べんり）— tiện lợi — TÍNH TỪ
日用品（にちようひん）— đồ dùng hàng ngày — DANH TỪ
料金（りょうきん）— cước phí, tiền phí — DANH TỪ
宅配便（たくはいびん）— dịch vụ giao hàng tận nơi — DANH TỪ
増える（ふえる）— tăng lên — ĐỘNG TỪ

Ngữ pháp:
〜だけでなく — không chỉ… mà còn…
〜なくてはならない — nhất thiết phải / không thể thiếu
```

### (2) Question bank — AI generate (UC-53) `/teacher/question-bank`
- **Level:** N5 · **Kỹ năng:** Từ vựng (語彙) · **Số câu:** 5
- Sinh xong → sửa nhanh 1 câu → lưu vào **private bank**. Nói: BR-24 (teacher chỉ sửa bank riêng, global read-only).

### (3) Nhắc thoáng — Import Vocab/Kanji có AI `check-json`
Dán JSON lỗi này để AI **sửa định dạng + sửa nội dung** (reading/nghĩa/level):
```
[
  { "kanji": "学校" "reading": "がっこ", "meaning_vi": "truong hoc" }
  { "kanji": "先生", "reading": "せんせい", "meaning_vi": "giáo viên", "level": "N5" }
  { kanji: "図書館", "reading": "としょうかん", "meaning_vi": "thư viên", "type": "DANH TỪ" },
]
```
> Lỗi cố ý: thiếu dấu phẩy, key `kanji` không nháy, dấu phẩy thừa cuối; `がっこ`→`がっこう`, `としょうかん`→`としょかん`, `truong hoc`→`trường học`, `thư viên`→`thư viện`, thiếu `level`/`type`. AI sẽ tự sửa hết.

---

## 👤 NGƯỜI 3 — Admin: Mock exam AI + vận hành

### (1) Mock exam AI + TTS (UC-62) `/admin/mock-exams`
- Trong 1 nhóm câu: bấm **AI sinh câu hỏi** → **AI regenerate 1 câu** → với câu nghe bấm **TTS sinh audio**.
- *Fallback:* dùng đề đã có sẵn câu + audio; chỉ live "regenerate 1 câu".

**Text cho TTS (nếu cần nhập câu nghe):**
```
男：すみません、この近くに郵便局はありますか。
女：はい、あの信号を右に曲がると、すぐ左にありますよ。
男：ありがとうございます。
```

### (2) Phân quyền sở hữu (BR-22) — 20s
`/admin/courses` → mở 1 khóa của **teacher** → chỉ ra **read-only preview** (admin không sửa/xóa/publish khóa teacher).

### (3) Cấp gói cho Student demo (UC-73) + coverage nhanh
- `/admin/subscriptions` (hoặc user detail) → **cấp gói** cho account Student → né quota AI phần sau.
- Lướt 5–10s: `/admin/system` (UC-79: App/DB/**AI service**), `/admin` (UC-78 dashboard).
- Kể tên (không bấm): `/admin/users` (UC-68/70), `/admin/placement` (UC-65).

---

## 👤 NGƯỜI 4 — Student học nội dung vừa tạo + AI cá nhân hóa

### (1) Reading `/reading` → mở bài Người 2 vừa publish
- Bật/tắt **furigana** · **tap từ tra nghĩa** (UC-22).
- **AI helper chat theo bài** (`/reading/:id/chat`) — prompt sẵn:
```
Giải thích giúp mình mẫu ngữ pháp 「〜なくてはならない」 trong bài này, kèm 1 ví dụ.
```
- Làm **quiz đọc hiểu** (UC-24) → chấm ngay.

### (2) Learning roadmap AI (UC-10) `/learning-path`
- Trình độ hiện tại: **N5** · Mục tiêu: **N4** → **AI sinh lộ trình** → tick 1 bước.

### (3) Flashcard AI (UC-17 + UC-21) `/flashcards/new`
Dán danh sách (trộn **từ vựng + mẫu ngữ pháp** — AI tự phân loại):
```
経験
約束
面接
我慢
支度
〜ばかりでなく
〜わけにはいかない
〜に違いない
〜ないうちに
〜っぱなし
```
→ **AI-define** → lưu bộ → mở bộ → **AI sinh đề test** → làm & chấm.
> *Fallback:* nếu AI-define lag, mở 1 bộ thẻ đã có sẵn; vẫn live phần AI-gen test.

---

## 👤 NGƯỜI 5 — AI Sensei (agentic) + kỹ năng AI + tổng kết

### (1) AI Chat Sensei `/chat` — chạy 4 prompt (mỗi cái 1 năng lực khác nhau)

**(a) Kiến thức + RAG dữ liệu hệ thống:**
```
「約束」ってどんな意味ですか？読み方と例文もお願いします。
```

**(b) Multimodal — đính kèm ảnh chứa chữ Nhật:**
```
Trong tấm ảnh này viết gì vậy? Dịch sang tiếng Việt giúp mình.
```
> Chuẩn bị 1 ảnh: chụp màn hình 1 câu tiếng Nhật (vd chụp chính bài đọc コンビニ, hoặc câu: `今日はいい天気ですね。`).

**(c) Agentic — ĐỌC dữ liệu cá nhân (gọi tool `get_my_learning_path`):**
```
Lộ trình học của mình hiện đang tới bước nào rồi?
```
> Backup (gọi `get_my_dashboard`): `Cho mình xem tổng quan học tập của mình: streak, số từ đã học nhé.`

**(d) Agentic — thao tác GHI cần XÁC NHẬN (gọi `update_profile_goal`):**
```
Đổi mục tiêu JLPT của mình sang N3 nhé.
```
> AI trả về **yêu cầu xác nhận** → bấm nút xác nhận mới chạy (`/ai/action/confirm`).
> Câu thoại: "Mọi thao tác GHI đều qua whitelist tool + phải người dùng xác nhận. AI KHÔNG thể xóa dữ liệu, đổi quyền, thanh toán hay nộp bài thi hộ. Đang thi thì AI bị khóa (BR-11)."
> Backup write (gọi `create_flashcard_set`): `Tạo giúp mình bộ thẻ tên "N5 cơ bản" gồm 3 thẻ: 水=nước, 火=lửa, 木=cây.`

### (2) Kỹ năng AI chấm điểm (chọn 1–2)

**Writing AI feedback (UC-31) `/writing`** — dán đoạn có lỗi cố ý:
```
私は先週、友達と京都へ行きました。お寺をたくさん見ました。京都はとても美しいでした。
私は日本語が上手になりたいだと思います。来年もまた京都に行きたいです。
```
> Lỗi cố ý để AI bắt: `美しいでした`→`美しかったです`; `なりたいだと`→`なりたいと`.

**Kanji writing scoring (UC-29) `/kanji/writing`** — vẽ 1 kanji đơn giản:
```
Kanji gợi ý để vẽ: 水  (hoặc 山 / 川) — nét đơn giản, dễ được điểm cao.
```

### (3) Tổng kết coverage (~45s)
Slide bản đồ 79 UC theo actor, tô đậm phần đã demo; điểm tên cụm còn lại (mock full-flow, dictation/listening UC-25/26, billing UC-38, revenue pool UC-76/77). Nêu các phần **(planned)** trong RDS (vd UC-37, UC-72) → nhóm phân biệt rõ "đã build" vs "trong phạm vi".

---

## ⚡ Cheatsheet URL (mở tab sẵn)

| Người | URL |
|---|---|
| 1 | `/teacher-application` · `/admin/teacher-applications` |
| 2 | workspace teacher → tạo bài đọc · `/teacher/question-bank` |
| 3 | `/admin/mock-exams` · `/admin/courses` · `/admin/subscriptions` · `/admin/system` |
| 4 | `/reading` · `/learning-path` · `/flashcards/new` |
| 5 | `/chat` · `/writing` · `/kanji/writing` |

## ⛑️ Quy tắc fallback chung
- AI live lag > ~10s → bung bản "đã sinh sẵn" tương ứng, người nói tiếp tục thoại, KHÔNG đứng chờ.
- KHÔNG mở mock exam đang thi trước khi demo AI Sensei (BR-11 khóa AI).
- Không demo login Google / reset password live (PKCE) — đăng nhập sẵn bằng email-password.

# ERD cho dbdiagram.io

Bộ file DBML sinh tự động từ **database live trên Supabase** (ngày 23/07/2026, sau migration 029/030/031) — dùng để vẽ sơ đồ ERD trên [dbdiagram.io](https://dbdiagram.io).

## Danh sách file

| File | Nội dung |
|---|---|
| `00-overview.dbml` | **Toàn cảnh 96 bảng** — 10 schema nghiệp vụ + `public` + `auth`, nhóm theo TableGroup, mỗi bảng chỉ hiện cột khóa (PK/FK) cho dễ đọc, đủ 138 quan hệ |
| `01-users-module.dbml` | Người dùng & hồ sơ (6 bảng + stub) |
| `02-course-module.dbml` | Khóa học & bài học (11 bảng + stub) |
| `03-language-module.dbml` | Kho từ vựng / kanji / ngữ pháp & bài đăng (17 bảng + stub) |
| `04-practice-module.dbml` | Luyện đọc / nghe / viết / nói (12 bảng + stub) |
| `05-flashcard-module.dbml` | Flashcard (6 bảng + stub) |
| `06-exam-module.dbml` | Quiz & ngân hàng câu hỏi (9 bảng + stub) |
| `07-jlpt-module.dbml` | Thi thử JLPT (8 bảng + stub) |
| `08-dictionary-module.dbml` | Từ điển (5 bảng) |
| `09-billing-module.dbml` | Thanh toán & gói cước (11 bảng + stub) |
| `10-ai-module.dbml` | AI Sensei & lộ trình học (9 bảng + stub) |

File từng schema hiển thị **đầy đủ cột** (kiểu dữ liệu, PK, unique, not null, default). Các bảng thuộc schema khác được tham chiếu tới chỉ hiện dạng **stub** (chỉ có cột `id` + ghi chú) để sơ đồ vẫn vẽ được quan hệ cross-schema mà không rối.

## Cách dùng

1. Vào [dbdiagram.io](https://dbdiagram.io) → **New Diagram**.
2. Xóa nội dung mẫu ở khung code bên trái, **dán nguyên nội dung 1 file `.dbml`** vào — sơ đồ render ngay (DBML là ngôn ngữ gốc của dbdiagram, không cần qua nút Import).
3. Kéo thả sắp xếp bảng cho đẹp → **Export** → PNG / PDF / SVG để đưa vào slide/tài liệu.

**Lưu ý gói miễn phí**: dbdiagram free chỉ cho lưu tối đa 10 diagram. Nếu vượt, dùng 1 diagram duy nhất: dán file → chỉnh → export ảnh → xóa dán file kế tiếp.

## Ghi chú

- Quan hệ **đa hình** (không có FK cứng trong DB) không được vẽ thành đường nối, chỉ ghi chú dạng comment đầu file: `study_list_items.item_id` (language_module) và `learning_path_steps.resource_id` (ai_module).
- `auth.users` là bảng của Supabase Auth (nguồn định danh gốc) — hiện dạng stub.
- Chi tiết thiết kế, nguyên tắc phân chia schema: xem [`docs/database-design.md`](../database-design.md).

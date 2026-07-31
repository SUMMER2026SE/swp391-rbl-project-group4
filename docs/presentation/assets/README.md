# Ảnh cần chèn vào slide

Đặt file ảnh vào **chính thư mục này** (`docs/presentation/assets/`), đúng tên ở cột "Tên file".

Cách chèn: mở `../kizuna-nihongo.html`, tìm khối placeholder tương ứng rồi **thay cả khối**

```html
<div class="imgph full"> … </div>
```

bằng

```html
<img src="assets/db-overview.png" alt="ERD tổng quan" class="shot">
```

(class `shot` đã có sẵn: `object-fit: contain`, bo góc, đổ bóng — ảnh tự vừa khung, không cần resize.)

| Phần | Slide | Tên file | Nội dung |
|---|---|---|---|
| Cover | Bìa | `landing-hero.png` | Screenshot trang landing (chèn vào hình tròn — xem hướng dẫn ở đầu file HTML) |
| I | Motivation | `why-market.png` | *(tuỳ chọn)* Biểu đồ khảo sát học viên / số liệu thị trường |
| II | Mazii | `ref-mazii.png` | Screenshot Mazii (tra từ / danh sách học tập) |
| II | Bunpro | `ref-bunpro.png` | Screenshot Bunpro (queue review / danh sách ngữ pháp theo cấp) |
| III | Landscape | `uc-overview.png` | Use case diagram tổng thể toàn hệ thống |
| III | Authentication | `uc-auth.png` | Use case diagram — Authentication |
| III | Student | `uc-student.png` | Use case diagram — Student |
| III | Teacher | `uc-teacher.png` | Use case diagram — Teacher |
| III | Admin | `uc-admin.png` | Use case diagram — Admin |
| **IV** | Schema Map | `db-overview.png` | **ERD toàn bộ 96 bảng** — export từ `docs/erd/00-overview.dbml` |
| **IV** | Identity/Courses/Corpus | `db-learner.png` | ERD gộp `01-users-module` + `02-course-module` + `03-language-module` |
| **IV** | Practice & Assessment | `db-practice-exam.png` | ERD gộp `04-practice` + `05-flashcard` + `06-exam` + `07-jlpt` |
| **IV** | Dictionary/Money/AI | `db-billing-ai.png` | ERD gộp `08-dictionary` + `09-billing` + `10-ai-module` |
| **IV** | Cross-schema | `db-crossschema.png` | *(tuỳ chọn)* Sơ đồ quan hệ liên schema |
| V | Component Diagram | `package-diagram.png` | Package / component diagram của source code |

## Cách export ERD

1. Vào [dbdiagram.io](https://dbdiagram.io) → **New Diagram**.
2. Dán nguyên nội dung file `.dbml` trong `docs/erd/` vào khung code bên trái.
3. Sắp xếp bảng cho gọn → **Export → PNG**.
4. Đổi tên theo bảng trên rồi copy vào thư mục này.

Ảnh ERD nên xuất ở **độ phân giải cao** (dbdiagram export PNG mặc định đã đủ) vì slide render ở khung 1920×1080.

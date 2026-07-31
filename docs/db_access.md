# III. Design Specification

## 0. Database conventions used in this document

The database is **PostgreSQL 17 (Supabase)**, organised as *schema-per-domain*. Every business table lives in a domain schema; `public` only holds system objects (`session`, `app_settings`), RPC functions and backward-compatibility views.

| Schema | Domain |
|--------|--------|
| `users_module` | User profiles, roles, teacher applications |
| `course_module` | Courses → units → lessons, enrolments, progress, reviews |
| `language_module` | Vocabulary / kanji / grammar catalog + study-list posts |
| `practice_module` | Reading, listening, writing and pronunciation practice |
| `flashcard_module` | Flashcard folders, sets, cards, progress |
| `exam_module` | Course quizzes + admin/teacher question banks |
| `jlpt_module` | JLPT mock exams + JLPT question bank |
| `dictionary_module` | Japanese–Vietnamese dictionary |
| `billing_module` | Subscription plans, payments, feature quotas, teacher payouts |
| `ai_module` | AI chat, personalized learning paths, dashboards, notifications |

Reading the SQL below:

1. **Compatibility views.** Part of the codebase still addresses tables through views kept in `public` (`public.users`, `public.courses`, `public.lessons`, `public.vocabulary`, `public.kanji`, `public.student_profiles`, `public.student_dashboards`, …). Each view is a 1:1 projection of the underlying module table, with `INSTEAD OF` triggers for insert/update/delete. A few columns are renamed by the view — most importantly `public.courses.level` ↔ `course_module.courses.jlpt_level_id` (mapped through `language_module.jlpt_levels`) and `public.lessons.lesson_type` / `order_index` ↔ `course_module.lessons.content_type` / `sort_order`. Statements are written against the object the code actually queries, with the underlying table named in the Database Access table.
2. **`auth.users`** is owned by Supabase Auth and is never touched with raw SQL — the backend uses the Admin API (`auth.admin.createUser` / `updateUserById` / `deleteUser`). The statements shown are the SQL equivalent. The user's role (`student` / `teacher` / `admin`) is stored in `auth.users.raw_user_meta_data->>'role'`, not in a table.
3. **Query builder, not raw SQL.** The backend uses the Supabase query builder with the `service_role` key (bypasses RLS). Every statement below is the SQL equivalent of those calls; `?` marks a bound parameter.
4. **Feature quotas.** A quota check is always the same three-table read (`billing_module.user_subscriptions` → `feature_entitlements` → `feature_usage_counters`), followed by an insert-or-update of the counter. It is spelled out in full in UC-26 and referenced by feature code elsewhere.

---

## 1. Authentication & Profile

---

### 1.1 UC-01_Register
Allows a guest to create a new account (as student or teacher) using email/password with email OTP verification, or via a Google account, to access the platform's features.

#### a. UI Design
[SCREENSHOT: Register screen (/register) — form step]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the screen title "Đăng ký" and the sub-title "Bắt đầu hành trình học tiếng Nhật" |
| Bạn đăng ký với vai trò | Choice | Role selector with two options: "Học viên" (student) and "Giáo viên" (teacher). When "Giáo viên" is chosen, shows note "Sau khi xác thực email, bạn sẽ cung cấp CV, bằng cấp/chứng chỉ để xét duyệt làm giáo viên." |
| Họ và tên | Input field | Field to enter the user's full name, placeholder "Nguyễn Văn A". Required |
| Email | Input field | Field to enter a valid email address, placeholder "you@example.com". Required, must follow email format |
| Mật khẩu | Input field | Field to enter the password, placeholder "Tối thiểu 8 ký tự". Required, at least 8 characters |
| Xác nhận mật khẩu | Input field | Field to re-enter the password, placeholder "Nhập lại mật khẩu". Must match the password |
| Tôi đồng ý với Điều khoản và Chính sách | Check mark | Consent checkbox; user must tick it to submit. "Điều khoản" and "Chính sách" are hyperlinks |
| Đăng ký | Button | Button to submit the registration form and request the verification OTP |
| Đăng ký với Google | Button | Button to register using a Google account (redirects to Google's sign-in page) |
| Đăng nhập | Hyperlink | With the text "Đã có tài khoản?", link that navigates to the Login screen (/login) |
| Error Message | Text | Displays validation errors such as "Bạn cần đồng ý với điều khoản sử dụng.", "Mật khẩu phải có ít nhất 8 ký tự.", or "Mật khẩu xác nhận không khớp." |
| Warning Message | Text | When the email already exists, displays "Email {email} đã được đăng ký." with quick links "Đăng nhập ngay" and "Quên mật khẩu?" |

**OTP verification step (after submitting the form):**

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Xác thực email" and sub-text "Mã xác thực 6 chữ số đã được gửi đến {email}" |
| OTP Code | Input field | 6-digit OTP input (one box per digit) for the code sent to the user's email |
| Xác nhận | Button | Button to verify the OTP and create the account |
| Gửi lại mã | Button | Resends the OTP; disabled during a 60-second cooldown showing "Gửi lại sau {n}s" |
| Quay lại chỉnh sửa thông tin | Hyperlink | Returns to the registration form |
| Error Message | Text | Displays "Vui lòng nhập đủ 6 chữ số.", "Mã OTP không đúng. Còn {n} lần thử.", or "Mã OTP đã hết hạn. Vui lòng đăng ký lại." |
| Success Message | Text | On success, shows "Đăng ký thành công." and signs the user in, or redirects to Login |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.users *(view of users_module.users)* | R | Check whether the email has already been registered before sending the OTP |
| auth.users | C | Create the authenticated user after the OTP is verified (Supabase Auth) |
| public.users *(view of users_module.users)* | C | Create the profile mirror row for the new user |
| public.student_profiles *(view of users_module.student_profiles)* | C | Create the student profile row for the new user |
| public.student_dashboards *(view of ai_module.student_dashboards)* | C | Create the student dashboard row for the new user |

**SQL Command:** *(the OTP is held in server memory, never in the database. Statements 3–5 are written twice over: the `handle_new_user` trigger on `auth.users` inserts them straight into `users_module.users`, `users_module.student_profiles` and `ai_module.student_dashboards`, and the backend then re-issues the same rows as idempotent upserts through the compatibility views, so registration can never leave a user without a profile)*
1. Check existing email — `SELECT id FROM public.users WHERE email ILIKE ? LIMIT 1`
2. Create auth user — `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at) VALUES (?, crypt(?, gen_salt('bf')), jsonb_build_object('full_name', ?), now())`
3. Create profile mirror — `INSERT INTO public.users (id, full_name, email) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING`
4. Create student profile — `INSERT INTO public.student_profiles (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING`
5. Create student dashboard — `INSERT INTO public.student_dashboards (student_id) VALUES (?) ON CONFLICT (student_id) DO NOTHING`

---

### 1.2 UC-02_Submit Teacher Application
Allows a signed-in user to apply to become a teacher by submitting professional details and supporting documents (CV, degree, certificate) for AI + admin review.

#### a. UI Design
[SCREENSHOT: Teacher Application screen (/teacher-application)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Hồ sơ đăng ký giáo viên" and sub-text "Cung cấp thông tin và tài liệu để chứng minh năng lực giảng dạy." |
| Bằng cấp cao nhất | Input field | Field to enter the highest qualification, placeholder "Cử nhân Ngôn ngữ Nhật, JLPT N1...". Required |
| Chuyên môn giảng dạy | Input field | Field to enter the teaching specialization, placeholder "Luyện thi JLPT N5-N2, giao tiếp..." |
| Số năm kinh nghiệm | Numerical | Field to enter years of teaching experience, placeholder "3" (minimum 0) |
| Học vấn / Quá trình đào tạo | Text | Multi-line field for education background, placeholder "Trường, ngành, năm tốt nghiệp..." |
| Giới thiệu bản thân | Text | Multi-line field for self-introduction, placeholder "Kinh nghiệm giảng dạy, thành tích, phương pháp..." |
| Số điện thoại | Input field | Field to enter the phone number, placeholder "09..." |
| Tài liệu chứng minh | File upload | Upload one or more supporting documents (CV, degree, certificate — PDF, image or DOCX). Each document has a type selector: "cv", "degree", "certificate", "other". Required (at least one file) |
| Gửi hồ sơ xét duyệt | Button | Button to submit the application for review |
| Error Message | Text | Displays "Vui lòng tải lên ít nhất một tài liệu (CV, bằng cấp hoặc chứng chỉ)." or "Vui lòng nhập bằng cấp cao nhất." |
| Success Message | Text | On auto-approval shows "Chúc mừng! Bạn đã trở thành giáo viên"; otherwise "Đơn đã được gửi để duyệt" with an AI preliminary comment "Nhận xét sơ bộ:" |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| users_module.teacher_applications | R | Check whether the user already has a pending application |
| users_module.teacher_applications | C | Insert the new teacher application (declared info + uploaded documents + AI review result) |
| auth.users | U | On AI auto-approval only, set the account role to `teacher` in the Auth metadata |

**SQL Command:** *(the uploaded files go to the private Supabase Storage bucket `teacher-documents`; only their metadata — type, name, path, mime, size — is stored in the `documents` jsonb column)*
1. Check existing pending application — `SELECT id FROM users_module.teacher_applications WHERE user_id = ? AND status = 'pending'`
2. Insert new application — `INSERT INTO users_module.teacher_applications (user_id, status, decided_by, phone, highest_qualification, specialization, years_experience, education, bio, documents, ai_verdict, ai_summary, ai_flags, ai_confidence, ai_model, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` *(`status` = `'approved'` and `decided_by` = `'ai'` when the AI auto-approves, otherwise `'pending'` / NULL)*
3. Grant the teacher role (auto-approval only) — `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', 'teacher') WHERE id = ?`

---

### 1.3 UC-03_Login
Allows a registered user to sign in to the platform with their email/password or a Google account to access their role-based features.

#### a. UI Design
[SCREENSHOT: Login screen (/login)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the screen title "Đăng nhập" with a lock icon and the tagline "Học tiếng Nhật tinh tế" |
| Email | Input field | Field to enter the email address, placeholder "you@example.com". Required, must follow email format |
| Mật khẩu | Input field | Field to enter the password (hidden), placeholder "••••••••". Required |
| Quên mật khẩu? | Hyperlink | Link that navigates to the Forgot Password screen (/forgot-password) |
| Đăng nhập | Button | Button to submit the email/password login form |
| Đăng nhập với Google | Button | Button to sign in with a Google account (redirects to Google's sign-in page) |
| Đăng ký | Hyperlink | With the text "Chưa có tài khoản?", link that navigates to the Register screen (/register) |
| Error Message | Text | Displays "Email hoặc mật khẩu không đúng." when the credentials are invalid |
| Warning Message | Text | Displays "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." when the session has expired |
| Success Message | Text | When redirected from register/reset, shows "Đăng ký thành công! Vui lòng kiểm tra email." or "Mật khẩu đã được đổi. Vui lòng đăng nhập." |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| auth.users | R | Verify the email and password on standard login (Supabase Auth) |
| auth.users | C / R | Google login: create the user row on first login, or read the linked user |

**SQL Command:** *(executed inside Supabase Auth — the code calls `supabase.auth.signInWithPassword` / `signInWithOAuth`)*
1. Verify email & password — `SELECT id, email, encrypted_password, raw_user_meta_data FROM auth.users WHERE email = ?` *(then compare the bcrypt-hashed password)*
2. Google login (first time) — `INSERT INTO auth.users (email, raw_app_meta_data, raw_user_meta_data) VALUES (?, ?, ?)` *(the `handle_new_user` trigger then creates the rows in `users_module.users`, `users_module.student_profiles` and `ai_module.student_dashboards`)*

---

### 1.4 UC-04_Logout
Allows a signed-in user to end their current session and return to the guest state.

#### a. UI Design
[SCREENSHOT: Header / navigation menu with the Logout item]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Đăng xuất | Button | Button (in the navigation menu) to sign the user out and clear the current session |

#### b. Database Access
Database Access: None *(logout is handled entirely by Supabase Auth via `supabase.auth.signOut()`, which revokes the client session; no application table is read or written)*

---

### 1.5 UC-05_Change Password
Allows a signed-in user to change their password from the Profile screen by providing their current password and a new one.

#### a. UI Design
[SCREENSHOT: Profile screen — "Đổi mật khẩu" section]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the section title "Đổi mật khẩu" |
| Mật khẩu hiện tại | Input field | Field to enter the current password, placeholder "Nhập mật khẩu đang dùng". Required |
| Mật khẩu mới | Input field | Field to enter the new password, placeholder "Tối thiểu 8 ký tự". Required, at least 8 characters |
| Xác nhận mật khẩu mới | Input field | Field to re-enter the new password, placeholder "Nhập lại mật khẩu mới". Must match the new password |
| Đổi mật khẩu | Button | Button to submit the password change |
| Error Message | Text | Displays "Vui lòng nhập mật khẩu hiện tại.", "Mật khẩu phải có ít nhất 8 ký tự.", "Mật khẩu xác nhận không khớp.", "Mật khẩu mới phải khác mật khẩu hiện tại.", or "Mật khẩu hiện tại không đúng." |
| Success Message | Text | Displays "Đổi mật khẩu thành công!" when the password is changed successfully |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| auth.users | R | Verify the current password before changing it |
| auth.users | U | Update the account password with the new value |

**SQL Command:** *(the code verifies the old password via `signInWithPassword` then updates via `supabase.auth.admin.updateUserById`)*
1. Verify current password — `SELECT id, encrypted_password FROM auth.users WHERE email = ?` *(then compare the bcrypt-hashed password)*
2. Update password — `UPDATE auth.users SET encrypted_password = crypt(?, gen_salt('bf')) WHERE id = ?`

---

### 1.6 UC-06_Forgot Password
Allows a user who forgot their password to request an email OTP and set a new password without logging in.

#### a. UI Design
[SCREENSHOT: Forgot Password screen (/forgot-password)]

**Step 1 — Request OTP:**

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Khôi phục mật khẩu" and sub-text "Nhập email để nhận mã xác thực (OTP) đặt lại mật khẩu." |
| Email | Input field | Field to enter the account email, placeholder "you@example.com". Required |
| Gửi mã xác thực | Button | Button to request the OTP sent to the email |

**Step 2 — Reset password:**

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays sub-text "Nhập mã 6 số đã gửi đến {email} và mật khẩu mới." |
| OTP Code | Input field | 6-digit OTP input for the code sent to the email |
| Mật khẩu mới | Input field | Field to enter the new password, placeholder "Tối thiểu 8 ký tự". Required, at least 8 characters |
| Xác nhận mật khẩu mới | Input field | Field to re-enter the new password, placeholder "Nhập lại mật khẩu mới". Must match |
| Đặt lại mật khẩu | Button | Button to verify the OTP and set the new password |
| Gửi lại mã | Button | Resends the OTP; disabled during a 60-second cooldown showing "Gửi lại sau {n}s" |
| Quay lại đăng nhập | Hyperlink | Link that navigates back to the Login screen |
| Error Message | Text | Displays "Vui lòng nhập email.", "Vui lòng nhập đủ 6 chữ số.", "Mật khẩu mới phải có ít nhất 8 ký tự.", "Mật khẩu xác nhận không khớp.", or "Mã OTP không đúng. Còn {n} lần thử." |
| Success Message | Text | After success, redirects to Login showing "Mật khẩu đã được đổi. Vui lòng đăng nhập." |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.users *(view of users_module.users)* | R | Look up the user by email to send the reset OTP (returns a generic message to avoid account enumeration) |
| auth.users | U | Update the account password after the OTP is verified |

**SQL Command:** *(the OTP is held in server memory; the password update uses `supabase.auth.admin.updateUserById`)*
1. Find user by email — `SELECT id, full_name FROM public.users WHERE email ILIKE ? LIMIT 1`
2. Update password — `UPDATE auth.users SET encrypted_password = crypt(?, gen_salt('bf')) WHERE id = ?`

---

### 1.7 UC-07_View Profile
Allows a signed-in user to view their personal information and (for students) learning statistics on the Profile screen.

#### a. UI Design
[SCREENSHOT: Profile screen (/profile) — view mode]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the page title "Hồ sơ" |
| Avatar | Image | Displays the user's avatar, or the first letter of the name when no avatar is set |
| Full name & Email | Text | Displays the user's full name and email under the avatar |
| Giờ học | Text | (Student only) Displays total study hours derived from total study minutes |
| Ngày liên tiếp | Text | (Student only) Displays the current streak in days |
| Mục tiêu JLPT | Text | (Student only) Displays the target JLPT level, or "—" if not set |
| Trình độ hiện tại | Text | (Student only) Displays the current level, or "—" if not set |
| Thông tin cá nhân | Heading | Section title for the personal information block (see UC-08 for editable fields) |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.users *(view of users_module.users)* | R | Read the user's basic info (full name, email, phone, avatar) |
| public.student_profiles *(view of users_module.student_profiles)* | R | Read the student's JLPT target, current level and study goal |
| public.student_dashboards *(view of ai_module.student_dashboards)* | R | Read the student's learning statistics (streak, total study minutes) |

**SQL Command:** *(the three reads are issued in parallel; a missing profile/dashboard row is tolerated and rendered as empty)*
1. Read user info — `SELECT full_name, email, phone, avatar_url, date_of_birth FROM public.users WHERE id = ?`
2. Read student profile — `SELECT jlpt_target_level, current_level, study_goal, daily_study_minutes, streak_days FROM public.student_profiles WHERE user_id = ?`
3. Read student dashboard — `SELECT current_streak, total_study_minutes, longest_streak FROM public.student_dashboards WHERE student_id = ?`

---

### 1.8 UC-08_Edit Profile
Allows a signed-in user to update their personal information and avatar; the email field is read-only.

#### a. UI Design
[SCREENSHOT: Profile screen (/profile) — "Thông tin cá nhân" section]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Họ và Tên | Input field | Field to edit the full name. Required |
| Email | Input field | Displays the email; read-only, cannot be edited |
| Số điện thoại | Input field | Field to edit the phone number, placeholder "+84..." |
| Mục tiêu JLPT | Combo box | (Student only) Dropdown to choose the target JLPT level: "-- Chưa chọn --", "N5", "N4", "N3", "N2", "N1" |
| Mục tiêu học tập | Text | (Student only) Multi-line field for the study goal, placeholder "Chia sẻ đôi chút về hành trình học tiếng Nhật của bạn..." |
| Avatar upload | File upload | Click the avatar to choose an image (JPEG, PNG, WebP or GIF, max 5MB), then "Lưu ảnh" to upload |
| Lưu thay đổi | Button | Button to save the personal information changes |
| Hủy bỏ | Button | Button to reset the form to the last saved values |
| Error Message | Text | Displays "Họ và tên không được để trống." or "Chỉ chấp nhận file ảnh JPEG, PNG, WebP hoặc GIF." |
| Success Message | Text | Displays "Đã lưu thay đổi!" after saving, or "Ảnh đại diện đã được cập nhật!" after an avatar upload |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.users *(view of users_module.users)* | U | Update the full name and phone (and avatar URL after an avatar upload) |
| public.student_profiles *(view of users_module.student_profiles)* | U | Update the target JLPT level, study goal and — when explicitly supplied — the current level |
| auth.users | U | Sync the full name / avatar into the Supabase Auth user metadata |

**SQL Command:** *(the avatar image itself is stored in the Supabase Storage `avatars` bucket under `<user_id><ext>`; only its public URL is written to the database. Auth metadata is updated through the Supabase Admin API, which merges into the existing metadata rather than replacing it)*
1. Update user info — `UPDATE public.users SET full_name = ?, phone = ? WHERE id = ?`
2. Update student profile — `UPDATE public.student_profiles SET jlpt_target_level = ?, study_goal = ? WHERE user_id = ?` *(plus `current_level = ?` only when the client sends it)*
3. Sync auth metadata — `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('full_name', ?) WHERE id = ?`
4. Update avatar URL — `UPDATE public.users SET avatar_url = ? WHERE id = ?`
5. Sync avatar into auth metadata — `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('avatar_url', ?) WHERE id = ?`

---

## 2. Learning & Courses

---

### 2.1 UC-09_Generate Personalized Learning Roadmap
Allows a student to have the AI build a personalized study roadmap from their current level to a target level, based on the level and study goal they declare, then track step-by-step progress.

#### a. UI Design
[SCREENSHOT: Learning Path screen (/learning-path) — setup form]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Tạo lộ trình học cá nhân hoá" and sub-text "AI sẽ xây dựng lộ trình riêng cho bạn, từ trình độ hiện tại đến mục tiêu, dựa trên điểm mạnh/yếu của bạn." |
| Trình độ hiện tại | Combo box | Dropdown to choose the current level ("-- Chọn --", "N5"–"N1"). Required; prefilled from the student's profile when set |
| Mục tiêu | Combo box | Dropdown to choose the target level ("-- Tự động --", "N5"–"N1"). Hint "Bỏ trống để tăng 1 cấp." |
| Mục tiêu học tập (tùy chọn) | Text | Optional multi-line field for the study goal, placeholder "Ví dụ: Thi đậu N3 trong 6 tháng, cải thiện kanji…" |
| Thời gian học mỗi ngày (phút, tùy chọn) | Numerical | Optional field for daily study minutes, placeholder "30" (minimum 0) |
| Tạo lộ trình | Button | Button to request the AI to generate the roadmap |
| Error Message | Text | Displays "Vui lòng chọn trình độ hiện tại." or, when the monthly quota is exhausted, "Bạn đã dùng hết lượt tạo lộ trình tháng này. Nâng cấp Premium để tạo không giới hạn." |
| Loading state | Text | While generating, shows "Đang thiết kế lộ trình của bạn…" with sub-text "AI đang phân tích trình độ và mục tiêu để chọn học liệu phù hợp nhất. Vui lòng chờ trong giây lát." |

**Roadmap view (when an active path exists):**

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the label "Lộ trình cá nhân hoá" and heading "{current_level} → {target_level}", with the study goal in italics |
| Tạo lại | Button | Opens a confirm modal "Tạo lại lộ trình?" ("Lộ trình hiện tại sẽ được lưu trữ và thay bằng một lộ trình mới do AI tạo.") to regenerate the roadmap |
| Tiến độ | Text | Progress bar showing "{completed}/{total} bước · {pct}%" |
| Step card | Text | Each step shows a skill badge ("Từ vựng", "Kanji", "Ngữ pháp", "Đọc hiểu", "Nghe", "Tổng hợp"), a resource-type badge ("Khóa học", "Danh sách", "Thi thử"), the title, description and an AI rationale |
| Step status node | Check mark | Circular node to toggle a step between pending and "Đã hoàn thành" |
| Bắt đầu | Button | Navigates to the step's resource (course / study list / mock exam); shows "Học liệu không còn khả dụng." if the resource was removed |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| billing_module.feature_usage_counters *(+ user_subscriptions, feature_entitlements)* | R / U | Check the monthly roadmap-generation quota and increment it after a successful generation (see UC-26) |
| public.student_profiles *(view of users_module.student_profiles)* | R | Read the student's current level, target and study goal to prefill and guide generation |
| public.courses *(view of course_module.courses)* | R | Read the published course catalog for the level span so the AI can select resources |
| language_module.study_list_posts | R | Read the study-list posts for the level span as candidate resources |
| jlpt_module.mock_exams | R | Read the published mock exams for the level span as candidate resources |
| ai_module.learning_paths | U | Archive the currently active path before creating a new one |
| ai_module.learning_paths | C | Insert the newly generated learning path |
| ai_module.learning_path_steps | C | Insert the generated roadmap steps |
| ai_module.learning_paths / learning_path_steps | R | Read the active path and its ordered steps to render the roadmap |
| ai_module.learning_path_steps | U | Mark a step as completed / pending when the student toggles it |

**SQL Command:** *(the AI may only choose resources that appear in the catalog it was given — each generated step is validated against that catalog before it is inserted. Quota feature code: `learning_path_generate_monthly`)*
1. Check generation quota — `SELECT used_count FROM billing_module.feature_usage_counters WHERE user_id = ? AND feature_code = 'learning_path_generate_monthly' AND period_key = ?` *(`period_key` = `YYYY-MM`; see UC-26 for the full quota lookup)*
2. Read student profile — `SELECT current_level, jlpt_target_level, study_goal, daily_study_minutes FROM public.student_profiles WHERE user_id = ?`
3. Read course catalog — `SELECT id, title, level, description FROM public.courses WHERE level IN (?) AND is_published = true LIMIT 40`
4. Read study-list catalog — `SELECT id, title, list_type, level, description FROM language_module.study_list_posts WHERE level IN (?) LIMIT 40`
5. Read mock-exam catalog — `SELECT id, title, level FROM jlpt_module.mock_exams WHERE level IN (?) AND is_published = true LIMIT 40`
6. Archive current path — `UPDATE ai_module.learning_paths SET status = 'archived', updated_at = now() WHERE user_id = ? AND status = 'active'`
7. Insert new path — `INSERT INTO ai_module.learning_paths (user_id, current_level, target_level, study_goal, daily_minutes, ai_model) VALUES (?, ?, ?, ?, ?, ?) RETURNING id` *(`status` defaults to `'active'`)*
8. Insert steps — `INSERT INTO ai_module.learning_path_steps (path_id, order_index, title, description, skill_focus, rationale, resource_type, resource_id, resource_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` *(`status` defaults to `'pending'`)*
9. Increment quota — `UPDATE billing_module.feature_usage_counters SET used_count = used_count + 1, updated_at = now() WHERE user_id = ? AND feature_code = 'learning_path_generate_monthly' AND period_key = ?`
10. Read active path — `SELECT * FROM ai_module.learning_paths WHERE user_id = ? AND status = 'active'`
11. Read its steps — `SELECT * FROM ai_module.learning_path_steps WHERE path_id = ? ORDER BY order_index`
12. Resolve step resources — `SELECT id, title, level FROM public.courses WHERE id IN (?)` / `SELECT id, title, level, list_type FROM language_module.study_list_posts WHERE id IN (?)` / `SELECT id, title, level FROM jlpt_module.mock_exams WHERE id IN (?)`
13. Update step status — `UPDATE ai_module.learning_path_steps SET status = ?, completed_at = ? WHERE id = ?`

---

### 2.2 UC-10_Enroll in Course
Allows a student to enroll in a course. Free courses are enrolled directly after confirmation; paid courses require a completed payment before enrollment.

#### a. UI Design
[SCREENSHOT: Course Detail screen (/courses/:id) — enrollment CTA]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Price | Text | Displays "Miễn phí" for a free course, or the formatted price (e.g. "199.000₫") for a paid course |
| Đăng ký học miễn phí / Mua khóa học | Button | Primary CTA: "Đăng ký học miễn phí" for a free course, or "Mua khóa học - {price}" for a paid course |
| Đăng ký khóa học | Choice | Confirmation modal for free courses, with buttons "Đăng ký ngay" and "Hủy" |
| Vào học / Tiếp tục học | Button | Shown when already enrolled: "Vào học" (not started) or "Tiếp tục học" (in progress) |
| Học viên đã đăng ký | Text | Displays the enrollment count "{n} học viên đã đăng ký" |
| Error Message | Text | Displays "Bạn đã đăng ký khóa học này." (already enrolled) or "Khóa học có phí — vui lòng thanh toán để đăng ký." (paid, unpaid) |
| Success Message | Text | Displays "Đăng ký thành công! Chúc bạn học tốt." after a successful enrollment |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| course_module.courses | R | Read the course to verify it is published and whether it is free or paid |
| course_module.course_enrollments | R | Check whether the student is already enrolled |
| billing_module.payments | R | For a paid course, verify the student has a completed payment |
| course_module.course_enrollments | C | Insert the new enrollment record |

**SQL Command:** *(for a paid course the enrollment is normally created by the database trigger `trg_payment_completed_enroll`, which fires when a row in `billing_module.payments` reaches `payment_status = 'completed'`; the endpoint below is the fallback path and therefore requires that payment to already exist. An admin bypasses the payment check)*
1. Get course — `SELECT id, is_free, price, is_published FROM course_module.courses WHERE id = ?`
2. Check existing enrollment — `SELECT id FROM course_module.course_enrollments WHERE course_id = ? AND student_id = ?`
3. Verify payment (paid course) — `SELECT id FROM billing_module.payments WHERE course_id = ? AND student_id = ? AND payment_status = 'completed' LIMIT 1`
4. Insert enrollment — `INSERT INTO course_module.course_enrollments (course_id, student_id) VALUES (?, ?)` *(a `UNIQUE (course_id, student_id)` violation is reported as "Bạn đã đăng ký khóa học này.")*
5. Enrollment status (on load) — `SELECT id FROM course_module.course_enrollments WHERE course_id = ? AND student_id = ?` and `SELECT payment_status FROM billing_module.payments WHERE course_id = ? AND student_id = ? ORDER BY created_at DESC LIMIT 1`

---

### 2.3 UC-11_View Course Content
Allows a student to view a course's information, its unit/lesson structure and their learning progress; locked lessons are shown for users who have not enrolled.

#### a. UI Design
[SCREENSHOT: Course Detail screen (/courses/:id) — content list]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Danh mục khóa học | Hyperlink | Back link that returns to the course catalog |
| Level badge | Text | Displays the course level "JLPT{level}" or "Tổng hợp" for mixed courses |
| Course summary | Text | Displays "{units} bài học • {items} mục" and, if any, the reference curriculum badge |
| Title | Heading | Displays the course title and its Japanese title (title_ja) |
| Description | Text | Displays the course description, or "Khám phá nội dung và bắt đầu hành trình học tiếng Nhật của bạn." when empty |
| Tiến độ học tập | Text | (Enrolled only) Progress card showing "Đã hoàn thành {done}/{total} mục" and "{pct}%" |
| Nội dung khóa học | Heading | Section title for the course content; each unit is an expandable row showing its title, title_ja and "{n} mục" |
| Lesson row | Text | Each lesson shows a type badge ("Video", "Bài đọc", "Từ vựng", "Kanji", "Ngữ pháp", "Quiz") and an "ĐANG HỌC" tag for the current lesson. Locked lessons show tooltip "Đăng ký khóa học để mở mục này" |
| Đánh giá | Heading | Reviews section showing "Đánh giá ({total})" |
| Empty state | Text | When the course has no content, shows "Chưa có nội dung nào" |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.courses *(view of course_module.courses)* | R | Read the course's base details (title, level, description, thumbnail) |
| course_module.courses | R | Read the extended fields (is_free, price, creator type, enrollment count, average rating, reference curriculum) |
| course_module.units | R | Read the course units, ordered by sort order |
| public.lessons *(view of course_module.lessons)* | R | Read the lessons belonging to the course |
| course_module.lesson_progress | R | Read the student's per-lesson completion status |
| course_module.course_enrollments | R | Determine whether the student is enrolled (to lock/unlock lessons) |
| course_module.course_reviews | R | Read the course reviews shown in the "Đánh giá" section |

**SQL Command:** *(the base fields come from the compatibility view — which exposes `level` instead of `jlpt_level_id`, and `lesson_type` / `order_index` instead of `content_type` / `sort_order` — while the newer commercial fields are read straight from the module table. Completion is a `status` value, not a boolean)*
1. Get course (base) — `SELECT * FROM public.courses WHERE id = ? AND is_published = true`
2. Get course (extended) — `SELECT is_free, price, creator_type, enrollment_count, avg_rating, difficulty_level, reference_curriculum FROM course_module.courses WHERE id = ?`
3. Get units — `SELECT id, title, title_ja, sort_order FROM course_module.units WHERE course_id = ? ORDER BY sort_order`
4. Get lessons — `SELECT id, unit_id, title, title_ja, lesson_type, order_index, duration_minutes, question_count FROM public.lessons WHERE course_id = ? ORDER BY order_index`
5. Get lesson progress — `SELECT lesson_id FROM course_module.lesson_progress WHERE student_id = ? AND status = 'completed' AND lesson_id IN (?)`
6. Check enrollment — `SELECT id FROM course_module.course_enrollments WHERE course_id = ? AND student_id = ?`
7. Get reviews — `SELECT id, course_id, student_id, rating, comment, created_at, updated_at FROM course_module.course_reviews WHERE course_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`

---

### 2.4 UC-12_Take Course Quiz
Allows a student to take a lesson quiz in strict full-screen mode, submit answers, receive a score, and automatically complete the lesson when the passing threshold is met.

#### a. UI Design
[SCREENSHOT: Quiz screen (/quizzes/:id)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the quiz title |
| Strict mode notice | Text | For strict quizzes, shows "Chế độ toàn màn hình nghiêm ngặt" with rules: the quiz must be taken in full screen, and more than {N} violations locks the quiz for 20 minutes |
| Question | Text | Displays the current question content and its options |
| Answer input | Choice / Check mark / Input field | Single-choice options, multi-select ("Chọn tất cả đáp án đúng:"), ordering ("Bấm các từ bên dưới theo đúng thứ tự…"), or a free-text field with placeholder "Nhập câu trả lời…", depending on question type |
| Câu trước / Câu sau | Button | Navigate between questions; "Câu sau" is disabled until the current question is answered |
| Nộp bài | Button | Button to submit all answers and grade the quiz |
| Result | Text | After submission shows "Kết quả" with the score "{score}/{total}", per-question review ("Câu trả lời của bạn:"), and buttons "Làm lại" and "Quay lại" |
| Lockout Message | Text | Displays "Bài thi đã bị khóa" / "Bài thi đang bị khóa" when the student exceeds the allowed full-screen violations |
| Hidden overlay | Text | Displays "Nội dung bị ẩn" when the student leaves full screen or switches tab/window |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| exam_module.quizzes | R | Read the quiz metadata (mode, strict full-screen, passing threshold, lesson link) |
| exam_module.quiz_questions | R | Read the questions — options only when serving the quiz, correct answers only server-side when grading |
| exam_module.quiz_lockouts | R | Read the current violation count / lockout deadline before the quiz is served |
| exam_module.quiz_lockouts | C / U | Upsert the violation count and lockout deadline on each full-screen exit |
| exam_module.quiz_attempts | C | Insert the graded attempt (score, answers, passed, proctoring data) |
| exam_module.quiz_attempts | R | Read the student's previous attempts for this quiz |
| course_module.lesson_progress | C / U | Mark the linked lesson as completed when the student passes |

**SQL Command:** *(grading happens entirely server-side — correct answers are never sent to the client. Short-answer questions may additionally be graded by the AI, whose verdict is stored in `ai_feedback`. Full-screen violations are recorded server-side so a page reload cannot reset the counter)*
1. Get quiz — `SELECT * FROM exam_module.quizzes WHERE id = ?`
2. Check lockout — `SELECT violation_count, locked_until FROM exam_module.quiz_lockouts WHERE quiz_id = ? AND user_id = ?`
3. Get questions (for the student) — `SELECT id, question, options, question_type, bank_question_id, passage_snapshot, order_index FROM exam_module.quiz_questions WHERE quiz_id = ? ORDER BY order_index`
4. Get questions (for grading) — `SELECT id, question, question_type, options, correct_answer, correct_answer_data FROM exam_module.quiz_questions WHERE quiz_id = ?`
5. Insert attempt — `INSERT INTO exam_module.quiz_attempts (quiz_id, user_id, score, total_questions, answers, passed, mode, violation_count, proctor_events, snapshots, ai_feedback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
6. Record full-screen violation — `INSERT INTO exam_module.quiz_lockouts (quiz_id, user_id, violation_count, locked_until, updated_at) VALUES (?, ?, ?, ?, now()) ON CONFLICT (quiz_id, user_id) DO UPDATE SET violation_count = EXCLUDED.violation_count, locked_until = EXCLUDED.locked_until, updated_at = EXCLUDED.updated_at`
7. Auto-complete lesson on pass — `SELECT id FROM course_module.lesson_progress WHERE lesson_id = ? AND student_id = ?` then either `UPDATE course_module.lesson_progress SET status = 'completed', progress_pct = 100, completed_at = now() WHERE id = ?` or `INSERT INTO course_module.lesson_progress (student_id, lesson_id, status, progress_pct, last_position, time_spent_sec, completed_at) VALUES (?, ?, 'completed', 100, 0, 0, now())`
8. Read results — `SELECT * FROM exam_module.quiz_attempts WHERE quiz_id = ? AND user_id = ? ORDER BY completed_at DESC`

---

## 7. Listening & Speaking

*All four use cases live on the Listening screen (/listening), which has a mode toggle "Thư viện" / "Của tôi" and three practice tabs "Nghe" / "Chép chính tả" / "Shadowing".*

---

### 7.1 UC-24_Listen to Dialogues
Allows a student to browse the dialogue library by JLPT level and listen to a conversation line by line, with speaker labels and full playback.

#### a. UI Design
[SCREENSHOT: Listening screen (/listening) — "Nghe" tab, library mode]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Luyện nghe" and sub-text "Nghe hội thoại & bài nghe của bạn — luyện chép chính tả và shadowing với AI chấm phát âm." |
| Thư viện / Của tôi | Choice | Mode toggle between the shared library ("Thư viện") and the student's own content ("Của tôi") |
| Level filter | Combo box | Filter dialogues by level: "all", "N5"–"N1" |
| Dialogue card | Text | Each library item shows its level chip, Japanese title and topic; clicking it opens the dialogue |
| Nghe / Chép chính tả / Shadowing | Choice | Tab selector for the three practice modes |
| Dialogue line | Text | Each line shows the speaker, the Japanese sentence and its Vietnamese translation, with a per-line play button |
| Phát toàn bộ / Dừng | Button | Plays the whole dialogue ("Phát toàn bộ") or stops playback ("Dừng") |
| Empty state | Text | When no dialogue matches, shows "Chưa có bài nghe cấp {level}" |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| practice_module.listening_dialogues | R | Read the list of dialogues filtered by level, and the selected dialogue |
| practice_module.listening_dialogue_lines | R | Read the ordered lines of the selected dialogue |
| practice_module.listening_user_audios | R | Read the public media items (admin-created TTS / audio / video) shown alongside the scripted dialogues |
| billing_module.content_usage_events | C | Log the view when the dialogue was created by a teacher (input to the teacher revenue pool) |

**SQL Command:** *(the library list merges two sources — scripted dialogues and public media content — into one level-filtered list. The usage log is deduplicated to one row per student / content / day and skips admin-created content and the author's own views)*
1. List dialogues — `SELECT id, title, title_vi, level, topic, thumbnail_icon FROM practice_module.listening_dialogues WHERE level = ? ORDER BY level, created_at`
2. List public media — `SELECT id, title, title_vi, level, source_type, created_at FROM practice_module.listening_user_audios WHERE is_public = true AND level = ? ORDER BY created_at DESC`
3. Get dialogue — `SELECT * FROM practice_module.listening_dialogues WHERE id = ?`
4. Get dialogue lines — `SELECT id, line_order, speaker, text_jp, text_plain, text_vi FROM practice_module.listening_dialogue_lines WHERE dialogue_id = ? ORDER BY line_order`
5. Log teacher-content use — `INSERT INTO billing_module.content_usage_events (student_id, content_type, content_id, teacher_id, period_key, day_key) VALUES (?, 'listening', ?, ?, ?, ?) ON CONFLICT (student_id, content_type, content_id, day_key) DO NOTHING`

---

### 7.2 UC-25_Practice Dictation
Allows a student to practice dictation by listening to each line/segment, typing what they hear, and comparing their input with the correct answer.

#### a. UI Design
[SCREENSHOT: Listening screen (/listening) — "Chép chính tả" tab]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Nghe câu này / Nghe đoạn này | Button | Plays the current line, or the current audio segment "Nghe đoạn này ({start}–{end})" for self-created content |
| Dictation input | Input field | Field to type what was heard, placeholder "Chép lại những gì bạn nghe được..." (or "Gõ những gì bạn nghe được..." for audio content) |
| Kiểm tra | Button | Button to check the typed answer against the correct text |
| Bạn viết / Đáp án đúng | Text | After checking, shows the student's input under "Bạn viết:" and the correct text under "Đáp án đúng:" (or "Đáp án:") |
| Câu tiếp / Xem kết quả | Button | Moves to the next line ("Câu tiếp" / "Tiếp theo") or shows the summary ("Xem kết quả") |
| Result | Text | Displays "Kết quả chép chính tả" with a "Làm lại" button to restart |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| practice_module.listening_dialogue_lines | R | Read the line text used as the dictation answer (reuses the content already loaded in UC-24) |
| practice_module.listening_user_audios | R | Read the transcript segments used as the answer for self-created content (reuses the content already loaded in UC-27) |

**SQL Command:** *(dictation is graded on the client by comparing the typed input with the line/segment text already loaded; neither the attempt nor the result is written to the database)*
1. Read line text — `SELECT text_jp, text_plain FROM practice_module.listening_dialogue_lines WHERE dialogue_id = ? ORDER BY line_order`
2. Read segment text — `SELECT transcript, segments FROM practice_module.listening_user_audios WHERE id = ?`

---

### 7.3 UC-26_Practice Shadowing (Pronunciation)
Allows a student to shadow each line by recording their voice; the AI transcribes the recording and returns a pronunciation score with feedback.

#### a. UI Design
[SCREENSHOT: Listening screen (/listening) — "Shadowing" tab]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Furigana | Toggle | Shows/hides furigana above the Japanese text |
| Nghe mẫu / Nghe đoạn | Button | Plays the reference audio for the current line/segment |
| Ghi âm (6s) | Button | Records the student's voice (auto-stops after 6 seconds); shows an animated "Dừng" while recording |
| Scoring state | Text | While the AI scores, shows "Đang chấm..." / "Chấm điểm..." |
| Score & feedback | Text | Displays the pronunciation score and feedback ("Tuyệt vời! Phát âm rất chuẩn.", "Tốt lắm! Phát âm khá tốt.", "Cần luyện thêm một chút nữa là ổn.", or "Hãy nghe mẫu thêm và luyện tập lại nhé.") |
| AI transcript | Text | Displays what the AI heard: "AI nghe được: 「{transcript}」" |
| Điểm đã luyện | Text | Summary of the scores achieved across practiced lines |
| Error Message | Text | Displays "Lỗi chấm điểm. Thử lại nhé." or "Lỗi nhận dạng giọng nói." when scoring fails |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| billing_module.user_subscriptions | R | Resolve the user's tier (`free` / `premium`) |
| billing_module.feature_entitlements | R | Read the quota allowed for that tier and feature |
| billing_module.feature_usage_counters | R | Read how much of the quota has been used in the current period |
| billing_module.feature_usage_counters | C / U | Insert or increment the usage counter after each scoring |

**SQL Command:** *(the recorded audio is sent as base64, transcribed by Whisper and scored by edit distance against the target line; the score is returned to the client and **not** persisted. Quota feature code: `listening_practice_monthly`, period `YYYY-MM`. This is the full quota mechanism — other quota-bearing use cases below follow the same four statements and only cite their feature code)*
1. Resolve tier — `SELECT tier FROM billing_module.user_subscriptions WHERE user_id = ? AND status IN ('active', 'grace_period') ORDER BY created_at DESC LIMIT 1` *(no row → `free`)*
2. Read the entitlement — `SELECT limit_value, period_type FROM billing_module.feature_entitlements WHERE tier = ? AND feature_code = 'listening_practice_monthly'` *(`limit_value = -1` means unlimited)*
3. Read current usage — `SELECT used_count, used_amount FROM billing_module.feature_usage_counters WHERE user_id = ? AND feature_code = 'listening_practice_monthly' AND period_key = ?`
4. Increment usage — `UPDATE billing_module.feature_usage_counters SET used_count = used_count + 1, used_amount = used_amount + ?, updated_at = now() WHERE id = ?` — or, for the first use of the period, `INSERT INTO billing_module.feature_usage_counters (user_id, feature_code, period_type, period_key, used_count, used_amount, tier_at_time) VALUES (?, 'listening_practice_monthly', 'monthly', ?, 1, ?, ?)`

---

### 7.4 UC-27_Create Own Listening Content
Allows a student to create their own listening material from typed text (TTS), an uploaded audio/video file, or a YouTube link, then generate a transcript for dictation and shadowing.

#### a. UI Design
[SCREENSHOT: Listening screen (/listening) — "Của tôi" mode, create form]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Tạo bài nghe | Button | Opens the create form in "Của tôi" mode |
| Nguồn tạo | Choice | Source selector: "TTS (gõ chữ)", "File âm thanh", "File video", "Link YouTube" |
| Tên bài nghe | Input field | Field to enter the content title, placeholder "VD: Hội thoại quán cà phê" |
| Cấp độ | Combo box | Dropdown to choose the level ("N5"–"N1") |
| Lời thoại | Text | (TTS only) Multi-line script field "Lời thoại (mỗi câu 1 dòng; nhãn 男：/女： để đổi giọng)", placeholder shows a sample dialogue |
| Link YouTube | Input field | (YouTube only) Field to enter the video URL, placeholder "https://www.youtube.com/watch?v=..." |
| File upload | File upload | (Audio/Video only) Picker to "Chọn file âm thanh" or "Chọn file video (MP4/WebM)" |
| Tạo & chỉnh sửa transcript | Button | Button to create the content and open the transcript editor; shows "Đang xử lý..." while working |
| Error Message | Text | Displays "Nguồn không hợp lệ.", "Link YouTube không hợp lệ.", "Cần nội dung để đọc (TTS).", "Chưa chọn file.", or the quota message "Bạn đã tạo hết {used}/{limit} bài nghe tháng này." |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| billing_module.feature_usage_counters *(+ user_subscriptions, feature_entitlements)* | R / U | Check the monthly create quota and increment usage after creating (see UC-26) |
| practice_module.listening_user_audios | C | Insert the new self-created listening content (transcript + segments + media URL) |
| practice_module.listening_user_audios | R | List the student's own content, and read one item for ownership checks and playback |
| practice_module.listening_user_audios | U | Update the title / level / transcript / segments after AI transcription or manual editing |
| practice_module.listening_user_audios | D | Delete a self-created content item |

**SQL Command:** *(uploaded audio/video goes to a Supabase Storage bucket and TTS audio is synthesized server-side — only the resulting URL and storage path are stored. AI transcription returns a draft that is **not** auto-saved; it is persisted only when the student saves the transcript editor. Admin-created content is exempt from the quota and is inserted with `is_public = true`. Quota feature code: `listening_create_monthly`, period `YYYY-MM`)*
1. Check create quota — `SELECT used_count FROM billing_module.feature_usage_counters WHERE user_id = ? AND feature_code = 'listening_create_monthly' AND period_key = ?`
2. Insert content — `INSERT INTO practice_module.listening_user_audios (student_id, creator_type, is_public, title, title_vi, level, source_type, transcript, segments, audio_url, content_url, storage_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
3. Increment quota — `UPDATE billing_module.feature_usage_counters SET used_count = used_count + 1, updated_at = now() WHERE user_id = ? AND feature_code = 'listening_create_monthly' AND period_key = ?`
4. List my content — `SELECT id, title, title_vi, level, source_type, audio_url, content_url, transcript, segments, is_public, created_at FROM practice_module.listening_user_audios WHERE student_id = ? ORDER BY created_at DESC`
5. Open one item — `SELECT id, title, title_vi, level, source_type, audio_url, content_url, transcript, segments, is_public, student_id FROM practice_module.listening_user_audios WHERE id = ?`
6. Update content — `UPDATE practice_module.listening_user_audios SET title = ?, title_vi = ?, level = ?, transcript = ?, segments = ?, updated_at = now() WHERE id = ?`
7. Delete content — `DELETE FROM practice_module.listening_user_audios WHERE id = ?` *(the media file is removed from Storage in the same request)*

---

## 10. AI Chat Sensei

---

### 10.1 UC-34_Chat with AI Sensei
Allows a student to chat with the "Kizuna AI" assistant about vocabulary, kanji and grammar (including asking about an uploaded image); the AI can look up the catalog and propose write actions that require user confirmation. Conversations are saved as sessions.

#### a. UI Design
[SCREENSHOT: AI Chat screen (/chat)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Kizuna AI" and sub-text "Trợ lý học tiếng Nhật" |
| Session list | Text | Left sidebar listing past conversations; shows "Chưa có cuộc trò chuyện nào" when empty, with a delete action per session |
| Welcome | Text | On an empty chat shows "Xin chào! Tôi là Kizuna AI" |
| Suggested prompts | Button | Quick-start prompts: "水 (みず) có nghĩa là gì?", "Phân biệt は và が trong tiếng Nhật", "Giải thích kanji 愛 cho tôi", "Từ vựng JLPT N5 về gia đình" |
| Message input | Input field | Field to type a question, placeholder "Hỏi về từ vựng, kanji, ngữ pháp... (Enter gửi · Shift+Enter xuống dòng)" (or "Hỏi về hình ảnh này... (Enter gửi)" when an image is attached) |
| Image upload | File upload | Attach an image to ask the AI about it |
| Send | Button | Button (send icon) to submit the message; Enter sends, Shift+Enter adds a new line |
| Furigana | Toggle | Shows/hides furigana on Japanese text in the AI's detail cards |
| Detail card | Text | Rich answer cards: vocabulary ("Nghĩa tiếng Việt", "Giải thích tiếng Nhật", "Câu ví dụ") and kanji ("On-yomi", "Kun-yomi", "Nghĩa", "Số nét") |
| Action confirm card | Choice | When the AI proposes a write action, shows "Cần bạn xác nhận" with the action summary and buttons "Xác nhận" and "Huỷ" |
| Error Message | Text | Displays the quota message when the daily chat limit is reached, or a blocking message when an exam is in progress |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| ai_module.chat_sessions | C / R / U / D | Create, list, touch (on each new reply) and delete chat sessions |
| ai_module.chat_messages | C / R | Save each user/assistant message and read a session's history |
| public.vocabulary *(view of language_module.vocabulary)* | R | AI tool reads the vocabulary catalog to answer look-up questions |
| public.kanji *(view of language_module.kanji)* | R | AI tool reads the kanji catalog to answer look-up questions |
| jlpt_module.mock_attempts | R | Check for an in-progress mock exam — the assistant is blocked while the student is sitting one |
| billing_module.feature_usage_counters *(+ user_subscriptions, feature_entitlements)* | R / U | Check the daily chat quota and increment usage per message (see UC-26) |

**SQL Command:** *(the session title is derived from the first user message. The AI answers through read-only catalog tools; any write action it proposes is executed only after the user confirms it in the UI. Quota feature code: `ai_chat_daily`, period `YYYY-MM-DD`)*
1. Check chat quota — `SELECT used_count FROM billing_module.feature_usage_counters WHERE user_id = ? AND feature_code = 'ai_chat_daily' AND period_key = ?`
2. Exam guard — `SELECT id FROM jlpt_module.mock_attempts WHERE user_id = ? AND status = 'in_progress' AND section_deadline_at > now() LIMIT 1`
3. List sessions — `SELECT id, title, created_at, updated_at FROM ai_module.chat_sessions WHERE user_id = ? ORDER BY updated_at DESC`
4. Get session messages — `SELECT id, role, content, context_items, created_at FROM ai_module.chat_messages WHERE session_id = ? ORDER BY created_at`
5. Create session — `INSERT INTO ai_module.chat_sessions (user_id, title) VALUES (?, ?) RETURNING id`
6. Save message — `INSERT INTO ai_module.chat_messages (session_id, role, content, context_items) VALUES (?, ?, ?, ?)`
7. Touch session — `UPDATE ai_module.chat_sessions SET updated_at = now() WHERE id = ?`
8. Delete session — `DELETE FROM ai_module.chat_sessions WHERE id = ? AND user_id = ?` *(the messages are removed by cascade)*
9. AI vocabulary look-up — `SELECT id, kanji, reading, meaning_vi, meaning_ja, level, type, example_sentence FROM public.vocabulary WHERE kanji = ? OR reading = ? OR meaning_vi ILIKE ? LIMIT 5`
10. AI kanji look-up — `SELECT id, character, reading_on, reading_kun, meaning_vi, level, stroke_count FROM public.kanji WHERE character = ? OR meaning_vi ILIKE ? LIMIT 5`
11. Increment quota — `UPDATE billing_module.feature_usage_counters SET used_count = used_count + 1, updated_at = now() WHERE user_id = ? AND feature_code = 'ai_chat_daily' AND period_key = ?`

---

## 11. Progress Tracking (Student)

---

### 11.1 UC-35_View Learning Dashboard
Allows a student to view their learning dashboard: study statistics, current learning-path step, streak, JLPT goal and recent activity.

#### a. UI Design
[SCREENSHOT: Student Dashboard screen (/dashboard)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the page title "Bảng điều khiển" and a personalized greeting |
| Từ vựng | Text | Stat card showing the total vocabulary learned |
| Kanji | Text | Stat card showing the total kanji learned |
| Ngữ pháp | Text | Stat card showing the total grammar points learned |
| Giờ học | Text | Stat card showing total study hours (total study minutes ÷ 60) |
| Lộ trình học | Text | Card showing the active learning path and the "Bước tiếp theo" (next step) |
| Streak | Text | Card showing the current streak "{streak} ngày", with an encouragement message |
| Mục tiêu JLPT | Text | Card showing the target JLPT level, or "Chưa đặt mục tiêu JLPT." when not set |
| Latest course | Text | Card showing the most recent course, or "Chưa có khóa học nào" |
| Hoạt động gần đây | Text | List of recent quiz attempts; shows "Chưa có hoạt động nào." when empty |
| Quick links | Hyperlink | Shortcuts to "Khoá học", "Từ vựng" and "Hồ sơ" |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.student_profiles *(view of users_module.student_profiles)* | R | Read the student's level, JLPT target and streak |
| public.student_dashboards *(view of ai_module.student_dashboards)* | R | Read the aggregated learning statistics |
| exam_module.quiz_attempts | R | Read the most recent quiz attempts for recent activity |
| exam_module.quizzes | R | Read the titles of the quizzes in the recent attempts |
| ai_module.learning_paths / learning_path_steps | R | Read the active learning path and its next pending step for the roadmap card |
| course_module.courses | R | Read the most recent published course for the "latest course" card |
| public.courses *(view of course_module.courses)* | R | Resolve that course's JLPT level as text (`level`), which the module table stores as `jlpt_level_id` |

**SQL Command:** *(the dashboard issues its reads in parallel; any one of them failing degrades to an empty card instead of failing the page)*
1. Read student profile — `SELECT jlpt_target_level, current_level, streak_days, last_study_date, daily_study_minutes, study_goal FROM public.student_profiles WHERE user_id = ?`
2. Read dashboard stats — `SELECT current_streak, longest_streak, total_vocab_learned, total_kanji_learned, total_grammar_learned, total_study_minutes, total_exams_taken, avg_exam_score, skill_scores FROM public.student_dashboards WHERE student_id = ?`
3. Read recent quiz attempts — `SELECT id, quiz_id, score, total_questions, completed_at FROM exam_module.quiz_attempts WHERE user_id = ? ORDER BY completed_at DESC LIMIT 5`
4. Read quiz titles — `SELECT id, title FROM exam_module.quizzes WHERE id IN (?)`
5. Read the active learning path — `SELECT * FROM ai_module.learning_paths WHERE user_id = ? AND status = 'active'` and `SELECT * FROM ai_module.learning_path_steps WHERE path_id = ? ORDER BY order_index`
6. Read the latest course — `SELECT id, title, title_ja, description, jlpt_level_id, thumbnail_url, is_free, price, creator_type, enrollment_count, avg_rating FROM course_module.courses WHERE is_published = true ORDER BY created_at DESC LIMIT 1`, then `SELECT id, level FROM public.courses WHERE id IN (?)` to render the level badge

---

## 12. Subscription & Payment (Student)

---

### 12.1 UC-36_Purchase Subscription
Allows a student to upgrade to Premium by creating a payment order and paying via bank transfer / QR code; the subscription is activated automatically once the payment is confirmed.

#### a. UI Design
[SCREENSHOT: Pricing screen (/pricing) and checkout QR modal]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Pricing page title "Chọn gói phù hợp với bạn" with sub-text "Nâng cấp để mở khoá toàn bộ tính năng học tiếng Nhật trên Kizuna Nihongo." |
| Free plan | Text | Card "Miễn phí" showing "0 ₫ / tháng" and its included features; shows "Gói đang dùng" when active |
| Premium plan | Text | Card "Premium Tháng" showing the monthly price "{price} ₫ / tháng" and "Thanh toán qua chuyển khoản ngân hàng." |
| Nâng cấp Premium | Button | Button to start the upgrade; shows "Bạn đang dùng Premium ✓" when already premium |
| Checkout modal | Text | Shows "Đang tạo lệnh thanh toán...", then "Thanh toán Premium" with "Quét mã QR hoặc chuyển khoản theo thông tin bên dưới" |
| QR code | Image | Displays the payment QR image; falls back to manual transfer info if it fails to load |
| Transfer info | Text | Displays "Ngân hàng", "Số tài khoản", "Số tiền" and "Nội dung CK", with "Đang chờ xác nhận thanh toán..." while polling |
| Success | Text | On confirmation shows "Thanh toán thành công!" and "Tài khoản của bạn đã được nâng cấp lên Premium." with a receipt button |
| Expired | Text | Shows "Lệnh thanh toán đã hết hạn" when the order times out |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| billing_module.subscription_plans | R | Read the selected plan (price, currency, tier) |
| billing_module.payment_orders | R | Check for an existing, still-valid pending order for the same plan |
| billing_module.payment_orders | U | Cancel any older pending order for the same user + plan |
| billing_module.payment_orders | C | Create the new payment order (order code, payment code, amount, QR URL, 30-minute expiry) |
| billing_module.payment_transactions | C / U | Record the raw bank transaction received from the SePay webhook |
| billing_module.payment_orders | U | Mark the order as paid once the transaction is matched by payment code |
| billing_module.payment_transactions | U | Link the transaction back to the order it settled |
| billing_module.user_subscriptions | R | Look up the user's current subscription before activating |
| billing_module.user_subscriptions | C / U | Create the Premium subscription, or extend the current period if one is already active |

**SQL Command:** *(payment is confirmed asynchronously: SePay posts the bank transaction to the webhook, which matches it to a pending order by `payment_code` and then activates the subscription. The match is idempotent — the transaction is upserted on `(provider, external_transaction_id)` and the order update is guarded by `status = 'pending'` so two concurrent deliveries cannot double-activate. The client polls the order until it turns `paid`. All money tables live in `billing_module`, which is granted to `service_role` only)*
1. Get plan — `SELECT id, code, price, currency FROM billing_module.subscription_plans WHERE id = ? AND is_active = true`
2. Check pending order — `SELECT id, order_code, payment_code, amount, currency, qr_url, bank_code, account_number, expires_at, status FROM billing_module.payment_orders WHERE user_id = ? AND plan_id = ? AND status = 'pending' AND expires_at > now() ORDER BY created_at DESC LIMIT 1`
3. Cancel older pending orders — `UPDATE billing_module.payment_orders SET status = 'cancelled', updated_at = now() WHERE user_id = ? AND plan_id = ? AND status = 'pending'`
4. Create payment order — `INSERT INTO billing_module.payment_orders (user_id, plan_id, order_code, payment_code, amount, currency, provider, bank_code, account_number, qr_url, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)` *(`payment_code` is prefixed `PREM…` so the webhook can tell a Premium order from a course purchase)*
5. Record the bank transaction (webhook) — `INSERT INTO billing_module.payment_transactions (provider, external_transaction_id, amount_in, content, raw_payload, …) VALUES (…) ON CONFLICT (provider, external_transaction_id) DO UPDATE SET raw_payload = EXCLUDED.raw_payload RETURNING id, matched_order_id, matched_course_order_id`
6. Match & confirm the order — `UPDATE billing_module.payment_orders SET status = 'paid', paid_at = now(), matched_transaction_id = ?, matched_reference_number = ?, matched_transaction_time = ?, raw_match_payload = ?, updated_at = now() WHERE payment_code = ? AND status = 'pending'`
7. Link transaction → order — `UPDATE billing_module.payment_transactions SET matched_order_id = ? WHERE id = ?`
8. Read the current subscription — `SELECT * FROM billing_module.user_subscriptions WHERE user_id = ? AND status IN ('active', 'grace_period') ORDER BY created_at DESC LIMIT 1`
9. Activate Premium (no active subscription) — `INSERT INTO billing_module.user_subscriptions (user_id, plan_id, tier, status, started_at, current_period_start, current_period_end, source) VALUES (?, ?, 'premium', 'active', now(), now(), now() + interval '30 days', 'sepay')`
10. Extend Premium (already active) — `UPDATE billing_module.user_subscriptions SET current_period_end = ?, status = 'active', source = ?, updated_at = now() WHERE id = ?`
11. Expire abandoned orders (scheduled) — `UPDATE billing_module.payment_orders SET status = 'expired', updated_at = now() WHERE status = 'pending' AND expires_at < now()`

---

### 12.2 UC-37_View Billing History
Allows a student to view their history of completed (paid) subscription payments and download receipts.

#### a. UI Design
[SCREENSHOT: Billing History screen (/billing)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Lịch sử thanh toán VIP" |
| Mã đơn | Text | Table column showing the order code |
| Gói | Text | Table column showing the plan name |
| Số tiền | Numerical | Table column showing the paid amount formatted in VND (e.g. "99.000₫") |
| Ngày thanh toán | Date | Table column showing the payment date/time |
| Biên lai | Button | Table column with a button to download the receipt PDF |
| Empty state | Text | Shows "Chưa có giao dịch nào." when there are no paid orders |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| billing_module.payment_orders | R | Read the user's paid orders, joined with their subscription plan |
| billing_module.subscription_plans | R | Read the plan code/name shown in the "Gói" column |

**SQL Command:** *(the receipt PDF is generated on demand from this row — no receipt is stored in the database)*
1. Read billing history — `SELECT o.id, o.order_code, o.payment_code, o.amount, o.currency, o.status, o.paid_at, o.created_at, p.code, p.name FROM billing_module.payment_orders o LEFT JOIN billing_module.subscription_plans p ON p.id = o.plan_id WHERE o.user_id = ? AND o.status = 'paid' ORDER BY o.paid_at DESC LIMIT ? OFFSET ?`

---

## 13. Course Management (Admin & Teacher)

*These use cases are shared between Admin (`/admin/courses`) and Teacher (`/teacher/courses`); a teacher-created course can only be edited/deleted by its owner teacher.*

---

### 13.1 UC-38_View Courses (Management)
Allows an admin/teacher to view and manage the course list with search, level filter, publish-status filter, sorting and pagination.

#### a. UI Design
[SCREENSHOT: Course management screen (/admin/courses)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Khóa học" with the total count "({count})" |
| Tạo khóa học mới | Button | Button to open the create-course form |
| Search | Input field | Search box, placeholder "Tìm theo tên khóa học..." |
| Level filter | Combo box | Dropdown to filter by level ("Tất cả cấp độ", "N5"–"N1") |
| Status filter | Choice | Tabs to filter by publish status: "Tất cả", "Xuất bản", "Nháp" |
| Sort | Combo box | Sort selector: "Mới nhất", "Cũ nhất", "Tên A-Z" |
| Course card | Text | Each course shows its title, level, publish state, enrollment count and lesson count, with "Chỉnh sửa" and publish-toggle actions |
| Pagination | Button | "Tiếp →" and previous controls to page through the list |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.courses *(view of course_module.courses)* | R | Read the filtered, sorted, paginated course list and the per-status counts |
| course_module.courses | R | Read the extra fields (enrollment count, creator type, creator id) for the courses on the current page |
| public.lessons *(view of course_module.lessons)* | R | Count the lessons per course |
| public.users *(view of users_module.users)* | R | Read the creator (teacher) names |

**SQL Command:** *(the base list is read through the compatibility view so it can be filtered by `level`; the enrollment count is a cached column on the module table, maintained by the `trg_recalc_enrollment_count` trigger. On the teacher screen the same list is additionally scoped by `created_by = <teacher id>`)*
1. List courses — `SELECT * FROM public.courses WHERE title ILIKE ? AND level = ? AND is_published = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
2. Count by status — `SELECT count(*) FROM public.courses WHERE title ILIKE ? AND level = ? AND is_published = ?`
3. Read enrollment counts & creators — `SELECT id, enrollment_count, creator_type, created_by FROM course_module.courses WHERE id IN (?)`
4. Count lessons — `SELECT course_id FROM public.lessons WHERE course_id IN (?)`
5. Read creator names — `SELECT id, full_name, email FROM public.users WHERE id IN (?)`

---

### 13.2 UC-39_Create Course
Allows an admin/teacher to create a new course with bilingual title/description, level, price, reference curriculum, cover image and publish state.

#### a. UI Design
[SCREENSHOT: Course management screen — create course form]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Tiêu đề (Tiếng Việt) | Input field | Field for the Vietnamese title, placeholder "Nhập tên khóa học...". Required |
| Tiêu đề (Tiếng Nhật) | Input field | Field for the Japanese title, placeholder "コース名を入力..." |
| Cấp độ JLPT | Combo box | Dropdown to choose the course level (N5–N1) |
| Trạng thái | Toggle | Toggle between "Xuất bản" (published) and "Bản nháp" (draft) |
| Học phí | Numerical | Field for the course price |
| Giáo trình tham chiếu | Input field | Field for the reference curriculum, placeholder "VD: Minna no Nihongo Shokyu 1" |
| Mô tả (Tiếng Việt) | Text | Multi-line Vietnamese description, placeholder "Mô tả nội dung và mục tiêu khóa học..." |
| Mô tả (Tiếng Nhật) | Text | Multi-line Japanese description, placeholder "コースの説明..." |
| URL Thumbnail | Input field | Field for the cover image URL "URL Thumbnail (hoặc tải ảnh bìa trực tiếp trên thẻ)", placeholder "https://example.com/image.jpg" |
| Tạo khóa học | Button | Button to submit and create the course |
| Error Message | Text | Displays "Tiêu đề không được để trống." when the title is missing |
| Success Message | Text | Displays "Tạo khóa học thành công." after creation |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.courses *(view of course_module.courses)* | C | Insert the base course record (title, level, description, publish state, creator) |
| course_module.courses | U | Set the extended fields (creator type, is_free, price, reference curriculum, difficulty) |

**SQL Command:** *(the base insert goes through the compatibility view, whose `INSTEAD OF INSERT` trigger `courses_compat_ins()` writes into `course_module.courses` and resolves `level` → `jlpt_level_id` via `language_module.jlpt_levels`. The commercial columns do not exist on the view, so they are written to the module table in a second statement: an admin course is created as `creator_type = 'admin'`, `is_free = true`; a teacher course as `creator_type = 'teacher'` with its price. The cover image is uploaded to the Supabase Storage bucket `passage-images` and only its URL is stored)*
1. Insert course — `INSERT INTO public.courses (title, title_ja, description, description_ja, level, thumbnail_url, is_published, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
2. Set course extras — `UPDATE course_module.courses SET creator_type = ?, is_free = ?, price = ?, reference_curriculum = ?, difficulty_level = ? WHERE id = ?`

---

### 13.3 UC-40_Update Course
Allows an admin/teacher to update a course's fields and toggle its publish state; a teacher-created course cannot be edited by an admin.

#### a. UI Design
[SCREENSHOT: Course management screen — edit course form]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Course fields | Input field | Same editable fields as the create form (title, title_ja, description, level, price, reference curriculum, thumbnail) pre-filled with current values |
| Trạng thái / Xuất bản | Toggle | Toggle to publish/unpublish the course |
| Chỉnh sửa | Button | Saves the updated course fields |
| Error Message | Text | Displays "Khóa học do giáo viên tạo — admin không có quyền chỉnh sửa nội dung." when an admin tries to edit a teacher-created course |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| course_module.courses | R | Read `creator_type` (admin screen) or `created_by` (teacher screen) to authorise the edit |
| public.courses *(view of course_module.courses)* | U | Update the base fields (title, level, description, thumbnail, publish state) |
| course_module.courses | U | Update the extended fields (is_free, price, reference curriculum, difficulty) |

**SQL Command:** *(the ownership check runs first: an admin is refused on a `creator_type = 'teacher'` course, and a teacher is refused on any course they did not create. Publishing is deliberately separated from editing — an admin may publish/unpublish **any** course, including a teacher's, because that statement touches only `is_published`)*
1. Authorise the edit — `SELECT creator_type, created_by FROM course_module.courses WHERE id = ?`
2. Update base fields — `UPDATE public.courses SET title = ?, title_ja = ?, description = ?, description_ja = ?, level = ?, thumbnail_url = ?, is_published = ?, updated_at = now() WHERE id = ?`
3. Update extended fields — `UPDATE course_module.courses SET is_free = ?, price = ?, reference_curriculum = ?, difficulty_level = ? WHERE id = ?`
4. Toggle publish — `UPDATE public.courses SET is_published = ?, updated_at = now() WHERE id = ?`

---

### 13.4 UC-41_Delete Course
Allows an admin/teacher to permanently delete a course (and all its related content) after a type-to-confirm safety check; a teacher-created course cannot be deleted by an admin.

#### a. UI Design
[SCREENSHOT: Course management screen — delete confirmation modal]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Delete modal title "Xóa khóa học" |
| Warning | Text | Shows "Hành động này không thể hoàn tác!" and "Khóa học \"{title}\" cùng toàn bộ bài học và nội dung liên quan sẽ bị xóa vĩnh viễn khỏi hệ thống." |
| Confirm input | Input field | Field to type the exact course title to confirm, labelled "Nhập tên khóa học để xác nhận:" |
| Xóa vĩnh viễn | Button | Button to permanently delete the course (enabled only when the typed title matches) |
| Hủy | Button | Button to cancel the deletion |
| Error Message | Text | Displays "Khóa học do giáo viên tạo — admin không có quyền chỉnh sửa nội dung." when an admin tries to delete a teacher-created course |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| course_module.courses | R | Read `creator_type` / `created_by` to authorise the deletion |
| public.courses *(view of course_module.courses)* | D | Delete the course; related units, lessons, enrolments, progress and reviews are removed by cascade |

**SQL Command:** *(the delete goes through the view, whose `INSTEAD OF DELETE` trigger removes the row from `course_module.courses`; every dependent row disappears through `ON DELETE CASCADE`. The typed course title is verified on the client only — the server authorises by ownership)*
1. Authorise the deletion — `SELECT creator_type, created_by FROM course_module.courses WHERE id = ?`
2. Delete course — `DELETE FROM public.courses WHERE id = ?`

---

## 15. Question Bank Management (Admin & Teacher)

*Admin and Teacher share the same Question Bank Manager. A teacher manages their private bank (`exam_module.teacher_question_bank`) and can browse/import from the admin global bank (`exam_module.question_bank`); a question can only be edited/deleted by its owner.*

---

### 15.1 UC-51_View Question Bank
Allows an admin/teacher to browse their question bank with search, level/skill/type filters and pagination, plus a read-only "Ngân hàng chung" tab (teacher) for the global bank.

#### a. UI Design
[SCREENSHOT: Question Bank management screen (/teacher/question-bank or /admin/question-bank)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the bank title (e.g. "Ngân hàng câu hỏi của tôi") with the total count |
| Search | Input field | Search box to find questions by content |
| Filters | Combo box | Filters by level (N5–N1), skill ("Đọc hiểu", "Nghe hiểu", "Nói", "Viết") and question type |
| Ngân hàng chung | Choice | (Teacher) Read-only tab to browse and import questions from the admin global bank |
| Question card | Text | Each question shows its content, the options with the correct answer highlighted, the explanation, and level/skill/type badges |
| Stats | Text | Shows the total number of questions and how many are pending |
| Pagination | Button | Controls to page through the question list |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| exam_module.teacher_question_bank | R | Read the teacher's own questions (list + stats), filtered and paginated |
| exam_module.teacher_reading_passages | R | Read the reading passage attached to each of the teacher's questions |
| exam_module.question_bank | R | (Teacher global tab) Read the admin global bank of approved questions |
| exam_module.reading_passages | R | Read the passage attached to each global-bank question |

**SQL Command:** *(the same screen serves admin and teacher; a teacher only ever sees rows where `teacher_id` is their own id, and the global tab is read-only. Every filter in the UI maps to one predicate: `level`, `skill`, `topic ILIKE`, `difficulty`, `status`, `question_type`, `passage_id`, and `question_text ILIKE` for the search box)*
1. List questions — `SELECT q.*, p.id, p.title FROM exam_module.teacher_question_bank q LEFT JOIN exam_module.teacher_reading_passages p ON p.id = q.passage_id WHERE q.teacher_id = ? AND q.level = ? AND q.skill = ? AND q.question_text ILIKE ? ORDER BY q.created_at DESC LIMIT ? OFFSET ?`
2. Question stats — `SELECT count(*) FROM exam_module.teacher_question_bank WHERE teacher_id = ?`, `SELECT count(*) FROM exam_module.teacher_question_bank WHERE teacher_id = ? AND status = 'pending'` and `SELECT level FROM exam_module.teacher_question_bank WHERE teacher_id = ? AND level IS NOT NULL`
3. Browse global bank — `SELECT q.*, p.id, p.title FROM exam_module.question_bank q LEFT JOIN exam_module.reading_passages p ON p.id = q.passage_id WHERE q.status = 'approved' ORDER BY q.created_at DESC LIMIT ? OFFSET ?`

---

### 15.2 UC-52_Add Question to Bank
Allows an admin/teacher to add a new question (single/multiple choice, matching, ordering, fill-blank or short answer) to the bank, manually or via AI generation / bulk import.

#### a. UI Design
[SCREENSHOT: Question Bank management screen — add question form]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Nội dung câu hỏi | Text | Field for the question content (for fill-blank: "Câu hỏi (dùng ___ cho chỗ trống)"). Required |
| Loại câu hỏi | Combo box | Question type: single choice, multiple choice, matching, ordering, fill-blank, short answer |
| Đáp án | Input field / Check mark | The answer options and the correct answer(s), depending on the question type |
| Giải thích | Text | Field for the answer explanation |
| Cấp độ | Combo box | JLPT level of the question (N5–N1) |
| Kỹ năng | Combo box | Skill: "Đọc hiểu", "Nghe hiểu", "Nói", "Viết" |
| Chủ đề | Input field | Field for the question topic |
| Độ khó | Combo box | Difficulty (default "medium") |
| Thêm câu hỏi | Button | Button to save the new question |
| Error Message | Text | Displays "Nội dung câu hỏi là bắt buộc." when the content is missing |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| exam_module.teacher_question_bank | C | Insert the new question into the teacher's bank (one row, or many for AI generation / bulk import) |
| exam_module.question_bank | R | (Import path) Read the selected approved questions from the admin global bank |
| exam_module.teacher_reading_passages | R | (AI path) Read the source passage the AI generates questions from |

**SQL Command:** *(all three entry points — manual, AI-generated and bulk import — end in the same insert. `is_ai_generated` records how the row was produced and `source_bank_id` keeps the traceability link back to the global-bank row it was copied from)*
1. Insert question — `INSERT INTO exam_module.teacher_question_bank (teacher_id, question_text, options, correct_answer, explanation, level, skill, topic, difficulty, status, is_ai_generated, question_type, passage_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` *(`difficulty` defaults to `'medium'`, `status` to `'approved'`, `question_type` to `'single_choice'`)*
2. Read the source passage (AI path) — `SELECT title, content, image_url, teacher_id FROM exam_module.teacher_reading_passages WHERE id = ?`
3. Read the questions to import — `SELECT * FROM exam_module.question_bank WHERE id IN (?) AND status = 'approved'`
4. Bulk insert — the same statement as (1) with multiple `VALUES` tuples

---

### 15.3 UC-53_Update Question
Allows an admin/teacher to edit an existing question in their bank; only the owner may update it.

#### a. UI Design
[SCREENSHOT: Question Bank management screen — edit question form]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Question fields | Input field | Same fields as the add form (content, options, correct answer, explanation, level, skill, topic, difficulty, type), pre-filled with the current values |
| Lưu | Button | Button to save the updated question |
| Error Message | Text | Displays "Không có quyền." when a non-owner tries to update the question |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| exam_module.teacher_question_bank | R | Read the question to verify ownership |
| exam_module.teacher_question_bank | U | Update the question fields |

**SQL Command:** *(only the fields on the whitelist are updatable — `question_text`, `options`, `correct_answer`, `explanation`, `level`, `skill`, `topic`, `difficulty`, `status`, `is_ai_generated`, `question_type`, `passage_id`; anything else in the request body is dropped. `teacher_id` can never be reassigned)*
1. Check ownership — `SELECT teacher_id FROM exam_module.teacher_question_bank WHERE id = ?`
2. Update question — `UPDATE exam_module.teacher_question_bank SET question_text = ?, options = ?, correct_answer = ?, explanation = ?, level = ?, skill = ?, topic = ?, difficulty = ?, status = ?, question_type = ?, passage_id = ? WHERE id = ?`

---

### 15.4 UC-54_Delete Question
Allows an admin/teacher to delete a question from their bank after confirmation; only the owner may delete it.

#### a. UI Design
[SCREENSHOT: Question Bank management screen — delete confirmation]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Delete confirm | Choice | Confirmation dialog "Xóa câu hỏi \"{question}\"?" with confirm / cancel |
| Error Message | Text | Displays "Không có quyền." when a non-owner tries to delete the question |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| exam_module.teacher_question_bank | R | Read the question to verify ownership |
| exam_module.teacher_question_bank | D | Delete the question |

**SQL Command:** *(a question already copied into a quiz is unaffected — `exam_module.quiz_questions` keeps its own copy of the wording plus a `passage_snapshot`, so deleting the bank row never alters a quiz that has been taken)*
1. Check ownership — `SELECT teacher_id FROM exam_module.teacher_question_bank WHERE id = ?`
2. Delete question — `DELETE FROM exam_module.teacher_question_bank WHERE id = ?`

---

## 17. Listening Content Management (Admin & Teacher)

*Admin manages the shared dialogue library (`/admin/listening/dialogues`) and Teacher manages their own dialogues (`/teacher/my-listening`); both use the same tables. A dialogue is a set of ordered lines.*

---

### 17.1 UC-58_Create Listening Content
Allows an admin/teacher to create a listening dialogue (bilingual title, level, topic, icon) and add its conversation lines.

#### a. UI Design
[SCREENSHOT: Listening management screen — create dialogue + add line]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Tiêu đề (JP) | Input field | Field for the Japanese title, placeholder "自己紹介". Required |
| Tiêu đề (VI) | Input field | Field for the Vietnamese title, placeholder "Tự giới thiệu" |
| Cấp độ | Combo box | Dropdown to choose the level (N5–N1). Required |
| Chủ đề | Input field | Field for the topic, placeholder "日常会話" |
| Icon (Material Symbols) | Input field | Field for the thumbnail icon name (default "headphones") |
| Người nói | Input field | Per-line speaker label, placeholder "A / B / 田中" |
| Lời thoại (JP) | Text | Per-line Japanese text with furigana syntax, placeholder "はじめまして。{田中\|たなか}です。" |
| Plain text | Text | Per-line plain Japanese text (auto-filled from the JP text) |
| Tiếng Việt | Input field | Per-line Vietnamese translation, placeholder "Xin chào. Tôi là Tanaka." |
| Thêm câu thoại | Button | Button to add a line to the dialogue |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| practice_module.listening_dialogues | C | Insert the new dialogue (`creator_type` = `admin` or `teacher`) |
| practice_module.listening_dialogue_lines | R | Read the highest existing `line_order` so the new line is appended at the end |
| practice_module.listening_dialogue_lines | C | Insert each conversation line of the dialogue |

**SQL Command:** *(an admin dialogue is stored with `creator_type = 'admin'`; a teacher dialogue with `creator_type = 'teacher'`, `created_by = <teacher id>` and `is_published = true`, which is also what makes it attributable in the teacher revenue pool. `thumbnail_icon` defaults to `'headphones'`)*
1. Create dialogue (admin) — `INSERT INTO practice_module.listening_dialogues (title, title_vi, level, topic, thumbnail_icon, creator_type) VALUES (?, ?, ?, ?, ?, 'admin')`
2. Create dialogue (teacher) — `INSERT INTO practice_module.listening_dialogues (title, title_vi, level, topic, thumbnail_icon, creator_type, created_by, is_published) VALUES (?, ?, ?, ?, ?, 'teacher', ?, true)`
3. Next line order — `SELECT line_order FROM practice_module.listening_dialogue_lines WHERE dialogue_id = ? ORDER BY line_order DESC LIMIT 1`
4. Add line — `INSERT INTO practice_module.listening_dialogue_lines (dialogue_id, speaker, text_jp, text_plain, text_vi, line_order) VALUES (?, ?, ?, ?, ?, ?)`

---

### 17.2 UC-59_Update Listening Content
Allows an admin/teacher to edit a dialogue's information and its lines.

#### a. UI Design
[SCREENSHOT: Listening management screen — edit dialogue + edit line]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Dialogue fields | Input field | Same fields as create (Tiêu đề JP/VI, Cấp độ, Chủ đề, Icon), pre-filled with current values |
| Line fields | Input field | Same per-line fields (Người nói, Lời thoại JP, Plain text, Tiếng Việt), pre-filled for editing |
| Save | Button | Buttons to save the updated dialogue or line |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| practice_module.listening_dialogues | R | Read `creator_type` / `created_by` to authorise the edit |
| practice_module.listening_dialogues | U | Update the dialogue's information |
| practice_module.listening_dialogue_lines | R | Read the line's `dialogue_id` so the owner check runs against the parent dialogue |
| practice_module.listening_dialogue_lines | U | Update a conversation line |

**SQL Command:** *(an admin may only edit `creator_type = 'admin'` dialogues and a teacher only their own — the line endpoints resolve the parent dialogue first and apply the same check)*
1. Authorise the edit — `SELECT creator_type, created_by FROM practice_module.listening_dialogues WHERE id = ?`
2. Update dialogue — `UPDATE practice_module.listening_dialogues SET title = ?, title_vi = ?, level = ?, topic = ?, thumbnail_icon = ?, updated_at = now() WHERE id = ?`
3. Resolve the parent dialogue of a line — `SELECT dialogue_id FROM practice_module.listening_dialogue_lines WHERE id = ?`
4. Update line — `UPDATE practice_module.listening_dialogue_lines SET speaker = ?, text_jp = ?, text_plain = ?, text_vi = ?, line_order = ? WHERE id = ?`

---

### 17.3 UC-60_Delete Listening Content
Allows an admin/teacher to delete a dialogue (and all its lines) or an individual line after confirmation.

#### a. UI Design
[SCREENSHOT: Listening management screen — delete confirmation]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Delete dialogue | Choice | Confirmation dialog "Xóa hội thoại này và toàn bộ câu thoại?" with confirm / cancel |
| Delete line | Choice | Confirmation dialog "Xóa câu này?" with confirm / cancel |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| practice_module.listening_dialogues | R | Read `creator_type` / `created_by` to authorise the deletion |
| practice_module.listening_dialogues | D | Delete the dialogue; its lines are removed by cascade |
| practice_module.listening_dialogue_lines | D | Delete a single conversation line |

**SQL Command:** *(same ownership rule as UC-59; deleting a line leaves gaps in `line_order`, which is only used for ordering and never as a position index)*
1. Authorise the deletion — `SELECT creator_type, created_by FROM practice_module.listening_dialogues WHERE id = ?`
2. Delete dialogue — `DELETE FROM practice_module.listening_dialogues WHERE id = ?`
3. Delete line — `DELETE FROM practice_module.listening_dialogue_lines WHERE id = ?`

---

## 19. User Management (Admin)

---

### 19.1 UC-64_View User List
Allows an admin to view the list of all users with search, role display and pagination.

#### a. UI Design
[SCREENSHOT: User management screen (/admin/users)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays the page title with the total user count |
| Search | Input field | Search box, placeholder "Tìm kiếm..." (matches name or email) |
| Họ tên | Text | Table column showing the user's full name |
| Email | Text | Table column showing the user's email |
| Vai trò | Text | Table column showing the role: "Admin", "Giáo viên" or "Học viên" |
| Actions | Button | Per-row actions: edit user, reset password, delete user |
| Pagination | Button | "Tiếp →" and previous controls to page through the list |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.users *(view of users_module.users)* | R | Read the paginated, searchable user list |
| auth.users | R | Read each user's role from the Supabase Auth metadata |

**SQL Command:** *(the role is not a column — it is resolved per row from the Auth metadata, and only for the users on the current page, so the query cost stays bounded by the page size instead of the size of the user base)*
1. List users — `SELECT id, full_name, email, phone, avatar_url, created_at FROM public.users WHERE full_name ILIKE ? OR email ILIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
2. Count for pagination — `SELECT count(*) FROM public.users WHERE full_name ILIKE ? OR email ILIKE ?`
3. Read role (per listed user) — `SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = ?` *(no value → `student`)*

---

### 19.2 UC-65_Review Teacher Applications
Allows an admin to review teacher applications, inspect the applicant's details, documents and AI assessment, and approve or reject them.

#### a. UI Design
[SCREENSHOT: Teacher Applications review screen (/admin/teacher-applications)]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Displays "Đơn đăng ký giáo viên" with "{n} đơn đang chờ" when there are pending applications |
| Status filter | Choice | Tabs to filter by status: "Chờ duyệt", "Đã duyệt", "Từ chối", "Tất cả" |
| Application row | Text | Table row showing the applicant, qualification, AI verdict, status ("Chờ duyệt"/"Đã duyệt"/"Từ chối") and submission date |
| Xem xét | Button | Opens the review modal showing details (Bằng cấp, Chuyên môn, Kinh nghiệm, SĐT, Học vấn, Giới thiệu), documents and the AI assessment |
| Duyệt & cấp quyền | Button | Approves the application and grants the teacher role |
| Từ chối | Button | Rejects the application (keeps the student role) |
| Empty state | Text | Shows "Không có đơn nào." when no application matches the filter |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| users_module.teacher_applications | R | Read the list of applications filtered by status, and the selected application |
| public.users *(view of users_module.users)* | R | Read the applicants' names and emails |
| users_module.teacher_applications | U | Update the application status, reviewer and note on approve / reject / revoke |
| auth.users | U | Set the user's role to `teacher` (approve) or `student` (reject / revoke) |

**SQL Command:** *(the AI assessment shown in the review modal — `ai_verdict`, `ai_summary`, `ai_flags`, `ai_confidence` — was written when the application was submitted (UC-02) and is only read here. The documents themselves stay in the private `teacher-documents` bucket and are served through Storage signed URLs valid for one hour. "Revoke" is stored the same way as a rejection: `status = 'rejected'` plus a demotion to `student`)*
1. List applications — `SELECT * FROM users_module.teacher_applications WHERE status = ? ORDER BY updated_at DESC`
2. Read applicant info — `SELECT id, full_name, email FROM public.users WHERE id IN (?)`
3. Read the selected application — `SELECT * FROM users_module.teacher_applications WHERE id = ?`
4. Approve application — `UPDATE users_module.teacher_applications SET status = 'approved', admin_note = ?, reviewed_by = ?, reviewed_at = now(), decided_by = 'admin', updated_at = now() WHERE id = ?`
5. Grant the teacher role — `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', 'teacher') WHERE id = ?`
6. Reject / revoke application — `UPDATE users_module.teacher_applications SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = now(), decided_by = 'admin', updated_at = now() WHERE id = ?`
7. Keep / restore the student role — `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', 'student') WHERE id = ?`

---

### 19.3 UC-66_Update User
Allows an admin to update a user's full name, phone and role.

#### a. UI Design
[SCREENSHOT: User management screen — edit user modal]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Họ tên | Input field | Field to edit the user's full name |
| SĐT | Input field | Field to edit the user's phone number |
| Vai trò | Combo box | Dropdown to change the role: "Student", "Teacher (Giáo viên)", "Admin" |
| Cập nhật | Button | Button to save the changes |
| Error Message | Text | Displays "Vai trò không hợp lệ." or "Không thể tự hạ quyền admin của chính mình." |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| public.users *(view of users_module.users)* | U | Update the user's full name and phone |
| auth.users | U | Update the user's role in the Supabase Auth metadata |

**SQL Command:** *(the two statements are independent — a request that changes only the role leaves the profile row untouched, and vice versa. The role update merges into the existing metadata so a Google account does not lose its `full_name` / `avatar_url`. An admin is refused when demoting their own account)*
1. Update user info — `UPDATE public.users SET full_name = ?, phone = ?, updated_at = now() WHERE id = ?`
2. Update role — `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', ?) WHERE id = ?`

---

### 19.4 UC-67_Reset User Password
Allows an admin to set a new password for any user.

#### a. UI Design
[SCREENSHOT: User management screen — reset password modal]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Title | Heading | Modal title "Đặt lại mật khẩu — {name}" |
| Mật khẩu mới | Input field | Field for the new password, placeholder "Tối thiểu 8 ký tự, gồm chữ và số" |
| Xác nhận mật khẩu | Input field | Field to re-enter the new password, placeholder "Nhập lại mật khẩu mới" |
| Đặt lại mật khẩu | Button | Button to apply the new password |
| Success Message | Text | Displays "Đã đặt lại mật khẩu thành công." on success |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| auth.users | U | Update the user's password via the Supabase Admin API |

**SQL Command:**
1. Reset password — `UPDATE auth.users SET encrypted_password = crypt(?, gen_salt('bf')) WHERE id = ?`

---

### 19.5 UC-68_Delete User
Allows an admin to permanently delete a user account (an admin cannot delete their own account).

#### a. UI Design
[SCREENSHOT: User management screen — delete confirmation]

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Delete confirm | Choice | Confirmation dialog to permanently delete the selected user |
| Error Message | Text | Displays "Không thể xóa tài khoản của chính mình." when an admin tries to delete themselves |
| Success Message | Text | Displays "Đã xóa người dùng." after deletion |

#### b. Database Access
| Table | CRUD | Description |
|-------|------|-------------|
| auth.users | D | Delete the Supabase Auth user; `users_module.users` and every row that references it are removed by cascade |

**SQL Command:** *(the code calls the Supabase Admin API `auth.admin.deleteUser`. The cascade reaches `users_module.users` → `student_profiles`, `ai_module.student_dashboards`, enrolments, progress, attempts, chat sessions and so on. An admin cannot delete their own account)*
1. Delete user — `DELETE FROM auth.users WHERE id = ?`

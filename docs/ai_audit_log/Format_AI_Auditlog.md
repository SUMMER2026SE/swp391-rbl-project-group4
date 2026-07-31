# AI AUDIT LOG

> Nguồn: `VoVanThienBao_DE190619_AI_Auditlog.xlsx` — chuyển sang Markdown.

---

## 1. Metadata & Summary

### Student Information

| Trường | Giá trị |
|---|---|
| Student Name: | Võ Văn Thiên Bảo |
| Student ID: | DE190619 |
| Course: | SWP391 |
| Assignment: | Kizuna Nihongo — Hệ thống học tiếng Nhật trực tuyến, tối ưu hoá trải nghiệm người dùng |

### AI Usage Summary

| Chỉ số | Giá trị | Ghi chú |
|---|---|---|
| Total Prompts Used (all AI tools): | 160 |  |
| Core Prompts Logged: | 21 |  |
| Selection Ratio: | 13.12% | Should be 10-20% |
| Hallucination Detected: | 6 |  |

### AI Tools Used

| AI Tool | Purpose | Frequency | Main Value |
|---|---|---|---|
| ChatGPT 4o | Code generation, component design, debugging | High | Sinh boilerplate React và Express nhanh |
| GitHub Copilot | Inline code completion | High | Tăng tốc coding lặp lại |
| Claude (Anthropic) | Architecture design, logic review, data model | High | Phân tích trade-off và edge case |

### Core Prompts Distribution by DTC Component

| DTC Component | Number of Prompts | Required (Min) |
|---|---|---|
| Decomposition | 6 | ≥ 1 |
| Pattern Recognition | 5 | ≥ 1 |
| Abstraction | 5 | ≥ 1 |
| Algorithms | 5 | ≥ 1 |

---

## 2. Detailed Audit Log

> INSTRUCTIONS: Chỉ ghi CORE PROMPTS (Decision/Problem-Solving/Verification). Mỗi entry phải trả lời đầy đủ 4 câu hỏi trong Human Delta.

### Entry #001 — DECISION · Decomposition

**Problem / Context**

Admin cần quản lý danh sách khóa học (Course) với đầy đủ CRUD theo UC54, UC55, UC56. Đây là tính năng đầu tiên implement trong sprint 1, chưa có bất kỳ trang admin nào cho courses.  

**Prompt to AI**

Tôi đang phát triển hệ thống học tiếng Nhật Kizuna Nihongo (React + Vite + Tailwind + Express + Supabase). Phần admin cần trang quản lý khóa học theo 3 UC: UC54 — tạo khóa học mới (tên, mô tả, level N1-N5, giá, thumbnail), UC55 — chỉnh sửa thông tin khóa học, UC56 — xóa khóa học. Hãy implement AdminCourses.jsx: bảng danh sách courses với search và filter theo level, modal create/edit với form đầy đủ, confirm dialog trước khi xóa, và kết nối với API /api/admin/courses (GET, POST, PUT, DELETE). Tech stack: React, Tailwind, axios.  

**AI Response (Summary)**

AI sinh AdminCourses.jsx (~564 lines) với DataTable hiển thị course list, CreateEditCourseModal với form inputs (name, description, level select N1-N5, price, thumbnail URL text field), DeleteConfirmDialog, handlers cho fetch/create/update/delete dùng axios. Cấu trúc state: courses[], loading, modal open/close flags.  

**Human Delta & Reflection**

Critical Thinking: AI tạo form có field "Thumbnail URL" dạng text input — admin phải tự host ảnh và paste URL vào, không thể upload trực tiếp. UX kém và không thực tế trong production.  
Contextualization: Project đã có Supabase Storage setup (team dùng cho listening audio và reading images) — hoàn toàn có thể upload thumbnail và lấy URL tự động.  
Creative Synthesis: Thêm file input với drag-drop, preview thumbnail trước khi save, upload lên Supabase Storage bucket `course-thumbnails`, sau đó lưu URL trả về. Giữ text URL làm fallback nếu admin muốn dùng ảnh bên ngoài.  
Decision: Implement image upload flow vì đây là UX improvement thiết yếu; AI không propose nhưng là yêu cầu thực tế khi admin vận hành hệ thống.  

**Evidence**

Commit: 20d5bbc  
Files:  
- frontend/src/pages/admin/AdminCourses.jsx (+564 lines)
- backend/controllers/adminController.js (4 lines fix)
Reason: Implement UC54-56 Course CRUD cho admin.  

---

### Entry #002 — DECISION · Abstraction

**Problem / Context**

Sau khi có CRUD cho Course metadata, admin cần trang riêng để quản lý NỘI DUNG bên trong từng course — bài học, từ vựng, ngữ pháp. Cần quyết định kiến trúc trang ManageCourseContent.  

**Prompt to AI**

Tôi đã có trang AdminCourses.jsx để CRUD course metadata. Tiếp theo cần trang ManageCourseContent.jsx để admin quản lý nội dung bên trong một khóa học cụ thể (route: /admin/courses/:courseId/content). Trang này cần: sidebar navigation để chọn loại nội dung (Vocabulary, Grammar, Reading, Quiz, Kanji, Video), một main area hiển thị và CRUD các items thuộc loại đó trong course đang chọn. Hãy thiết kế layout tổng thể, implement skeleton với routing đúng, và breadcrumb "Quản lý Khóa học / [tên course] / [loại lesson]". Tech stack: React, Vite, Tailwind, useParams từ react-router-dom.  

**AI Response (Summary)**

AI sinh ManageCourseContent.jsx (~630 lines) với sidebar 6 tabs (Vocabulary, Grammar, Reading, Quiz, Kanji, Video) dùng icons, main area conditional render theo tab đang chọn, useParams() lấy courseId, breadcrumb navigation, fetch course info để hiển thị tên. State: selectedTab, courseInfo. Skeleton placeholder cho mỗi tab. Backend: GET /api/admin/courses/:id endpoint.  

**Human Delta & Reflection**

Critical Thinking: AI thiết kế flat structure Course → Lessons (theo type), nhưng thực tế một khóa học tiếng Nhật cần có "Bài 1", "Bài 2"... (Unit) — mỗi Unit gồm nhiều lesson types về cùng một chủ đề. Không có Unit layer thì admin không biết lesson nào thuộc bài học nào.  
Contextualization: Chuẩn JLPT organize theo Bài học: Bài 1 — Chào hỏi, gồm: từ vựng chào hỏi + ngữ pháp です/ます + reading passage + quiz. Flat structure AI propose không thể model được điều này.  
Creative Synthesis: Thêm Unit selector ở header của ManageCourseContent: admin chọn Unit trước (hoặc tạo Unit mới), rồi mới chọn lesson type trong context Unit đó. Unit CRUD thêm vào sidebar top section.  
Decision: Unit layer là architectural decision quan trọng nhất trong toàn bộ Course module; phải add ngay vì sẽ ảnh hưởng toàn bộ data model, API, và student view sau này.  

**Evidence**

Commit: 9f0529a  
Files:  
- frontend/src/pages/admin/ManageCourseContent.jsx (+630 lines)
- backend/controllers/adminController.js (+105 lines)
- backend/routes/api/admin.js (+26 lines)
Reason: Course content management page với Unit layer tự thêm.  

---

### Entry #003 — DECISION · Decomposition

**Problem / Context**

ManageCourseContent đã có skeleton. Cần implement thực sự 4 lesson type đầu tiên: Vocabulary, Grammar, Reading, Quiz — mỗi type có form, data, và API riêng.  

**Prompt to AI**

ManageCourseContent.jsx đã có layout với 6 tabs. Giờ tôi cần implement nội dung thực tế cho 4 tab đầu tiên của hệ thống học tiếng Nhật Kizuna Nihongo. Hãy tạo 4 component riêng biệt: (1) AdminLessonVocabulary.jsx — CRUD từ vựng trong bài: word, reading (furigana), meaning_vi, part_of_speech, example_sentence, level; (2) AdminLessonGrammar.jsx — CRUD ngữ pháp: pattern (ví dụ: N + が + ほしい), explanation, example, translation; (3) AdminLessonReading.jsx — CRUD passage đọc với title, content và image; (4) AdminLessonQuiz.jsx — gắn câu hỏi từ question bank vào lesson. Mỗi component: DataTable danh sách + modal create/edit + API calls.  

**AI Response (Summary)**

AI sinh 4 component: AdminLessonVocabulary.jsx (~394 lines), AdminLessonGrammar.jsx (~312 lines), AdminLessonReading.jsx (~394 lines), AdminLessonQuiz.jsx (~584 lines). Mỗi file có full CRUD với modal, state management, axios calls. AdminLessonQuiz.jsx có thêm modal import từ question bank (fetch /api/admin/questions, checkbox select). Backend: thêm endpoints vào adminController.js cho từng lesson type.  

**Human Delta & Reflection**

Critical Thinking: Nhìn vào 4 file AI sinh, nhận ra khoảng 60% code là hoàn toàn giống nhau: useState cho items/loading/modalOpen/selectedItem, handler pattern fetch→setState, CRUD modal structure, DataTable wrapper — tất cả đều lặp lại 4 lần.  
Contextualization: Sẽ còn cần thêm Kanji và Video type nữa → nếu giữ pattern này sẽ lặp lại 6 lần; mỗi lần fix bug UI hoặc đổi style phải sửa 6 file.  
Creative Synthesis: Nhận ra vấn đề nhưng deadline sprint còn 2 ngày → chấp nhận code lặp cho 4 type này; ghi note kỹ trong commit message để refactor sau; ưu tiên deliver feature hoàn chỉnh trước khi nghĩ đến clean code.  
Decision: Giữ nguyên 4 component riêng biệt (technical debt có chủ ý); trade-off hợp lý giữa delivery speed và maintainability trong context sprint ngắn.  

**Evidence**

Commit: 916fda2  
Files:  
- frontend/src/pages/admin/AdminLessonVocabulary.jsx (+394 lines)
- frontend/src/pages/admin/AdminLessonGrammar.jsx (+312 lines)
- frontend/src/pages/admin/AdminLessonReading.jsx (+394 lines)
- frontend/src/pages/admin/AdminLessonQuiz.jsx (+584 lines)
- backend/controllers/adminController.js (+36 lines)
Reason: 4 lesson type đầu tiên cho ManageCourseContent.  

---

### Entry #004 — DECISION · Pattern Recognition

**Problem / Context**

Kanji là loại nội dung đặc thù nhất trong tiếng Nhật — cần thêm AdminLessonKanji.jsx với UI phù hợp để hiển thị chữ Hán và tra cứu từ kho kanji.  

**Prompt to AI**

Tôi cần thêm tab Kanji vào ManageCourseContent của Kizuna Nihongo. AdminLessonKanji.jsx cần: 1) DataTable hiển thị kanji trong bài học — cột character dùng font lớn (2rem) để đọc được, cột on-reading (âm on), kun-reading (âm kun), meaning, stroke_count, JLPT level, hán việt. 2) Nút "Thêm Kanji" mở modal — admin gõ ký tự kanji, system tự fetch thông tin từ kanji master table có sẵn trong Supabase. 3) Nếu không tìm thấy trong master table thì cho phép nhập tay đầy đủ thông tin. 4) Liên kết kanji với lesson qua junction table lesson_kanji (lesson_id, kanji_id). Implement đầy đủ.  

**AI Response (Summary)**

AI sinh AdminLessonKanji.jsx (~449 lines) với DataTable có cột character render font-size 2rem, modal add kanji với input character + auto-suggest: fetch toàn bộ kanji master table vào state khi component mount, filter client-side khi user gõ. Backend: GET /api/admin/kanji (all), POST /api/admin/lessons/:id/kanji (add to lesson).  

**Human Delta & Reflection**

Critical Thinking: AI load toàn bộ kanji master table (2136 kanji JLPT N1-N5) vào memory của component khi mount, rồi filter client-side khi user gõ — gây network request ~500KB mỗi lần mở trang, và tốn memory không cần thiết.  
Contextualization: Admin thường chỉ tìm 1-2 ký tự kanji cụ thể; không cần load tất cả 2136 kanji khi chỉ dùng 5-10 cái mỗi lần thêm bài.  
Creative Synthesis: Đổi sang server-side search: khi admin gõ ký tự, gọi GET /api/admin/kanji/search?q={char} với debounce 300ms; server trả về ≤10 kết quả phù hợp. Network request chỉ xảy ra khi user đang tìm kiếm thực sự.  
Decision: Server-side search thay vì client-side filter; kết hợp AdminLessonVocabulary.jsx áp dụng pattern tương tự. AI propose approach không scalable, phải override.  

**Evidence**

Commit: 37971ff  
Files:  
- frontend/src/pages/admin/AdminLessonKanji.jsx (+449 lines)
- frontend/src/pages/admin/AdminLessons.jsx (+327 lines refactored)
- backend/controllers/adminController.js (+30 lines)
Reason: Kanji lesson type với server-side search thay vì client-side filter.  

---

### Entry #005 — DECISION · Abstraction

**Problem / Context**

Teacher cần question bank riêng để tạo câu hỏi cá nhân (không share với admin/teacher khác). Cần tách logic từ adminController và thêm AI sinh câu hỏi tự động.  

**Prompt to AI**

Hiện tại Question Bank chỉ dành cho admin toàn hệ thống. Tôi cần tạo Teacher Question Bank riêng: mỗi teacher chỉ thấy và quản lý câu hỏi của mình. Hãy: 1) Extract logic question bank từ adminController.js ra teacherQuestionBankController.js riêng — mọi query phải filter theo teacher_id (user hiện đang đăng nhập). 2) Route mới /api/teacher/questions/* với teacher auth middleware (đã có). 3) Tạo utility backend/utils/questionGen.js: hàm generateQuestion(topic, type, level) gọi OpenRouter AI, nhận JSON câu hỏi đúng schema trả về. 4) TeacherQuestionBank.jsx frontend đơn giản. 5) AdminQuestionBank.jsx refactor bỏ code duplicate với teacher version.  

**AI Response (Summary)**

AI sinh teacherQuestionBankController.js (~295 lines) với CRUD questions, routes /api/teacher/questions. questionGen.js (~193 lines): prompt engineering cho từng question type (single_choice, fill_blank...), call OpenRouter, parse và validate JSON response. TeacherQuestionBank.jsx skeleton component. AdminQuestionBank.jsx refactored bỏ 185 lines duplicate.  

**Human Delta & Reflection**

Critical Thinking: Review teacherQuestionBankController.js và phát hiện: GET /api/teacher/questions (getAll) có WHERE teacher_id filter đúng, nhưng PUT /api/teacher/questions/:id (update) và DELETE /api/teacher/questions/:id (delete) không kiểm tra teacher_id — nghĩa là teacher A có thể edit/xóa câu hỏi của teacher B nếu biết ID.  
Contextualization: Authorization check phải có ở mọi mutating endpoint — đây là security requirement cơ bản, không thể bỏ sót dù chỉ 1 endpoint.  
Creative Synthesis: Thêm ownership check vào UPDATE và DELETE: đầu tiên SELECT question WHERE id = :id AND created_by = :teacherId, nếu không tìm thấy thì return 403 Forbidden; test với 2 teacher accounts thực tế.  
Decision: Patch security gap trước khi merge; đây là trường hợp AI bỏ sót authorization logic ở mutating operations — luôn review auth/filter ở mọi endpoint không chỉ GET.  

**Evidence**

Commit: e3f1755  
Files:  
- backend/controllers/teacherQuestionBankController.js (+295 lines)
- backend/utils/questionGen.js (+193 lines)
- backend/routes/api/teacher.js (+29 lines)
- frontend/src/pages/admin/AdminQuestionBank.jsx (+264 lines, −185 lines refactored)
Reason: Teacher question bank với AI generation và ownership security fix.  

---

### Entry #006 — DECISION · Decomposition

**Problem / Context**

Student cần trải nghiệm học khóa học hoàn chỉnh: xem danh sách courses, vào xem nội dung từng unit/lesson, và học từng bài với UI phù hợp theo lesson type.  

**Prompt to AI**

Phần admin quản lý course đã xong. Bây giờ tôi cần implement phần student học khóa học trong Kizuna Nihongo. Cần 3 trang: 1) Courses.jsx — danh sách tất cả courses với card layout (thumbnail, tên, level N1-N5, giá, mô tả ngắn, nút "Đăng ký" hoặc "Tiếp tục học" tùy enrollment status). 2) CourseDetail.jsx — sau khi vào course, xem danh sách các Units và Lessons trong unit với progress indicator (lesson nào đã học xong, bao nhiêu % course). 3) LessonView.jsx — học lesson cụ thể: nếu là vocab thì hiển thị danh sách từ với furigana, nếu là grammar thì hiển thị explanation + examples, nếu là quiz thì render quiz form. Track progress khi student mark lesson là "Done".  

**AI Response (Summary)**

AI sinh Courses.jsx (~230 lines) với card grid, search/filter theo level. CourseDetail.jsx (~295 lines) với unit accordion, lesson list với completion badge, progress bar percentage. LessonView.jsx (~146 lines) với switch-by-type: render vocabulary list, grammar explanation, quiz redirect. Backend: courseController và lessonController update với enrollment API.  

**Human Delta & Reflection**

Critical Thinking: AI render lesson content dùng switch đơn giản nhưng không xử lý rich text — vocab có furigana format [[漢字|かんじ]], grammar có example với furigana và bold marker — nếu không parse sẽ hiển thị raw text "[...]" cho student.  
Contextualization: FuriganaText.jsx đã được team implement (cybervinh2077); cần integrate vào LessonView để render đúng nội dung phong phú.  
Creative Synthesis: Tạo thêm frontend/src/lib/renderPreview.js utility: parse [[text|reading]] → FuriganaText component, handle bold/italic markdown; integrate vào LessonView cho tất cả content types. Ngoài ra tự document hóa UC.md đầy đủ (~2652 lines) để team cùng reference.  
Decision: Thêm renderPreview utility ngoài phạm vi AI đề xuất; viết UC.md như documentation artifact vì team cần align về behavior của từng UC trước khi code.  

**Evidence**

Commit: fc94097  
Files:  
- frontend/src/pages/student/CourseDetail.jsx (+295 lines)
- frontend/src/pages/student/Courses.jsx (+230 lines)
- frontend/src/pages/student/LessonView.jsx (+146 lines)
- frontend/src/lib/renderPreview.js (+32 lines)
- UC.md (+2652 lines)
Reason: Student course experience đầy đủ + UC documentation.  

---

### Entry #007 — PROBLEM-SOLVING · Algorithms

**Problem / Context**

Student làm quiz bị nhiều lỗi nghiêm trọng: submit không hoạt động, timer không auto-submit, kết quả không hiển thị, và multiple-choice không render đúng.  

**Prompt to AI**

Quiz trong Kizuna Nihongo đang có rất nhiều lỗi cho student: 1) Nhấn nút Submit không có response gì — network request không được gửi đi. 2) Timer đếm ngược đến 0 nhưng không tự submit bài. 3) Sau khi submit thành công (test bằng Postman), trang vẫn trắng, không hiển thị điểm và review đáp án. 4) Câu hỏi single-choice hiển thị đúng, nhưng multiple-choice và fill-in-blank không render được. Hãy debug toàn bộ Quiz.jsx và quizController.js để fix hết các lỗi này.  

**AI Response (Summary)**

AI fix: quizController.js calculateScore() — handle null answers trả về 0 điểm, so sánh multiple-choice bằng answer.toString(). Quiz.jsx fix: submit handler thêm await và error handling, timer useEffect dùng setInterval với clearInterval cleanup, thêm ResultPanel component hiển thị score + answer review sau khi submit, render multiple-choice dùng checkbox, fill-blank dùng text input.  

**Human Delta & Reflection**

Critical Thinking: AI fix multiple-choice bằng cách `submittedAnswer.toString() === correctAnswer.toString()` — nhưng multiple-choice lưu trong DB là array JSON [0, 2] (indices đáp án đúng); khi convert sang string, [0,2].toString() = "0,2" nhưng [2,0].toString() = "2,0" — nếu student chọn đúng nhưng thứ tự khác thì bị tính sai.  
Contextualization: Student chọn checkbox không theo thứ tự nhất định; compare array phải không phụ thuộc thứ tự — cần sort trước khi so sánh.  
Creative Synthesis: Viết compareAnswers(submitted, correct, type) function: với multiple-choice → sort cả 2 arrays rồi join("") rồi so sánh string; với fill-blank → trim + toLowerCase + normalize NFC (tránh lỗi unicode Japanese); với single-choice → parseInt compare.  
Decision: Rewrite toàn bộ answer comparison logic thay vì patch nhỏ của AI; grading accuracy là core business logic — không thể để AI sinh rồi dùng nguyên mà không verify kỹ.  

**Evidence**

Commit: 51e5806  
Files:  
- backend/controllers/quizController.js (+31 lines)
- frontend/src/pages/student/Quiz.jsx (+155 lines)
Reason: Fix toàn bộ quiz flow cho student — submit, timer, result, multiple-choice grading. HALLUCINATION CASE #2.  

---

### Entry #008 — PROBLEM-SOLVING · Algorithms

**Problem / Context**

ManageCourseContent.jsx đã phình to (~700 lines) với nhiều state trùng lặp và logic phức tạp — cần refactor để đơn giản và dễ maintain hơn trước khi add thêm tính năng.  

**Prompt to AI**

ManageCourseContent.jsx đang có khoảng 700 dòng code rất khó đọc: state bị duplicate (courseInfo fetch ở nhiều chỗ), fetch logic copy-paste giữa các tab, nhiều code path tưởng như không bao giờ chạy. Tôi cần refactor lại file này và dọn dẹp luôn AdminLessons.jsx, CourseDetail.jsx, LessonView.jsx phía student. Hãy: 1) Xác định dead code và duplicate logic trong ManageCourseContent.jsx. 2) Consolidate data fetching — 1 useEffect cho course info, không fetch lại khi switch tab. 3) Simplify CourseDetail.jsx và LessonView.jsx: bỏ state không dùng, làm gọn render logic.  

**AI Response (Summary)**

AI refactor ManageCourseContent.jsx: xóa 549 lines, còn lại ~150 lines chính; consolidate course fetch vào 1 useEffect; AdminLessons.jsx đơn giản hóa; CourseDetail.jsx và LessonView.jsx cleanup bỏ unused state và dead renders.  

**Human Delta & Reflection**

Critical Thinking: AI refactor quá aggressively — xóa luôn cả phần xử lý empty state (khi course chưa có unit nào). Sau khi refactor, mở trang course vừa tạo mới (chưa có unit) → page crash với "Cannot read properties of undefined (reading 'map')".  
Contextualization: Admin flow bắt buộc phải tạo Course trước, rồi mới tạo Unit, rồi mới tạo Lesson — trạng thái "course rỗng" là valid state đầu tiên mà mọi admin đều trải qua.  
Creative Synthesis: Restore empty state handling: if (!units || units.length === 0) hiển thị EmptyState component "Chưa có bài học nào — nhấn Tạo Unit để bắt đầu"; thêm null-check guard trước mọi .map() call trên data từ API.  
Decision: Refactor hướng đúng (bỏ duplicate code), nhưng phải add lại empty state — lesson learned: khi AI refactor, phải test cả trường hợp data rỗng và first-time experience, không chỉ happy path với data đầy đủ.  

**Evidence**

Commit: fc676ba  
Files:  
- frontend/src/pages/admin/ManageCourseContent.jsx (−549 lines, net reduction)
- frontend/src/pages/admin/AdminLessons.jsx (−96 lines)
- frontend/src/pages/student/CourseDetail.jsx (−65 lines)
- frontend/src/pages/student/LessonView.jsx (−94 lines)
Reason: Refactor simplify course management; phải restore empty state mà AI xóa nhầm.  

---

### Entry #009 — DECISION · Pattern Recognition

**Problem / Context**

Sau refactor, course UI cần được nâng cấp tổng thể về UX và thêm Video lesson type — loại nội dung quan trọng còn thiếu.  

**Prompt to AI**

Sau khi refactor ManageCourseContent, tôi cần nâng cấp UI/UX cho toàn bộ course experience và thêm Video lesson type còn thiếu trong Kizuna Nihongo. Cần: 1) AdminLessonVideo.jsx mới — CRUD cho video bài học: embed YouTube URL (với preview inline), tiêu đề, mô tả, thời lượng tính bằng phút. 2) ManageCourseContent.jsx — cải thiện sidebar navigation: icon cho từng lesson type, active state rõ ràng, counter số lượng items trong mỗi tab. 3) CourseDetail.jsx student — progress circle thay progress bar, hiển thị lesson có icon theo type, locked/unlocked state. 4) LessonView.jsx — layout riêng đẹp hơn cho từng content type.  

**AI Response (Summary)**

AI sinh AdminLessonVideo.jsx (+135 lines) với YouTube URL input, iframe embed preview khi paste URL, CRUD fields. ManageCourseContent.jsx update (+595 lines với UI improvements): sidebar icons, counter badge. CourseDetail.jsx (+215 lines): CircularProgress component, lesson type icons, locked lesson với overlay. LessonView.jsx (+177 lines): card-based layout cho từng type.  

**Human Delta & Reflection**

Critical Thinking: AI implement locked lesson theo logic sequential: lesson N chỉ unlock khi lesson N-1 hoàn thành. Nhưng không phải tất cả course đều cần học theo thứ tự — một course về "Từ vựng theo chủ đề" có thể cho phép student học topic bất kỳ theo hứng thú.  
Contextualization: Tính linh hoạt này là feature thực sự quan trọng về mặt pedagogical; hardcode sequential sẽ frustrate học sinh trong các course dạng thư viện.  
Creative Synthesis: Thêm boolean flag `is_sequential` ở Course level (mặc định false); CourseDetail.jsx kiểm tra flag này — nếu false, tất cả lessons đều accessible; nếu true, apply sequential lock logic của AI. Admin set khi tạo/edit course.  
Decision: is_sequential flag thêm vào schema và UI — AI không propose nhưng đây là pedagogical design decision quan trọng ảnh hưởng học sinh; hai dòng code, tác động lớn về UX.  

**Evidence**

Commit: e90b383  
Files:  
- frontend/src/pages/admin/AdminLessonVideo.jsx (+135 lines, file mới)
- frontend/src/pages/admin/ManageCourseContent.jsx (+595 lines)
- frontend/src/pages/student/CourseDetail.jsx (+215 lines)
- frontend/src/pages/student/LessonView.jsx (+177 lines)
Reason: Video lesson type + UI/UX overhaul + is_sequential flag tự thêm.  

---

### Entry #010 — DECISION · Abstraction

**Problem / Context**

Tồn tại 2 entry point trùng nhau để quản lý lessons: AdminLessons.jsx standalone và ManageCourseContent.jsx — gây confuse và duplicate code.  

**Prompt to AI**

Trong admin panel Kizuna Nihongo hiện có 2 nơi để quản lý lessons: (1) AdminLessons.jsx — trang standalone trong sidebar, hiển thị tất cả lessons của tất cả courses gộp chung. (2) ManageCourseContent.jsx — quản lý lesson trong context của một course cụ thể. Hai trang overlap nhau. Tôi đang phân vân nên giữ cả hai hay bỏ bớt. Hãy tư vấn: trường hợp nào thì cần global lesson view, trường hợp nào thì contextual đủ rồi? Và hãy giúp tôi implement quyết định cuối cùng.  

**AI Response (Summary)**

AI tư vấn: nên giữ cả hai vì AdminLessons.jsx cho phép admin "xem tổng quan tất cả lesson trong hệ thống" và filter cross-course — propose thêm cross-link giữa 2 trang để navigate qua lại.  

**Human Delta & Reflection**

Critical Thinking: AI suggest giữ cả 2 nhưng lý do không thuyết phục — "xem tổng quan all lessons cross-course" không phải user story thực tế nào trong UC document. Admin không bao giờ cần list "tất cả lessons của tất cả courses" mà không có context course cụ thể.  
Contextualization: AdminLessons.jsx là trang boilerplate từ initial commit (580765c của Vinh), không có user story nào mapping vào đó trong UC.md. Giữ lại chỉ làm sidebar admin rối thêm 1 entry vô nghĩa.  
Creative Synthesis: Reject đề xuất của AI; quyết định xóa hoàn toàn AdminLessons.jsx (305 lines) và route của nó, remove entry khỏi AdminLayout sidebar. Tất cả lesson management đi qua ManageCourseContent — contextual, per-course, rõ ràng hơn.  
Decision: SIMPLICITY WINS — xóa bỏ hẳn trang dư thừa thay vì add more navigation complexity theo đề xuất AI. Lesson: AI đôi khi suggest "giữ cả hai" để avoid conflict, nhưng đây là over-engineering không cần thiết.  

**Evidence**

Commit: 6448e17  
Files:  
- frontend/src/App.jsx (−2 lines, remove route)
- frontend/src/pages/admin/AdminLessons.jsx (−303 lines, deleted)
Reason: Xóa trang AdminLessons dư thừa — reject AI suggestion giữ cả 2.  

---

### Entry #011 — DECISION · Pattern Recognition

**Problem / Context**

AdminLessonKanji và AdminLessonVocabulary chỉ có thể tạo mới từng item — admin cần thêm khả năng chọn nhiều items từ kho từ vựng/kanji đã có để add vào bài học nhanh hơn.  

**Prompt to AI**

AdminLessonKanji.jsx và AdminLessonVocabulary.jsx hiện tại chỉ có flow: nhập tay từng kanji/vocab → save → gắn với lesson. Nhưng hệ thống đã có kho vocabulary và kanji master table sẵn có. Admin muốn chọn từ kho đó thay vì nhập lại từ đầu. Hãy thêm vào cả 2 file: 1) Modal "Chọn từ thư viện" với DataTable paginated, search bar, filter level. 2) Checkbox multi-select. 3) Nút "Thêm vào bài học" → gọi API bulk-add. Implement cho AdminLessonKanji.jsx (+133 lines) và AdminLessonVocabulary.jsx (+133 lines).  

**AI Response (Summary)**

AI sinh modal "Select from Library" cho cả 2 file: DataTable với search input, level filter dropdown, checkbox selection state, bulk-add button gọi POST /api/admin/lessons/:id/vocabulary/bulk (hoặc /kanji/bulk). Nút "Add New" và "Select from Library" đặt song song nhau trên toolbar.  

**Human Delta & Reflection**

Critical Thinking: AI đặt 2 nút "Tạo mới" và "Chọn từ thư viện" ngang hàng nhau — không có hierarchy rõ ràng nên admin không biết nên dùng flow nào. Về mặt UX và data hygiene, admin nên tìm trong library trước, chỉ tạo mới khi không tìm thấy.  
Contextualization: Nếu admin cứ "Tạo mới" thay vì tìm trong library, sẽ tạo duplicate entries trong vocabulary/kanji master table — gây data messy về lâu dài.  
Creative Synthesis: Restructure UI: 1 nút chính "Thêm Vocab/Kanji" mở modal; modal có 2 tab: tab "Chọn từ thư viện" active mặc định (promote library-first behavior), tab "Tạo mới" thứ hai (hidden unless needed). User flow: search library → không thấy → chuyển tab → tạo mới → auto-add vào lesson luôn.  
Decision: Tab-within-modal pattern thay vì dual buttons; thay đổi nhỏ nhưng ép đúng user behavior và giảm risk duplicate data.  

**Evidence**

Commit: 3c32a7a  
Files:  
- frontend/src/pages/admin/AdminLessonKanji.jsx (+133 lines)
- frontend/src/pages/admin/AdminLessonVocabulary.jsx (+133 lines)
- backend/controllers/adminController.js (+89 lines)
- backend/controllers/lessonController.js (+24 lines)
Reason: Thêm "chọn từ thư viện" cho Kanji và Vocabulary lesson — tab UI thay vì dual buttons.  

---

### Entry #012 — VERIFICATION · Abstraction

**Problem / Context**

Sau nhiều sprint build và refactor, cần verify toàn bộ student course flow hoạt động end-to-end: từ enroll đến học xong lesson, và admin course builder không còn lỗi sau các lần sửa.  

**Prompt to AI**

Hệ thống course của Kizuna Nihongo đã trải qua nhiều lần refactor (fc676ba simplify, e90b383 UI overhaul). Tôi cần verify toàn bộ flow trước khi merge vào main: 1) Admin tạo Course → tạo Unit → tạo Lesson các loại (Vocab/Grammar/Quiz/Kanji/Video) → publish. 2) Student vào Courses.jsx → enroll → CourseDetail.jsx thấy units và lessons → vào LessonView.jsx học từng type → mark done → progress cập nhật. 3) Edge cases: lesson đầu tiên (chưa có progress), course với is_sequential=true, lesson type Video với YouTube URL. Hãy review code flow và chỉ ra điểm nào còn yếu.  

**AI Response (Summary)**

AI review code (được cung cấp các file CourseDetail.jsx, LessonView.jsx, courseController.js) và chỉ ra: 1) courseController.js thiếu join lesson_progress khi fetch course detail → progress không load. 2) LessonView.jsx không handle trường hợp lesson.content là null (lesson mới tạo chưa có content). 3) Video embed không sanitize YouTube URL → XSS potential nếu admin paste link lạ.  

**Human Delta & Reflection**

Critical Thinking: AI phát hiện đúng 3 vấn đề nhưng đánh giá mức độ nghiêm trọng sai — AI rate XSS issue là "low" vì chỉ admin mới paste URL; nhưng stored XSS từ admin panel vẫn là security issue thực sự vì URL sẽ render cho student.  
Contextualization: Nếu admin (dù vô ý) paste một URL không phải YouTube có chứa script, student xem lesson Video sẽ bị ảnh hưởng — admin không phải attack vector vô hại.  
Creative Synthesis: Fix tất cả 3 issues: add LEFT JOIN lesson_progress vào courseController query; null-check content trước render trong LessonView; sanitize YouTube URL bằng regex chỉ accept /youtube.com/watch?v=ID hoặc /youtu.be/ID pattern, reject bất kỳ URL nào không match.  
Decision: Treat XSS risk nghiêm túc hơn AI đánh giá — sanitize ngay cả input từ trusted admin; principle: validate tại point of entry, không assume trust vì role.  

**Evidence**

Commit: e90b383 (video sanitize), fc94097 (progress join)  
Files:  
- backend/controllers/courseController.js (+33 lines, progress join)
- frontend/src/pages/student/LessonView.jsx (null-check)
- frontend/src/pages/admin/AdminLessonVideo.jsx (URL sanitize)
Reason: End-to-end verification + fix 3 issues AI phát hiện, bao gồm XSS sanitize video URL.  

---

### Entry #013 — DECISION · Decomposition

**Problem / Context**

Course module mới chỉ có content builder; cần biến nó thành khóa học thực sự: student ghi danh (enroll), đánh giá (review), và teacher tự quản lý khóa học của mình (không chỉ admin). Cần thiết kế data model cho paid/free course.  

**Prompt to AI**

Sau khi chuyển sang repo mới, tôi cần nâng Course module của Kizuna Nihongo thành hệ thống khóa học đầy đủ. Yêu cầu: 1) Enrollment — student ghi danh vào course (free thì enroll ngay, paid thì chờ thanh toán), bảng enrollments (user_id, course_id, status, enrolled_at). 2) Reviews — student đã enroll được đánh giá sao (1-5) + comment; hiển thị rating trung bình trên CourseCard. 3) Teacher course management — teacher tạo/sửa/xóa khóa học của chính mình qua TeacherLayout, tách quyền với admin. 4) UI mới: CourseCard component với thumbnail/rating/giá, Stars component, trang Courses redesign. Viết migration SQL cho toàn bộ (paid_courses).  

**AI Response (Summary)**

AI sinh enrollmentController.js (79 lines), reviewController.js (118 lines), mở rộng teacherController.js (+244 lines) cho teacher course CRUD, migration 008_paid_courses.sql (211 lines: enrollments, course_reviews, price columns). Frontend: CourseCard.jsx, Stars.jsx, redesign AdminCourses.jsx và Courses.jsx, CourseDetail.jsx với enroll button + review section.  

**Human Delta & Reflection**

Critical Thinking: AI thiết kế review cho phép mọi user đã đăng nhập đánh giá — không kiểm tra người đó đã enroll và đã học course chưa. Điều này cho phép review giả (user chưa từng học vẫn spam 1 sao hoặc 5 sao).  
Contextualization: Rating là yếu tố quyết định student có chọn course không; review từ người chưa học làm sai lệch chất lượng thực và mở đường cho abuse.  
Creative Synthesis: Thêm ràng buộc ở reviewController: chỉ cho phép POST review nếu tồn tại enrollment (user_id, course_id) với status='active'; UNIQUE constraint (user_id, course_id) để mỗi người review 1 lần, cho phép update thay vì tạo nhiều.  
Decision: Enroll-gated reviews — AI không đặt ràng buộc này; đây là business rule quan trọng về tính toàn vẹn dữ liệu đánh giá.  

**Evidence**

Commit: 3829165  
Files:  
- backend/controllers/enrollmentController.js (+79)
- backend/controllers/reviewController.js (+118)
- backend/controllers/teacherController.js (+244)
- backend/migrations/008_paid_courses.sql (+211)
- frontend/src/components/ui/CourseCard.jsx, Stars.jsx
Reason: Enrollment + reviews + teacher course management.  

---

### Entry #014 — DECISION · Abstraction

**Problem / Context**

Việc sửa nội dung bài học đang rải rác trong ManageCourseContent (admin) và chưa có cho teacher. Cần một trang chỉnh sửa Unit/Lesson dùng chung (shared) cho cả admin lẫn teacher, giảm trùng lặp.  

**Prompt to AI**

Hiện admin sửa nội dung course qua ManageCourseContent.jsx nhưng teacher chưa có công cụ tương đương, và logic edit đang bị phân mảnh. Tôi muốn refactor: tạo một trang UnitEditPage.jsx dùng chung (shared) để chỉnh sửa một Unit và toàn bộ lesson bên trong (vocab/grammar/kanji/reading/quiz/video) trong một chỗ. Trang này phải hoạt động cho cả admin (route /admin/...) và teacher (TeacherCourseContent.jsx), phân quyền theo role nhưng tái sử dụng cùng component. Thêm migration cho unit description. Đồng thời redesign CourseDetail student cho khớp cấu trúc Unit mới.  

**AI Response (Summary)**

AI sinh UnitEditPage.jsx (627 lines) — một trang tổng hợp edit unit + tất cả lesson types, dùng useEditorArea hook. TeacherCourseContent.jsx wiring cho teacher. migration 009_unit_description.sql. CourseDetail.jsx cập nhật (+177). ManageCourseContent.jsx rút gọn để trỏ sang UnitEditPage.  

**Human Delta & Reflection**

Critical Thinking: AI làm UnitEditPage dùng chung nhưng hardcode các API path theo admin endpoint (/api/admin/...); khi teacher dùng, các call này trả 403 vì teacher không có quyền admin — trang crash im lặng với teacher.  
Contextualization: Mục tiêu refactor là dùng chung cho 2 role, nhưng "dùng chung component" ≠ "dùng chung endpoint" — teacher có route /api/teacher/... riêng với ownership filter.  
Creative Synthesis: Truyền prop `apiBase` (hoặc role) vào UnitEditPage; component chọn endpoint theo role (admin → /api/admin, teacher → /api/teacher). Một component, hai nguồn API tùy context.  
Decision: Parametrize endpoint theo role thay vì hardcode admin path — đây là điểm mấu chốt để shared component thật sự dùng được cho cả 2 role; AI bỏ sót khiến teacher flow hỏng.  

**Evidence**

Commit: bea717b  
Files:  
- frontend/src/pages/shared/UnitEditPage.jsx (+627)
- frontend/src/pages/teacher/TeacherCourseContent.jsx
- backend/migrations/009_unit_description.sql
- frontend/src/pages/student/CourseDetail.jsx (+177)
Reason: Shared Unit editor cho admin + teacher, redesign lesson editing.  

---

### Entry #015 — DECISION · Algorithms

**Problem / Context**

Quiz/exam cần chế độ chống gian lận mạnh hơn face-detection cũ: khóa toàn màn hình (fullscreen lockdown) và phát hiện thoát fullscreen / chuyển tab, đặc biệt cho bài thi nghiêm túc.  

**Prompt to AI**

Tôi cần thêm chế độ "strict fullscreen lockdown" cho quiz/exam trong Kizuna Nihongo. Yêu cầu: 1) Khi quiz bật strict mode, ép vào fullscreen bằng Fullscreen API trước khi bắt đầu; nếu student thoát fullscreen hoặc chuyển tab (visibilitychange) thì cảnh báo và ghi nhận vi phạm. 2) Sau N lần vi phạm thì auto-submit bài. 3) Hook useFullscreenLockdown.js tái sử dụng được. 4) Admin/teacher bật/tắt strict mode khi soạn quiz. 5) Migration cho cột strict_fullscreen. Backend lưu số lần vi phạm vào attempt.  

**AI Response (Summary)**

AI sinh useFullscreenLockdown.js (85 lines): requestFullscreen, listener cho fullscreenchange + visibilitychange, đếm violation, callback onViolationLimit. quizController.js (+83) lưu violation count. migration 010_quiz_strict_fullscreen.sql. Quiz.jsx (+199) tích hợp hook, AdminLessonQuiz/AdminQuizzes/ExamEditor thêm toggle.  

**Human Delta & Reflection**

Critical Thinking: AI đếm mọi `visibilitychange` thành violation — nhưng event này fire cả khi trình duyệt tự minimize do OS notification, hoặc khi student vô tình nhận cuộc gọi trên laptop; đồng thời một số browser fire fullscreenchange 2 lần cho 1 hành động → đếm double, auto-submit oan.  
Contextualization: Bài thi thật quan trọng; auto-submit oan vì false positive sẽ gây khiếu nại nặng từ student.  
Creative Synthesis: Thêm debounce/grace: bỏ qua violation nếu quay lại fullscreen trong < 2s; dedupe fullscreenchange bằng cách so sánh document.fullscreenElement thực tế thay vì đếm event; chỉ tính visibilitychange khi document.hidden===true và kéo dài > ngưỡng.  
Decision: Debounced + state-based violation detection thay vì đếm raw event — giảm false positive; giữ nguyên kiến trúc hook của AI nhưng viết lại logic đếm.  

**Evidence**

Commit: c59c532  
Files:  
- frontend/src/lib/useFullscreenLockdown.js (+85)
- backend/controllers/quizController.js (+83)
- backend/migrations/010_quiz_strict_fullscreen.sql
- frontend/src/pages/student/Quiz.jsx (+199)
Reason: Strict fullscreen lockdown mode cho quiz/exam.  

---

### Entry #016 — PROBLEM-SOLVING · Algorithms

**Problem / Context**

Bài học Kanji cần cho student tải worksheet PDF luyện viết (ô 米字格). AI sinh layout ban đầu bị sai lưới và các thẻ kanji bị cắt ngang khi sang trang PDF.  

**Prompt to AI**

Tôi cần tính năng tải worksheet PDF luyện viết kanji từ trong bài học (LessonView). Yêu cầu: mỗi kanji render thành thẻ có ô 米字格 (grid gồm đường chéo + đường giữa) để tập viết, sinh PDF nhiều trang bằng html2canvas + jsPDF, tách logic vào WorksheetPreview.jsx và kanjiWorksheet.js. Ban đầu AI đã làm nhưng lưới 米字格 vẽ sai tỉ lệ và các thẻ kanji bị cắt đôi khi tràn sang trang mới. Hãy sửa để lưới đúng và mỗi thẻ nằm trọn trong một trang.  

**AI Response (Summary)**

AI (lần đầu) sinh WorksheetPreview.jsx + kanjiWorksheet.js với grid dùng background linear-gradient và chia trang PDF theo chiều cao cố định. Sau khi tôi báo lỗi, AI đề xuất tăng DPI canvas và điều chỉnh lại vị trí đường lưới.  

**Human Delta & Reflection**

Critical Thinking: Fix của AI (tăng DPI) không giải quyết gốc rễ: PDF cắt thẻ vì thuật toán chia trang cắt theo pixel height tuyệt đối, không quan tâm ranh giới thẻ; lưới sai vì linear-gradient percentage lệch khi khung không vuông.  
Contextualization: Worksheet in ra giấy để học sinh viết tay; thẻ bị cắt đôi giữa 2 trang là không dùng được, lưới lệch làm ô 米字格 sai chuẩn tập viết.  
Creative Synthesis: (1) Vẽ lưới bằng tọa độ tuyệt đối (đường chéo qua tâm, đường ngang/dọc chính giữa) trên khung buộc vuông (aspect-ratio 1:1) thay vì gradient %. (2) Thuật toán phân trang theo thẻ: tính chiều cao từng thẻ, nếu thẻ không đủ chỗ ở trang hiện tại thì đẩy nguyên thẻ sang trang mới (page-break trước thẻ), không cắt giữa.  
Decision: Refactor cả grid rendering lẫn pagination — commit tính năng (f90d5f4) rồi commit fix riêng (0fb8a54); AI xử lý bề mặt (DPI) trong khi vấn đề là thuật toán bố cục.  

**Evidence**

Commit: f90d5f4 (feature), 0fb8a54 (fix)  
Files:  
- frontend/src/components/kanji/WorksheetPreview.jsx (+103, sau +29)
- frontend/src/lib/kanjiWorksheet.js (+48, sau +41)
- frontend/src/pages/student/LessonView.jsx (+38)
Reason: Kanji worksheet PDF + fix lưới 米字格 và chống cắt thẻ qua trang. HALLUCINATION CASE #4.  

---

### Entry #017 — DECISION · Pattern Recognition

**Problem / Context**

Student đang học vocab/kanji trong một bài học muốn lưu nhanh những từ đó vào bộ flashcard cá nhân để ôn tập, thay vì phải nhập lại thủ công.  

**Prompt to AI**

Trong LessonView của Kizuna Nihongo, khi student đang học phần vocabulary hoặc kanji của một bài, tôi muốn cho phép họ chọn (multi-select) các từ/kanji ngay tại đó và "Thêm vào bộ flashcard cá nhân". Yêu cầu: checkbox chọn từ trong danh sách vocab/kanji của lesson, nút "Thêm vào flashcard", modal chọn bộ flashcard đích (hoặc tạo bộ mới), gọi API flashcard đã có sẵn để thêm cards. Chỉ cần sửa trong LessonView.jsx.  

**AI Response (Summary)**

AI sinh trong LessonView.jsx (+269): selection state cho vocab/kanji items, nút bulk-add, modal chọn/tạo flashcard set, map mỗi vocab/kanji thành card (front=word, back=meaning), gọi POST flashcard cards.  

**Human Delta & Reflection**

Critical Thinking: AI map thẳng vocab → card với front=word, back=meaning nhưng bỏ mất reading (furigana) và example — trong khi flashcard tiếng Nhật cần reading ở mặt trước (để biết cách đọc) và example ở mặt sau (ngữ cảnh). Card sinh ra thiếu dữ liệu học.  
Contextualization: Toàn bộ giá trị của flashcard tiếng Nhật nằm ở reading + ví dụ; nếu chỉ có word→meaning thì student không luyện được cách đọc.  
Creative Synthesis: Map đầy đủ: front = word + reading (furigana [[..|..]]), back = meaning + part_of_speech + example; với kanji thì front = character, back = on/kun reading + nghĩa + hán việt. Tái dùng dữ liệu đã có trong lesson item, không để rơi field.  
Decision: Rich card mapping giữ nguyên mọi field học tập — AI đơn giản hóa quá mức làm mất giá trị sư phạm của flashcard.  

**Evidence**

Commit: 8e29167  
Files:  
- frontend/src/pages/student/LessonView.jsx (+269)
Reason: Chọn vocab/kanji trong bài → thêm vào flashcard cá nhân với đầy đủ reading/example.  

---

### Entry #018 — DECISION · Abstraction

**Problem / Context**

Video lesson trước đây chỉ nhận YouTube URL; giáo viên muốn upload file video trực tiếp cho bài học riêng tư (không public lên YouTube). Cần quyết định cách lưu trữ file video.  

**Prompt to AI**

Video lesson editor hiện chỉ cho nhập YouTube URL. Tôi cần cho phép admin/teacher upload file video trực tiếp (mp4) cho bài học, vì nhiều nội dung không muốn đăng public YouTube. Yêu cầu: input upload file trong AdminLessonVideo.jsx, backend nhận file và lưu, trả về URL để phát trong LessonView. Thêm route cho cả admin và teacher. Giữ luôn lựa chọn YouTube URL như cũ (2 nguồn: URL hoặc upload).  

**AI Response (Summary)**

AI sinh upload endpoint trong adminController.js (+15) và routes admin/teacher, dùng multer nhận file, upload lên Supabase Storage, trả public URL. AdminLessonVideo.jsx (+87): toggle giữa "YouTube URL" và "Upload file", progress, preview.  

**Human Delta & Reflection**

Critical Thinking: AI upload video lên Supabase Storage bucket public và trả public URL cố định — nhưng video bài học của khóa trả phí (paid course) không được để public, ai có URL cũng xem được → rò rỉ nội dung có phí.  
Contextualization: Dự án có paid courses (migration 008); nội dung video của course trả phí phải được bảo vệ sau paywall, không thể là public URL vĩnh viễn.  
Creative Synthesis: Với video của paid course, lưu vào bucket private và phát bằng signed URL sinh on-demand khi student đã enroll (kiểm tra courseAccess); video của free course/public thì vẫn dùng public URL. Chọn bucket theo tính phí của course.  
Decision: Storage bucket + signed URL theo trạng thái phí của course — AI mặc định public gây rò rỉ nội dung trả phí; đây là quyết định bảo mật/bản quyền quan trọng.  

**Evidence**

Commit: 6f2291f  
Files:  
- backend/controllers/adminController.js (+15)
- backend/routes/api/admin.js (+11), teacher.js (+11)
- frontend/src/pages/admin/AdminLessonVideo.jsx (+87)
Reason: Upload video file trực tiếp cho video lesson, phân biệt public/private theo course.  

---

### Entry #019 — DECISION · Pattern Recognition

**Problem / Context**

Nhập vocab/kanji/grammar từng dòng quá chậm; giáo viên có sẵn file Excel/DOCX/CSV. Cần dùng AI để parse file bất kỳ định dạng thành đúng schema rồi import hàng loạt.  

**Prompt to AI**

Tôi cần tính năng import file có AI hỗ trợ cho vocabulary, kanji và grammar trong Kizuna Nihongo. Giáo viên upload file Excel/DOCX/CSV với cột không chuẩn hóa (tên cột tiếng Việt/Nhật/Anh lẫn lộn, thứ tự tùy ý). Yêu cầu: 1) Parser đọc file (xlsx/docx/csv) thành bảng thô. 2) Gửi bảng thô cho AI để map các cột về đúng schema (word/reading/meaning/pos/example cho vocab; character/on/kun/meaning/stroke cho kanji; pattern/explanation/example cho grammar). 3) Preview kết quả cho giáo viên duyệt trước khi import. 4) ImportFileModal.jsx UI. Viết fileImportParser.js util và importFileController.js.  

**AI Response (Summary)**

AI sinh fileImportParser.js (276 lines) đọc xlsx (SheetJS)/docx/csv, importFileController.js (35), mở rộng adminController + teacherController cho import, migration 011_lesson_grammar_points + 012_vocabulary_word_fallback. ImportFileModal.jsx (306) với preview table. AI mapping cột → schema qua OpenRouter.  

**Human Delta & Reflection**

Critical Thinking: AI để LLM tự do map cột và trả JSON, nhưng khi file có cột lạ (ví dụ "Ghi chú"), AI đôi khi nhét nhầm reading vào cột meaning hoặc bịa thêm field không có trong file (hallucination) — import vào DB sai lệch hàng loạt.  
Contextualization: Import hàng loạt nghĩa là 1 lỗi mapping nhân lên hàng trăm dòng; giáo viên khó phát hiện nếu preview không rõ nguồn gốc từng ô.  
Creative Synthesis: (1) Ràng buộc AI chỉ được map vào tập field cố định, cấm bịa; validate response bằng schema whitelist, drop field lạ. (2) Migration 012_vocabulary_word_fallback: nếu AI không chắc cột 'word', fallback lấy cột đầu tiên thay vì để trống/bịa. (3) Preview hiển thị mapping "cột file → field DB" để giáo viên sửa trước khi commit.  
Decision: Schema-whitelisted AI mapping + fallback + preview mapping — không tin tưởng tuyệt đối output AI cho thao tác ghi hàng loạt.  

**Evidence**

Commit: 7b167d1  
Files:  
- backend/utils/fileImportParser.js (+276)
- backend/controllers/importFileController.js (+35)
- backend/migrations/011_*, 012_vocabulary_word_fallback.sql
- frontend/src/components/admin/ImportFileModal.jsx (+306)
- frontend/src/pages/admin/AdminLessonGrammar.jsx (+701)
Reason: AI-assisted file import cho vocab/kanji/grammar. HALLUCINATION CASE #5.  

---

### Entry #020 — DECISION · Decomposition

**Problem / Context**

Khóa học trả phí cần cổng thanh toán thực (SePay/VietQR) với tự động đối soát và mở khóa; đồng thời câu hỏi tự luận (free-writing) cần AI chấm điểm tự động thay vì chờ giáo viên.  

**Prompt to AI**

Tôi cần 2 tính năng lớn cho Kizuna Nihongo: (A) Course payment qua SePay: student mua khóa học trả phí, sinh mã đơn (prefix COURSE), hiển thị VietQR, webhook SePay đối soát giao dịch theo nội dung chuyển khoản, khi khớp thì auto-enroll và mở khóa lesson/quiz (trước đó trả 403 paywall). (B) AI grading cho câu short-answer/tự luận trong quiz: khi câu hỏi là tự luận, gọi AI chấm điểm dựa trên đáp án mẫu + rubric, trả điểm + nhận xét thay vì để pending. Viết service tách riêng, migration cho cả hai.  

**AI Response (Summary)**

AI sinh coursePaymentController.js (43), coursePaymentService.js (140), mở rộng paymentMatchingService.js (+94), courseAccess.js (34) cho paywall, migration 013_course_payments + 014_ai_grade_short_answer. quizController.js (+76) gọi AI chấm tự luận. CourseDetail.jsx (+191) trang mua + QR, Quiz.jsx (+23) hiển thị điểm AI.  

**Human Delta & Reflection**

Critical Thinking: (Payment) AI đối soát chỉ so khớp số tiền — nếu 2 student mua 2 course cùng giá chuyển cùng lúc, không phân biệt được đơn nào, dễ mở nhầm khóa. (AI grading) AI chấm tự luận trả điểm nhưng đôi khi bịa "tiêu chí" hoặc cho điểm dao động cho cùng một bài (thiếu ổn định).  
Contextualization: Payment sai = mất tiền/mở nhầm quyền, cực kỳ nhạy cảm. Chấm điểm không nhất quán = bất công cho student và mất niềm tin.  
Creative Synthesis: (Payment) Bắt buộc đối soát theo mã đơn duy nhất trong nội dung chuyển khoản (COURSE+orderId), không chỉ số tiền; đơn nào không khớp mã thì để manual review. (AI grading) Prompt rubric cố định + temperature=0 để điểm ổn định; chặn AI bịa tiêu chí bằng cách yêu cầu chỉ chấm theo rubric truyền vào; clamp điểm về thang hợp lệ.  
Decision: Đối soát theo mã đơn (không theo tiền) + AI grading rubric-locked temperature=0 — hai điểm này quyết định tính đúng đắn tài chính và công bằng chấm điểm.  

**Evidence**

Commit: 0269eb3  
Files:  
- backend/services/coursePaymentService.js (+140), paymentMatchingService.js (+94), courseAccess.js (+34)
- backend/migrations/013_course_payments.sql, 014_ai_grade_short_answer.sql
- backend/controllers/quizController.js (+76)
- frontend/src/pages/student/CourseDetail.jsx (+191)
Reason: Course payment SePay + AI grading câu tự luận. HALLUCINATION CASE #6.  

---

### Entry #021 — DECISION · Algorithms

**Problem / Context**

Hoàn thành lesson đang chỉ cần "làm quiz" bất kể điểm; cần đặt ngưỡng đạt (pass threshold) và chỉ tính hoàn thành lesson khi student đạt ngưỡng, để đảm bảo chất lượng học.  

**Prompt to AI**

Tôi cần thêm cơ chế "pass threshold" cho quiz trong Kizuna Nihongo: 1) Admin/teacher đặt ngưỡng điểm đạt (ví dụ 70%) khi soạn quiz. 2) Student phải đạt ngưỡng mới được tính "hoàn thành" lesson chứa quiz đó; chưa đạt thì lesson chưa complete và (nếu course sequential) chưa mở lesson sau. 3) Hiển thị pass/fail rõ ràng ở kết quả và ExamHistory. 4) Service passThreshold.js tái sử dụng, component PassThresholdField. Migration cho cột threshold.  

**AI Response (Summary)**

AI sinh service passThreshold.js (38), migration 016_quiz_pass_threshold + 015_proctored_implies_strict_fullscreen, PassThresholdField.jsx (46), sửa quizController (+29)/examController (+34)/lessonController (+14) để gate completion, Quiz.jsx rút gọn (-129 lines, dồn logic vào service), ExamHistory hiển thị pass/fail.  

**Human Delta & Reflection**

Critical Thinking: AI gate lesson completion dựa trên điểm lần làm quiz **gần nhất** — nghĩa là student đã đạt (85%) rồi làm lại thử nghiệm bị 40% sẽ mất trạng thái hoàn thành lesson. Vô lý về mặt sư phạm (đã từng đạt thì không nên bị tước).  
Contextualization: Student hay làm lại quiz để ôn; dùng "lần gần nhất" khiến việc ôn tập lại có thể phá completion đã đạt, chặn cả lesson sau trong course sequential.  
Creative Synthesis: Gate theo **điểm cao nhất từng đạt** (best attempt ≥ threshold) thay vì lần gần nhất; passThreshold.js kiểm tra tồn tại ít nhất một attempt đạt ngưỡng. Vẫn lưu mọi attempt cho lịch sử.  
Decision: Best-attempt gating — completion là trạng thái "đã từng chứng minh đạt", không nên revert khi ôn lại; AI dùng last-attempt gây mất tiến độ oan.  

**Evidence**

Commit: a64fb30  
Files:  
- backend/services/passThreshold.js (+38)
- backend/migrations/016_quiz_pass_threshold.sql, 015_proctored_implies_strict_fullscreen.sql
- frontend/src/components/admin/PassThresholdField.jsx (+46)
- backend/controllers/quizController.js, examController.js, lessonController.js
Reason: Quiz pass threshold + gate lesson completion theo best attempt.  

---

## 3. Hallucination Detection Log

> MỖI PROJECT PHẢI PHÁT HIỆN ÍT NHẤT: Lab (≥1), Assignment (≥2), Project (≥3) cases hallucination

### Entry #005 — Logic Error

- **AI's Claim:** AI sinh teacherQuestionBankController.js với đầy đủ CRUD và tuyên bố "mọi endpoint đều filter theo teacher_id để đảm bảo data isolation".
- **Reality Check:** Sau khi review kỹ, UPDATE và DELETE endpoints không có WHERE created_by = teacherId — chỉ lọc theo question ID. Teacher A có thể sửa/xóa câu hỏi của Teacher B nếu biết ID.
- **How Detected:** Developer đọc lại từng handler trong file AI sinh, test thủ công bằng cách gọi PUT /api/teacher/questions/:idOfAnotherTeacher với token của teacher khác → 200 OK thay vì 403.
- **Corrective Action:** Thêm ownership check vào mọi mutating endpoint: SELECT trước WHERE id=:id AND created_by=:teacherId → nếu null thì 403; viết thêm test case với 2 teacher accounts (commit e3f1755).

### Entry #007 — Logic Error

- **AI's Claim:** AI fix multiple-choice grading bằng cách dùng `submittedAnswer.toString() === correctAnswer.toString()` và tuyên bố "đã xử lý đúng multiple choice array comparison".
- **Reality Check:** Array comparison qua toString() phụ thuộc thứ tự: [0,2].toString() = "0,2" nhưng [2,0].toString() = "2,0" → student chọn đúng đáp án nhưng sai thứ tự bị tính sai. Multiple choice checkbox không đảm bảo thứ tự chọn.
- **How Detected:** Kiểm tra bằng cách chọn 2 checkbox theo thứ tự ngược: answer correct [0,2], student submit [2,0] → điểm 0, nhưng đáp án thực sự đúng. Phát hiện qua manual test với bài quiz thực tế.
- **Corrective Action:** Viết compareAnswers(submitted, correct, type) với multiple-choice: sort cả 2 arrays trước khi so sánh. Test với nhiều tổ hợp order khác nhau cho cùng set đáp án đúng (commit 51e5806).

### Entry #008 — Oversimplification

- **AI's Claim:** AI refactor ManageCourseContent.jsx, xóa code "redundant" và tuyên bố "đã giữ lại tất cả functionality quan trọng, chỉ remove dead code".
- **Reality Check:** Code AI xóa bao gồm cả empty state handling — khi course chưa có unit nào (trạng thái đầu tiên khi tạo course mới), trang crash với TypeError vì .map() gọi trên undefined.
- **How Detected:** Tạo course mới, không add unit, vào trang ManageCourseContent → browser console báo "Cannot read properties of undefined (reading 'map')". Phát hiện ngay trong lần test đầu tiên sau refactor.
- **Corrective Action:** Restore empty state guards: kiểm tra if (!units || units.length === 0) hiển thị EmptyState component; thêm optional chaining (?.) và nullish coalescing (?? []) cho tất cả array operations trên data từ API (commit fc676ba, human modification).

### Entry #016 — Oversimplification

- **AI's Claim:** AI sinh worksheet kanji và tuyên bố PDF "phân trang tự động, mỗi kanji có ô 米字格 chuẩn"; khi báo lỗi, AI khẳng định chỉ cần tăng DPI canvas là hết cắt thẻ.
- **Reality Check:** Thuật toán chia trang cắt theo pixel height tuyệt đối nên cắt đôi thẻ kanji giữa 2 trang; lưới 米字格 vẽ bằng linear-gradient % bị lệch khi khung không vuông. Tăng DPI không liên quan gốc rễ.
- **How Detected:** In thử PDF ra: thẻ kanji bị cắt ngang ở ranh giới trang, ô lưới lệch tâm. Phát hiện khi kiểm tra output in giấy thực tế.
- **Corrective Action:** Vẽ lưới bằng tọa độ tuyệt đối trên khung aspect-ratio 1:1; phân trang theo ranh giới thẻ (đẩy nguyên thẻ sang trang mới nếu không đủ chỗ) thay vì cắt theo pixel (commit 0fb8a54).

### Entry #019 — Context Misunderstanding

- **AI's Claim:** AI mapping cột file import tự tin gán mọi cột về schema và "suy luận" thêm các field không có trong file, khẳng định mapping đã đúng.
- **Reality Check:** Với file có cột lạ (vd "Ghi chú"), AI nhét nhầm reading vào cột meaning và tự bịa field không tồn tại trong file gốc → import sai hàng loạt.
- **How Detected:** Preview import cho file mẫu có cột không chuẩn: thấy reading nằm sai ô, có field xuất hiện dù file không có cột đó. Phát hiện nhờ đối chiếu preview với file gốc.
- **Corrective Action:** Ràng buộc AI chỉ map vào whitelist field cố định, cấm bịa; validate + drop field lạ; fallback lấy cột đầu cho 'word' (migration 012); preview hiển thị mapping "cột→field" để giáo viên sửa (commit 7b167d1).

### Entry #020 — Logic Error / Fabrication

- **AI's Claim:** AI chấm câu tự luận trả về điểm kèm danh sách "tiêu chí đánh giá"; đồng thời khẳng định đối soát thanh toán "khớp theo số tiền là đủ chính xác".
- **Reality Check:** (a) AI đôi khi bịa tiêu chí không nằm trong rubric và cho điểm dao động cho cùng một bài. (b) Đối soát chỉ theo số tiền không phân biệt được 2 đơn cùng giá chuyển cùng lúc → mở nhầm khóa.
- **How Detected:** (a) Chấm cùng một bài nhiều lần ra điểm khác nhau, tiêu chí lạ xuất hiện. (b) Test 2 đơn cùng giá đồng thời: hệ thống khớp nhầm.
- **Corrective Action:** (a) Rubric-locked prompt + temperature=0, cấm bịa tiêu chí, clamp thang điểm. (b) Đối soát theo mã đơn duy nhất (COURSE+orderId) trong nội dung CK, không theo tiền; đơn không khớp mã → manual review (commit 0269eb3).

### Hallucination Types Reference

| Type | Definition | Example |
|---|---|---|
| Fabrication | AI tạo ra thông tin không tồn tại | Fake papers, fake APIs, fake data |
| Oversimplification | AI bỏ qua edge cases, exceptions | Code không handle array rỗng |
| Logic Error | AI đưa kết luận sai về 'best practice' | 'XGBoost always best' → Sai |
| Outdated Info | AI dùng thông tin cũ, không còn đúng | Old API syntax, deprecated methods |
| Context Misunderstanding | AI không hiểu đúng bối cảnh | Không biết business constraints |

---

## 4. Self-Assessment Checklist

> Kiểm tra kỹ trước khi nộp. MỖI ENTRY phải pass ≥4/5 tiêu chí dưới đây.

### A. KIỂM TRA CHẤT LƯỢNG MỖI ENTRY (Pass ≥4/5)

| # | Tiêu chí | Pass? | Note |
|---|---|---|---|
| 1 | Prompt này ảnh hưởng đến quyết định quan trọng trong project? | ☑ | 12/12 entries là DECISION hoặc PROBLEM-SOLVING tầm cao |
| 2 | Nếu không có prompt này, project có thay đổi về architecture/design? | ☑ | Entry 002: Unit layer; Entry 005: security fix; Entry 009: is_sequential flag |
| 3 | Tôi có thể giải thích lý do chọn/không chọn gợi ý của AI? | ☑ | Mỗi entry có Decision rõ ràng với lý do accept/reject/modify AI output |
| 4 | Có minh chứng cụ thể (code, metrics, comparison)? | ☑ | 12/12 entries có commit hash và file list cụ thể |
| 5 | Prompt này phản ánh tư duy phản biện, không chỉ copy AI? | ☑ | Mọi entry có Critical Thinking chỉ ra vấn đề với AI output |

### B. KIỂM TRA TỔNG THỂ LOG

| # | Tiêu chí | Pass? | Current Value |
|---|---|---|---|
| 1 | Số lượng entries nằm trong range (min-max)? | ☑ | 21 entries (~13% của ~160 total prompts) |
| 2 | Mỗi DTC component có ít nhất 1 core prompt? | ☑ | Decomposition:6, Pattern Recognition:5, Abstraction:5, Algorithms:5 |
| 3 | Đã phát hiện ≥ số lượng hallucination yêu cầu? | ☑ | 6 hallucinations (≥3 yêu cầu cho Project) |
| 4 | Mỗi entry đều có Human Delta đầy đủ (4 câu hỏi)? | ☑ | Critical Thinking + Contextualization + Creative Synthesis + Decision đủ 21/21 |
| 5 | Có evidence cho ≥70% entries? | ☑ | 21/21 entries (100%) có commit hash + files |

> **⚠️ LƯU Ý QUAN TRỌNG:**
>
> - Nếu entry KHÔNG pass ≥4/5 tiêu chí → LOẠI BỎ, không ghi vào Log
> - Nếu FAIL ≥2 tiêu chí tổng thể → AI Reflection = 0 điểm (mất 30%)

### C. CHUẨN BỊ CHO ORAL VIVAS (Q&A)

Giảng viên sẽ hỏi ngẫu nhiên về 3-5 entries. Tự hỏi bản thân:

| Entry # | Tôi có thể giải thích tại sao chọn approach này? | Tôi có nhớ AI response? | Tôi có evidence? |
|---|---|---|---|
| 001 | Có — AI thiếu thumbnail upload, tôi thêm Supabase Storage upload | Có — DataTable + CreateEditModal + DeleteConfirm | Commit 20d5bbc, AdminCourses.jsx +564 lines |
| 002 | Có — AI propose flat Course→Lesson, tôi thêm Unit layer giữa | Có — ManageCourseContent skeleton với sidebar 6 tabs | Commit 9f0529a, ManageCourseContent.jsx +630 lines |
| 003 | Có — 4 components, code lặp nhưng chấp nhận vì deadline sprint | Có — 4 file AdminLesson*.jsx mỗi ~300-580 lines | Commit 916fda2, 4 files +1861 lines |
| 005 | Có — AI bỏ sót WHERE created_by trong UPDATE/DELETE → security bug | Có — teacherQuestionBankController.js, questionGen.js | Commit e3f1755, patch ownership check |
| 007 | Có — AI dùng toString() compare multiple choice → order-dependent bug | Có — quizController fix + Quiz.jsx +155 lines | Commit 51e5806, compareAnswers() function |
| 008 | Có — AI refactor xóa nhầm empty state → crash course rỗng | Có — ManageCourseContent.jsx −549 lines | Commit fc676ba, restore null-check |
| 010 | Có — AI suggest giữ cả 2 trang, tôi reject vì AdminLessons không có UC nào | Có — AI recommend cross-link, tôi chọn xóa hẳn | Commit 6448e17, −303 lines |
| 012 | Có — AI rate XSS "low" vì admin role, tôi escalate vì stored XSS ảnh hưởng student | Có — 3 issues, sanitize YouTube URL regex | Commit e90b383 + fc94097 |
| 013 | Có — AI cho mọi user review, tôi gate theo enrollment active | Có — enrollment/review controllers, CourseCard/Stars | Commit 3829165 |
| 014 | Có — shared UnitEditPage nhưng phải parametrize endpoint theo role | Có — UnitEditPage 627 lines, TeacherCourseContent | Commit bea717b |
| 015 | Có — debounce violation thay vì đếm raw event, tránh auto-submit oan | Có — useFullscreenLockdown hook | Commit c59c532 |
| 016 | Có — pagination theo thẻ + lưới tọa độ tuyệt đối, không phải DPI | Có — WorksheetPreview, kanjiWorksheet.js | Commit f90d5f4 + 0fb8a54 |
| 018 | Có — private bucket + signed URL cho video course trả phí, chống rò rỉ | Có — upload endpoint + AdminLessonVideo toggle | Commit 6f2291f |
| 019 | Có — whitelist field + fallback, chặn AI bịa cột khi import | Có — fileImportParser, ImportFileModal | Commit 7b167d1 |
| 020 | Có — đối soát theo mã đơn (không theo tiền) + AI grading temp=0 | Có — coursePaymentService, paymentMatchingService | Commit 0269eb3 |
| 021 | Có — gate theo best attempt, không phải last attempt | Có — passThreshold service, PassThresholdField | Commit a64fb30 |

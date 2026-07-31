# AI AUDIT LOG

> Nguồn: nhật ký sử dụng AI trong quá trình phát triển các module trên branch `Quyen` (Kizuna Nihongo). Cấu trúc theo mẫu `Format_AI_Auditlog.md`.

---

## 1. Metadata & Summary

### Student Information

| Trường | Giá trị |
|---|---|
| Student Name: | ⟨Điền Họ Tên⟩ |
| Student ID: | ⟨Điền MSSV⟩ |
| Course: | SWP391 |
| Assignment: | Kizuna Nihongo — Từ điển Nhật-Việt, Luyện đọc báo, Flashcard và Thi thử JLPT (mock-exam) |

### AI Usage Summary

| Chỉ số | Giá trị | Ghi chú |
|---|---|---|
| Total Prompts Used (all AI tools): | 178 |  |
| Core Prompts Logged: | 20 |  |
| Selection Ratio: | 11.24% | Should be 10-20% |
| Hallucination Detected: | 6 |  |

### AI Tools Used

| AI Tool | Purpose | Frequency | Main Value |
|---|---|---|---|
| Claude (Anthropic) | Kiến trúc module, thiết kế schema, review logic bảo mật | High | Phân tích trade-off, edge case và security |
| ChatGPT | Sinh boilerplate React/Express, prompt engineering cho sinh đề JLPT | High | Tạo nhanh CRUD, component và prompt template |
| GitHub Copilot | Inline completion khi code lặp | High | Tăng tốc coding lặp lại |

### Core Prompts Distribution by DTC Component

| DTC Component | Number of Prompts | Required (Min) |
|---|---|---|
| Decomposition | 5 | ≥ 1 |
| Pattern Recognition | 4 | ≥ 1 |
| Abstraction | 5 | ≥ 1 |
| Algorithms | 6 | ≥ 1 |

---

## 2. Detailed Audit Log

> INSTRUCTIONS: Chỉ ghi CORE PROMPTS (Decision/Problem-Solving/Verification). Mỗi entry phải trả lời đầy đủ 4 câu hỏi trong Human Delta.

### Entry #001 — DECISION · Decomposition

**Problem / Context**

Nền tảng chưa có từ điển tra cứu tiếng Nhật. Cần xây dựng chức năng tra từ Nhật-Việt: nhập kana/kanji/romaji/tiếng Việt đều tra được, kèm nghĩa, ví dụ, cách đọc — và một pipeline import dữ liệu từ nguồn mở (JMdict...) vào Supabase.

**Prompt to AI**

Tôi cần xây chức năng từ điển Nhật-Việt cho Kizuna Nihongo (Express + Supabase). Yêu cầu: 1) Schema riêng `dictionary_module` gồm bảng entries (kanji, kana, romaji, jlpt_level), senses (nghĩa), examples. 2) API GET /api/dictionary/search hỗ trợ tra bằng kana, kanji, romaji, và tiếng Việt (theo nghĩa). 3) Bộ script import: tải nguồn JMdict, sinh furigana, dịch nghĩa sang tiếng Việt, build index JLPT và related words. Hãy thiết kế schema và dựng dictionaryController + các script import.

**AI Response (Summary)**

AI sinh `dictionaryController.js` (~176 dòng) với `search`/`getOne`, migration schema `dictionary_module`, và bộ script trong `scripts/dictionary-import/` (download-sources, generate-furigana, translate-senses, import-entries/examples/kanji-readings, build-jlpt-index, build-related-words, run-all). Search phân nhánh theo loại ký tự đầu vào (kana/kanji vs romaji vs tiếng Việt).

**Human Delta & Reflection**

Critical Thinking: AI gộp toàn bộ pipeline import vào một script chạy tuần tự, không tách bước — nếu bước dịch nghĩa (gọi AI) lỗi giữa chừng thì phải chạy lại từ đầu, tốn thời gian và quota dịch.
Contextualization: Import từ điển là quá trình nặng, nhiều nghìn entry; mỗi bước (tải nguồn, furigana, dịch, import) độc lập và có thể fail riêng.
Creative Synthesis: Tách pipeline thành các script rời có thể chạy độc lập + một `run-all.js` điều phối; mỗi bước idempotent để chạy lại chỉ phần lỗi, không phải toàn bộ.
Decision: Giữ kiến trúc search AI đề xuất (phân nhánh theo ký tự) nhưng tái tổ chức pipeline import theo bước rời — quyết định về khả năng vận hành/bảo trì dữ liệu, AI mặc định gộp một khối.

**Evidence**

Commit: 2e12bd5
Files:
- backend/controllers/dictionaryController.js (+176)
- backend/scripts/dictionary-import/* (10 script)
- database/schema.sql (+130), database/migrate.sql (+214)
Reason: Chức năng tra từ điển Nhật-Việt + pipeline import theo bước.

---

### Entry #002 — PROBLEM-SOLVING · Algorithms

**Problem / Context**

Search từ điển bị 500 khi người dùng gõ ký tự đặc biệt, và phân trang nhận `page`/`limit` tùy ý từ query gây lệch kết quả / tải quá nhiều.

**Prompt to AI**

Search từ điển của tôi thỉnh thoảng trả 500 khi gõ một số ký tự, và tham số page/limit truyền vào không được kiểm soát. Query dùng PostgREST `.or('kana.ilike.${term}%,kanji.ilike.${term}%')`. Hãy giúp tôi làm search ổn định hơn và chuẩn hóa phân trang.

**AI Response (Summary)**

AI đề xuất bọc try/catch, ép kiểu `Number(page)`/`Number(limit)`, và giữ nguyên chuỗi `.or()` như cũ — cho rằng lỗi 500 là do dữ liệu chứ không phải cú pháp filter.

**Human Delta & Reflection**

Critical Thinking: Nguyên nhân gốc không phải try/catch — mà là chuỗi truyền thẳng vào `.or()` của PostgREST: nếu từ khóa chứa dấu `,` `(` `)` hoặc `"` sẽ phá vỡ cú pháp filter → 500. AI bỏ qua đúng chỗ nguy hiểm nhất (một dạng injection/parse-break).
Contextualization: Người học gõ đủ loại ký tự; input đi thẳng vào cú pháp filter là lỗ hổng thật, không thể chỉ "bắt lỗi rồi thôi".
Creative Synthesis: Viết `escapeOrPattern()` bọc giá trị trong nháy kép và escape `\` `"` trước khi đưa vào `.or()`; đồng thời clamp phân trang: `page = max(1, ...)`, `limit ∈ [1, 50]` để chặn tải quá lớn. Áp cho cả nhánh kana/kanji và romaji.
Decision: Escape input filter + clamp phân trang thay vì chỉ try/catch — sửa gốc rễ ở điểm nhập liệu; AI xử lý bề mặt (ép kiểu) trong khi vấn đề là parse-break cú pháp filter.

**Evidence**

Commit: 7d36100
Files:
- backend/controllers/dictionaryController.js (+18 −9)
Reason: Escape ký tự đặc biệt trong `.or()` + clamp phân trang search từ điển. HALLUCINATION CASE #2.

---

### Entry #003 — PROBLEM-SOLVING · Algorithms

**Problem / Context**

Trang chi tiết một từ (getOne) load chậm vì phải truy vấn nhiều bảng liên quan (senses, examples, kanji readings, related words) theo kiểu tuần tự.

**Prompt to AI**

Endpoint getOne của từ điển đang gọi tuần tự nhiều query để lấy nghĩa, ví dụ, cách đọc kanji và từ liên quan cho một entry. Trang chi tiết load chậm. Hãy tối ưu.

**AI Response (Summary)**

AI đề xuất gộp các truy vấn bằng `Promise.all` để chạy song song, giữ nguyên logic từng query. Sinh lại `getOne` với các nhánh fetch độc lập được await cùng lúc.

**Human Delta & Reflection**

Critical Thinking: Approach song song hóa đúng hướng, nhưng bản AI đưa ra gộp cả các query PHỤ THUỘC nhau vào một `Promise.all` (ví dụ related words cần entry_id lấy từ query trước) — nếu chạy song song sẽ dùng dữ liệu chưa có.
Contextualization: Chỉ các truy vấn thực sự độc lập (senses, examples, kanji readings của cùng entry_id đã biết) mới song song hóa được; phần phụ thuộc phải giữ tuần tự.
Creative Synthesis: Chia 2 tầng — tầng 1 lấy entry (có id), tầng 2 `Promise.all` các query độc lập dùng id đó; giữ related words ở nhánh cần dữ liệu tầng trước.
Decision: Song song hóa có kiểm soát phụ thuộc — nhận ý tưởng `Promise.all` của AI nhưng phân loại lại query độc lập/phụ thuộc trước khi gộp.

**Evidence**

Commit: 47dbd5e
Files:
- backend/controllers/dictionaryController.js (+59 −54)
Reason: Song song hóa getOne bằng Promise.all, tôn trọng thứ tự phụ thuộc.

---

### Entry #004 — DECISION · Decomposition

**Problem / Context**

Cần tính năng "Luyện đọc báo": admin sinh bài đọc tiếng Nhật (chia đoạn/segment có furigana) bằng AI, student đọc và luyện — kèm quản trị nội dung.

**Prompt to AI**

Tôi cần tính năng Luyện đọc báo cho Kizuna Nihongo. Admin: trang AdminNews tạo bài, dùng AI generate-segments để chia bài thành các đoạn có furigana. Student: NewsList xem danh sách, NewsReader đọc từng bài. Cần schema bài đọc + segments, newsController, và các trang React. Hãy dựng đầy đủ luồng admin + student.

**AI Response (Summary)**

AI sinh `newsController.js` (~189 dòng) với CRUD + endpoint AI generate-segments, schema news/segments, và các trang `AdminNews.jsx` (~475), `NewsList.jsx` (~195), `NewsReader.jsx` (~290). Segment lưu text kèm furigana.

**Human Delta & Reflection**

Critical Thinking: AI để AI-generate-segments trả về furigana dạng chuỗi thô, nhưng NewsReader render thẳng nên đôi khi hiện raw `[[漢字|かんじ]]`; đồng thời không tách rõ trạng thái bài (nháp/đã xuất bản) khiến bài chưa hoàn chỉnh vẫn hiện cho student.
Contextualization: Bài đọc là nội dung học chính; render sai furigana làm mất giá trị, và bài nháp lộ ra ngoài gây trải nghiệm lỗi.
Creative Synthesis: Chuẩn hóa render qua `FuriganaText`, và ở lần fix (d2064a8) rà lại luồng đọc báo + chatai, sửa NewsReader để parse đúng và ẩn bài chưa publish.
Decision: Tách rõ trạng thái xuất bản + chuẩn hóa render furigana — AI dựng đúng khung nhưng bỏ qua vòng đời nội dung và chất lượng hiển thị.

**Evidence**

Commit: 6f0b7b1 (feature), d2064a8 (fix)
Files:
- backend/controllers/newsController.js (+189)
- frontend/src/pages/admin/AdminNews.jsx (+475)
- frontend/src/pages/student/NewsList.jsx, NewsReader.jsx
Reason: Tính năng Luyện đọc báo (admin AI generate-segments + student reader).

---

### Entry #005 — DECISION · Pattern Recognition

**Problem / Context**

Khi đọc báo, student gặp từ lạ muốn tra ngay tại chỗ mà không rời trang. Cần popup tra từ khi bấm vào một từ trong bài — nhưng tiếng Nhật viết liền, không có dấu cách để biết ranh giới từ.

**Prompt to AI**

Trong NewsReader, khi student bấm vào một từ trong bài đọc tiếng Nhật, tôi muốn hiện popup tra nghĩa từ đó (dùng lại từ điển đã có). Vấn đề: tiếng Nhật không có dấu cách, làm sao tách đúng từ khi user bấm? Hãy làm WordLookupPopup + logic tách từ.

**AI Response (Summary)**

AI sinh `WordLookupPopup.jsx` (~144) và đề xuất tách từ ở frontend bằng cách lấy cụm ký tự liền quanh vị trí bấm (regex theo loại ký tự kana/kanji), rồi gọi API từ điển.

**Human Delta & Reflection**

Critical Thinking: Tách từ bằng regex "cụm ký tự cùng loại" ở frontend cho kết quả sai với từ ghép kanji+kana (vd 食べる → tách "食" rời "べる"), tra ra nghĩa sai hoặc không có.
Contextualization: Tách từ tiếng Nhật (word segmentation) là bài toán ngôn ngữ thực sự; heuristic ký tự không đủ, cần tokenizer.
Creative Synthesis: Thêm `jaTokenizer.js` ở backend làm tách từ đúng hơn, popup gọi tokenizer để xác định ranh giới từ trước khi tra — chuyển bài toán từ heuristic frontend sang tokenization server-side.
Decision: Dùng tokenizer thay heuristic ký tự — AI nhận diện đúng vấn đề nhưng chọn giải pháp gần đúng; tách từ chuẩn là điều kiện để tra đúng nghĩa.

**Evidence**

Commit: 671daef
Files:
- backend/services/jaTokenizer.js (+70)
- frontend/src/components/news/WordLookupPopup.jsx (+144)
- backend/controllers/newsController.js (+283)
Reason: Popup tra từ trong bài đọc + tokenizer tách từ tiếng Nhật.

---

### Entry #006 — DECISION · Abstraction

**Problem / Context**

Tính năng "News" thực chất là công cụ luyện đọc, không phải tin tức; tên gọi và cấu trúc route/controller theo "news" gây hiểu nhầm và không khớp domain học tập. Cần đổi thành "Reading" và mở cho teacher.

**Prompt to AI**

Tôi muốn đổi tính năng News thành Reading (luyện đọc) cho khớp bản chất học tập, đồng thời cho teacher dùng. Cần đổi tên newsController → readingController, route /api/news → /api/reading, các trang Admin/Student, và giữ nguyên dữ liệu cũ. Thêm modal thêm thẻ vào flashcard từ trong bài đọc.

**AI Response (Summary)**

AI thực hiện rename controller/route/trang từ news → reading, cập nhật layout admin/student/teacher, và sinh `AddCardsToFlashcardModal.jsx` (~141) để thêm từ trong bài đọc vào flashcard.

**Human Delta & Reflection**

Critical Thinking: AI đổi tên ở tầng code nhưng ban đầu không tính tới migration dữ liệu/tên bảng đang chạy production — nếu đổi cả tên bảng mà không migrate, dữ liệu bài đọc cũ mất tham chiếu.
Contextualization: Đây là rename trên tính năng đã có dữ liệu thật; abstraction "đổi tên" phải bảo toàn dữ liệu, không chỉ đổi symbol trong code.
Creative Synthesis: Giữ tương thích ở tầng DB qua migrate.sql (map/khai báo lại), chỉ đổi tên ở tầng API/UI; đồng thời tái dùng WordLookupPopup (move news→reading) thay vì viết lại.
Decision: Rename ở tầng trừu tượng phù hợp (API/UI) + bảo toàn dữ liệu ở DB — AI làm đúng phần đổi tên nhưng cần chặn rủi ro mất dữ liệu khi refactor tên.

**Evidence**

Commit: c342328
Files:
- backend/controllers/{newsController → readingController}.js
- backend/routes/api/reading.js, database/migrate.sql (+96)
- frontend/src/components/reading/AddCardsToFlashcardModal.jsx (+141)
Reason: Chuyển News → Reading + thêm thẻ vào flashcard từ bài đọc.

---

### Entry #007 — DECISION · Decomposition

**Problem / Context**

Student cần bộ công cụ flashcard cá nhân: tạo học phần (set), thư mục, thẻ hai mặt, và màn hình học lật thẻ — làm nền cho các chế độ học nâng cao sau này.

**Prompt to AI**

Tôi cần tính năng flashcard cho student trong Kizuna Nihongo: 1) CRUD học phần (set) và thư mục. 2) Thẻ hai mặt (front/back). 3) Màn hình học lật thẻ (FlashcardStudy). 4) Danh sách học phần, form tạo/sửa. Cần flashcardController + schema + các trang React.

**AI Response (Summary)**

AI sinh `flashcardController.js` (~388), schema flashcard sets/folders/cards, và các trang `Flashcards.jsx` (~277), `FlashcardSetForm.jsx` (~282), `FlashcardStudy.jsx` (~286), `FlashcardFolderDetail.jsx` (~202). CRUD đầy đủ + lật thẻ.

**Human Delta & Reflection**

Critical Thinking: AI dựng đủ CRUD nhưng FlashcardStudy chỉ lật thẻ, không xử lý trải nghiệm cuối bộ (thẻ cuối bấm tiếp → rơi vào trạng thái trống thay vì màn kết quả), và không có TTS phát âm — thiếu với công cụ học tiếng Nhật.
Contextualization: Giá trị flashcard tiếng Nhật nằm ở nghe phát âm và một vòng học có điểm kết thúc rõ ràng.
Creative Synthesis: Bổ sung text-to-speech đọc mặt thẻ (2794e86), và cho thẻ cuối chuyển sang màn kết quả (d69ff1f); giữ nguyên khung CRUD của AI.
Decision: Nhận khung CRUD từ AI, tự bổ sung TTS + vòng học có kết thúc — AI dựng cấu trúc nhưng bỏ trải nghiệm học đặc thù tiếng Nhật.

**Evidence**

Commit: 2cf2793 (feature), 2794e86 (TTS), d69ff1f (màn kết quả)
Files:
- backend/controllers/flashcardController.js (+388)
- frontend/src/pages/student/Flashcards.jsx, FlashcardSetForm.jsx, FlashcardStudy.jsx, FlashcardFolderDetail.jsx
Reason: Flashcard cho student (CRUD + học lật thẻ + TTS).

---

### Entry #008 — DECISION · Pattern Recognition

**Problem / Context**

Chỉ "lật thẻ" là chưa đủ để ghi nhớ. Cần thêm 2 chế độ học: Learn (học có phản hồi) và Test (kiểm tra), với tab chuyển chế độ và tiến độ tách riêng từng chế độ.

**Prompt to AI**

Flashcard hiện chỉ có chế độ lật thẻ. Tôi muốn thêm chế độ Learn và Test: tabs chuyển chế độ, Learn hỏi từng thẻ và ghi nhận đúng/sai, Test sinh đề trắc nghiệm từ các thẻ rồi chấm và hiện màn kết quả. Cần tách tiến độ giữa các chế độ. Hãy làm FlashcardLearn, FlashcardTest, FlashcardModeTabs.

**AI Response (Summary)**

AI sinh `FlashcardModeTabs.jsx`, `FlashcardLearn.jsx` (~489), `FlashcardTest.jsx` (~362), util `flashcardQuiz.js` sinh câu hỏi từ thẻ, và giao diện kết quả (d8e1450 mở rộng Test lên ~420).

**Human Delta & Reflection**

Critical Thinking: AI sinh câu trắc nghiệm bằng cách lấy đáp án nhiễu (distractor) ngẫu nhiên toàn cục — đôi khi chọn nhiễu trùng đáp án đúng hoặc quá dễ (nhiễu khác loại hẳn), làm bài test mất giá trị.
Contextualization: Distractor tốt phải cùng bộ thẻ và khác đáp án đúng; đây là điểm quyết định chất lượng bài kiểm tra.
Creative Synthesis: Sửa `flashcardQuiz.js`: lấy nhiễu trong cùng học phần, loại trùng đáp án đúng, đảm bảo đủ số lựa chọn; đồng thời tách tiến độ 2 chế độ (mode cards/learn) để không lẫn.
Decision: Kiểm soát sinh distractor + tách tiến độ theo chế độ — AI cho cơ chế nhưng thuật toán chọn nhiễu cần chặt để bài test có ý nghĩa.

**Evidence**

Commit: 81667e4 (Learn/Test + tabs), f2ef981 (tách tiến độ), d8e1450 (kết quả)
Files:
- frontend/src/pages/student/FlashcardLearn.jsx (+489), FlashcardTest.jsx
- frontend/src/components/flashcards/FlashcardModeTabs.jsx, frontend/src/lib/flashcardQuiz.js
Reason: Chế độ Learn/Test cho flashcard + sinh distractor cùng bộ thẻ.

---

### Entry #009 — PROBLEM-SOLVING · Algorithms

**Problem / Context**

Soạn/sửa học phần dài dễ mất dữ liệu nếu rời trang; cần cơ chế nháp (draft) tự lưu tạm và nút hoàn tác khi xóa nhầm học phần/thư mục.

**Prompt to AI**

Khi student soạn học phần flashcard, nếu lỡ rời trang sẽ mất công. Tôi muốn: 1) Tự lưu nháp (draft) học phần đang soạn để mở lại là còn. 2) Khi xóa học phần/thư mục thì có popup xác nhận + nút Hoàn tác (undo) trong vài giây. Hãy làm.

**AI Response (Summary)**

AI sinh `flashcardDrafts.js` lưu nháp (localStorage), popup xác nhận xóa, và cơ chế undo. Cập nhật FlashcardSetForm/FlashcardStudy/Flashcards để tích hợp draft + undo.

**Human Delta & Reflection**

Critical Thinking: AI làm undo bằng cách xóa DB ngay rồi "khôi phục lại nếu bấm undo" — nếu người dùng đóng tab trước khi hết thời gian undo thì dữ liệu đã mất thật, undo không cứu được.
Contextualization: Undo an toàn phải trì hoãn hành động phá hủy, không phá trước rồi hứa hoàn tác.
Creative Synthesis: Đổi sang soft-delete/trì hoãn: đánh dấu chờ xóa và chỉ commit xóa DB sau khi hết cửa sổ undo (hoặc rời trang có xác nhận); draft lưu tạm và flush khi lưu thật.
Decision: Trì hoãn hành động phá hủy thay vì xóa-rồi-khôi-phục — AI cho UX undo nhưng thứ tự thao tác gây mất dữ liệu ở edge case đóng tab.

**Evidence**

Commit: 86d03ab (draft + undo), 32773aa (popup delete)
Files:
- frontend/src/lib/flashcardDrafts.js (+24)
- frontend/src/pages/student/FlashcardSetForm.jsx, FlashcardStudy.jsx, Flashcards.jsx
Reason: Draft tự lưu + undo an toàn khi xóa học phần/thư mục.

---

### Entry #010 — DECISION · Abstraction

**Problem / Context**

Student soạn thẻ thường bí phần định nghĩa/nghĩa. Muốn có nút "AI gợi ý định nghĩa" ngay trong form — nhưng phải giới hạn để không lạm dụng gọi AI.

**Prompt to AI**

Trong FlashcardSetForm, tôi muốn nút AI gợi ý định nghĩa: student nhập từ, AI đề xuất nghĩa/định nghĩa để điền vào mặt sau thẻ. Cần endpoint AI + client helper + tích hợp vào form, và có giới hạn dùng (quota). Hãy làm.

**AI Response (Summary)**

AI thêm route trong `ai.js` (~60 dòng), `flashcardAi.js` client helper (~59), gắn nút gợi ý vào form + xử lý tràn chữ khi định nghĩa dài; dùng `quotaService`.

**Human Delta & Reflection**

Critical Thinking: AI đặt việc gọi AI gợi ý ngay trong controller/route flashcard, trộn logic AI với logic thẻ — khi sau này thêm AI cho Test cũng cần quota tương tự sẽ lặp lại; ngoài ra chưa chặn quota ở server, chỉ ẩn nút ở client.
Contextualization: Nhiều tính năng sẽ gọi AI (gợi ý định nghĩa, sinh bài test, sinh đề JLPT); nên trừu tượng hóa quota thành service dùng chung và enforce ở server.
Creative Synthesis: Đưa kiểm tra quota vào `quotaService` (server-side), client chỉ hiển thị; tách helper `flashcardAi.js` để phần gọi AI tách khỏi UI. Chuẩn bị nền cho AI test gen sau này.
Decision: Trừu tượng hóa quota thành service + enforce server-side — AI gắn tính năng đúng chỗ nhưng cần tách mối quan tâm và chặn lạm dụng ở server, không phó mặc client.

**Evidence**

Commit: 337554f
Files:
- backend/routes/api/ai.js (+60), backend/services/quotaService.js
- frontend/src/lib/flashcardAi.js (+59), FlashcardSetForm.jsx
Reason: AI gợi ý định nghĩa cho thẻ + quota server-side.

---

### Entry #011 — DECISION · Abstraction

**Problem / Context**

Bài kiểm tra flashcard cần chất lượng hơn (AI sinh câu) và kết quả phải lưu lại để theo dõi; đồng thời phải giới hạn 1 lần/ngày để tránh spam gọi AI. Chế độ "Học" cũ trùng vai trò, cần dọn.

**Prompt to AI**

Tôi muốn nâng bài kiểm tra flashcard: dùng AI sinh câu hỏi chất lượng hơn (service riêng), lưu kết quả bài test vào database để xem lại, đặt quota 1 lần/ngày, và bỏ chế độ "Học" (Learn) vì trùng với Test. Hãy tách service flashcardTestGen và cập nhật luồng.

**AI Response (Summary)**

AI sinh `flashcardTestGen.js` (~289), mở rộng `flashcardController.js` (+104) lưu kết quả, thêm quota, xóa `FlashcardLearn.jsx` (~503), cập nhật `FlashcardTest.jsx`. Cấu hình `ai.js` cho sinh câu.

**Human Delta & Reflection**

Critical Thinking: AI trả JSON câu hỏi nhưng không validate cứng schema — khi model trả thiếu trường hoặc thừa lựa chọn, bài test lưu vào DB bị hỏng; ngoài ra quota "1 lần/ngày" AI check theo giờ client, dễ lách bằng đổi giờ máy.
Contextualization: Câu hỏi lưu DB để xem lại nên phải đúng cấu trúc; quota phải tính theo mốc thời gian server.
Creative Synthesis: Validate output AI theo schema whitelist trước khi lưu (drop/bù trường thiếu), và tính quota theo ngày ở server (`quotaService`) thay vì tin client.
Decision: Validate schema AI + quota theo server-time — AI cho luồng đúng nhưng output AI và quota client là hai điểm không thể tin tuyệt đối.

**Evidence**

Commit: cd9f86e
Files:
- backend/services/flashcardTestGen.js (+289)
- backend/controllers/flashcardController.js (+104), backend/config/ai.js
- frontend/src/pages/student/FlashcardTest.jsx
Reason: Bài kiểm tra AI lưu DB + quota 1 lần/ngày, bỏ chế độ Học.

---

### Entry #012 — DECISION · Pattern Recognition

**Problem / Context**

Student tra từ ở từ điển hoặc đọc thấy từ trong bài muốn lưu nhanh vào flashcard, thay vì gõ lại thủ công. Pattern "chọn nội dung → thêm vào flashcard" lặp ở nhiều nơi (từ điển, bài đọc).

**Prompt to AI**

Ở trang từ điển (WordDetail) và trong bài đọc, tôi muốn nút "Lưu vào flashcard": mở modal chọn học phần đích (hoặc tạo mới) rồi thêm từ đang xem thành thẻ. Hãy làm AddToFlashcardModal cho từ điển và tái dùng cho bài đọc.

**AI Response (Summary)**

AI sinh `AddToFlashcardModal.jsx` (~197) cho từ điển và `AddCardsToFlashcardModal.jsx` cho bài đọc, thêm endpoint flashcard nhận card, map từ → thẻ (front=từ, back=nghĩa).

**Human Delta & Reflection**

Critical Thinking: AI map thẳng từ → thẻ với front=từ, back=nghĩa nhưng bỏ mất cách đọc (kana/furigana) và ví dụ đã có sẵn ở WordDetail — thẻ tạo ra thiếu dữ liệu học quan trọng nhất của tiếng Nhật.
Contextualization: Giá trị thẻ tiếng Nhật nằm ở cách đọc + ví dụ; đã có sẵn dữ liệu thì không nên bỏ.
Creative Synthesis: Map đầy đủ: front = từ + kana/furigana, back = nghĩa + ví dụ; hai modal (từ điển và bài đọc) dùng chung cấu trúc card để nhất quán.
Decision: Rich card mapping tái dùng chung — AI đơn giản hóa quá mức làm rơi field; đây là pattern lặp nên thống nhất một cấu trúc thẻ.

**Evidence**

Commit: d694e8a (từ điển), c342328 (bài đọc)
Files:
- frontend/src/components/dictionary/AddToFlashcardModal.jsx (+197)
- frontend/src/components/reading/AddCardsToFlashcardModal.jsx (+141)
- backend/controllers/flashcardController.js (+30)
Reason: Lưu từ vào flashcard từ từ điển/bài đọc với đầy đủ cách đọc + ví dụ.

---

### Entry #013 — DECISION · Algorithms

**Problem / Context**

Bắt đầu module lớn nhất: Thi thử JLPT. Cần schema và "bộ khung" chấm điểm/cấu trúc đề theo chuẩn JLPT (blueprint) trước khi làm CRUD và giao diện.

**Prompt to AI**

Tôi bắt đầu làm module thi thử JLPT cho Kizuna Nihongo. Cần: 1) Schema đề thi, câu hỏi, lượt làm (attempt). 2) Một module `jlptMock.js` mô tả blueprint từng cấp độ (N1-N5): các phần (từ vựng-ngữ pháp-đọc, nghe), số câu, và cách tính điểm. 3) Hàm chấm điểm. Hãy dựng schema migration + module blueprint/scoring.

**AI Response (Summary)**

AI sinh migration `013_mock_exams.sql` (~132) và `jlptMock.js` (~369) mô tả các phần theo cấp độ + hàm chấm. Bản đầu tính điểm theo phần trăm số câu đúng và pass nếu tổng ≥ ngưỡng %.

**Human Delta & Reflection**

Critical Thinking: JLPT KHÔNG chấm theo phần trăm số câu đúng: nó dùng điểm quy đổi (scaled score) theo phân mục, và điều kiện đậu gồm CẢ điểm tổng ≥ ngưỡng LẪN điểm từng phân mục ≥ điểm sàn (sectional pass). AI dùng % đơn giản → một người giỏi đọc nhưng liệt phần nghe vẫn "đậu" sai.
Contextualization: Đây là bài thi mô phỏng chuẩn JLPT; chấm sai chuẩn làm mất ý nghĩa luyện thi.
Creative Synthesis: Định nghĩa blueprint theo phân mục điểm (得点区分) với điểm tổng + sàn từng phần; hàm chấm kiểm tra đồng thời tổng ≥ ngưỡng và mỗi phần ≥ sàn mới đậu. Khóa cấu trúc đề theo blueprint (xem Entry #014).
Decision: Chấm theo scaled score + sectional pass thay vì % — AI dùng mô hình chấm sai bản chất JLPT; đây là logic cốt lõi của toàn module.

**Evidence**

Commit: 9fe9cef
Files:
- backend/migrations/013_mock_exams.sql (+132)
- backend/utils/jlptMock.js (+369)
Reason: Schema + blueprint/scoring JLPT theo phân mục điểm. HALLUCINATION CASE #1.

---

### Entry #014 — DECISION · Pattern Recognition

**Problem / Context**

Admin soạn đề tự do dễ tạo đề sai chuẩn (thừa/thiếu mondai, sai số câu từng phần). Cần khóa cấu trúc đề theo blueprint để mọi đề đều hợp lệ.

**Prompt to AI**

Admin đang soạn đề JLPT tự do nên hay tạo đề sai cấu trúc (sai số mondai, sai số câu mỗi phần). Tôi muốn khóa cấu trúc đề theo blueprint JLPT của từng cấp độ: editor tự dựng đúng khung mondai, admin chỉ điền nội dung. Hãy sửa AdminMockExamEditor + controller theo blueprint.

**AI Response (Summary)**

AI sửa `adminMockExamController.js` và `AdminMockExamEditor.jsx` để dựng khung theo blueprint trong `mockExamConstants.js`, cố định số mondai/câu theo cấp độ. Giảm mạnh code CRUD tự do (−184 dòng ở controller).

**Human Delta & Reflection**

Critical Thinking: AI khóa cứng hoàn toàn theo blueprint nhưng bỏ mất tính linh hoạt cần thiết: một số dạng mondai đọc hiểu có số câu thay đổi theo passage; khóa cứng tuyệt đối khiến không nhập được đề thực tế.
Contextualization: Blueprint JLPT cố định phần lớn nhưng có phần co giãn theo đoạn văn; cần khóa khung nhưng cho phép biến thiên trong giới hạn.
Creative Synthesis: Khóa số mondai và loại phần theo blueprint (không cho thêm/bớt phần), nhưng cho số câu trong mondai đọc co giãn theo passage trong ngưỡng hợp lệ; validate khi lưu.
Decision: Khóa khung + cho co giãn có kiểm soát — AI đúng hướng chuẩn hóa nhưng cứng nhắc quá mức; cần cân giữa đúng chuẩn và nhập được đề thật.

**Evidence**

Commit: 23683b8
Files:
- backend/controllers/adminMockExamController.js (+... −184)
- frontend/src/lib/mockExamConstants.js (+37), AdminMockExamEditor.jsx
Reason: Khóa cấu trúc đề theo blueprint JLPT (có co giãn phần đọc). HALLUCINATION CASE (xem #1, cùng chủ đề chuẩn JLPT).

---

### Entry #015 — DECISION · Decomposition

**Problem / Context**

Sau schema/blueprint, cần dựng luồng vận hành đầy đủ: admin CRUD đề + AI sinh câu nháp + import bank; và student làm bài + bảng xếp hạng + lịch sử/thống kê; kèm giao diện.

**Prompt to AI**

Tôi cần dựng luồng thi thử JLPT hoàn chỉnh: 1) Admin: CRUD đề, import ngân hàng câu, AI sinh câu để nhập nháp (adminMockExamController). 2) Student: làm bài, nộp, chấm, leaderboard, lịch sử + thống kê (mockExamController). 3) Frontend admin editor + các trang student (List/Detail/Room/Result/History). Hãy dựng backend + frontend.

**AI Response (Summary)**

AI sinh `adminMockExamController.js` (~652), `mockExamController.js` (~569), routes, và loạt trang React (AdminMockExamEditor ~475, AdminMockExams ~146, MockExamList/Detail/History/Result, QuestionCard, AudioPlayer, LeaderboardTable). AI sinh câu qua `questionGen.js`.

**Human Delta & Reflection**

Critical Thinking: AI để leaderboard xếp hạng theo điểm thô và không phân biệt lần làm; một student làm nhiều lần chiếm hết top. Ngoài ra lịch sử + trang thống kê tách rời gây trùng dữ liệu.
Contextualization: Bảng xếp hạng công bằng phải lấy điểm tốt nhất/lần đầu mỗi người; lịch sử nên gộp, không cần trang thống kê riêng.
Creative Synthesis: Xếp hạng theo best score mỗi user (unique theo user), và gộp lịch sử bài làm, bỏ trang thống kê thừa (ac561da).
Decision: Leaderboard theo best-per-user + gộp lịch sử — AI dựng đủ luồng nhưng quy tắc xếp hạng và bố cục dữ liệu cần chỉnh cho công bằng và gọn.

**Evidence**

Commit: cc92462 (admin), 6809cbd (student), b0528c6 (frontend), ac561da (gộp lịch sử)
Files:
- backend/controllers/adminMockExamController.js (+652), mockExamController.js (+569)
- frontend/src/pages/admin/AdminMockExamEditor.jsx, frontend/src/pages/student/MockExam*.jsx
Reason: Luồng thi thử JLPT admin + student + leaderboard/lịch sử.

---

### Entry #016 — PROBLEM-SOLVING · Algorithms

**Problem / Context**

AI sinh câu hỏi JLPT hàng loạt hay bị trùng nội dung và khó sửa từng câu; cần chống trùng, sửa nháp inline và regen từng câu riêng lẻ.

**Prompt to AI**

Tính năng AI sinh câu JLPT của tôi hay sinh câu trùng nhau khi tạo nhiều câu một lượt, và muốn sửa 1 câu phải sinh lại cả cụm. Tôi cần: chống trùng câu, cho sửa inline bản nháp, và regen từng câu độc lập. Hãy tách logic sinh câu ra module riêng và cải thiện.

**AI Response (Summary)**

AI tách `jlptQuestionGen.js` (~265) khỏi `questionGen.js`, thêm cơ chế regen từng câu và sửa inline; prompt yêu cầu "đừng lặp câu".

**Human Delta & Reflection**

Critical Thinking: Chỉ dặn prompt "đừng lặp" không đủ — model vẫn sinh câu na ná (cùng từ vựng, cùng dạng) khi gọi nhiều lần độc lập vì không biết các câu đã có. AI ảo tưởng rằng chỉ thị prompt là đủ chống trùng.
Contextualization: Chống trùng cần state: model phải biết các câu/từ đã dùng để tránh; không thể phó mặc chỉ thị văn bản.
Creative Synthesis: Truyền danh sách câu/khóa đã sinh vào prompt làm ràng buộc loại trừ, và dedup ở server (so khớp nội dung/từ khóa) trước khi lưu; regen câu đơn lẻ cũng gửi kèm ngữ cảnh câu hiện có.
Decision: Chống trùng bằng state + dedup server, không chỉ prompt — AI tin chỉ thị prompt là đủ; thực tế phải cung cấp ngữ cảnh và kiểm tra lại đầu ra.

**Evidence**

Commit: 3afea48
Files:
- backend/utils/jlptQuestionGen.js (+265), questionGen.js (−158)
- backend/controllers/adminMockExamController.js (+56), AdminMockExamEditor.jsx (+163)
Reason: AI sinh câu JLPT: chống trùng (state + dedup), regen/sửa từng câu. HALLUCINATION CASE #3.

---

### Entry #017 — PROBLEM-SOLVING · Pattern Recognition

**Problem / Context**

AI sinh câu JLPT nhưng phần giải thích (explanation) và bản dịch đôi khi viết bằng tiếng Anh hoặc tiếng Nhật, không phải tiếng Việt — sai đối tượng người học Việt.

**Prompt to AI**

Khi AI sinh câu JLPT, phần explanation và bản dịch cần luôn viết bằng tiếng Việt cho người học Việt Nam. Hiện tại đôi khi ra tiếng Anh/Nhật. Hãy sửa prompt/luồng để explanation và bản dịch luôn là tiếng Việt.

**AI Response (Summary)**

AI thêm câu chỉ thị "viết bằng tiếng Việt" vào prompt và cho rằng như vậy là đủ để mọi output ra tiếng Việt.

**Human Delta & Reflection**

Critical Thinking: Chỉ thêm một câu "viết tiếng Việt" vẫn để lọt: với câu thuần ngữ pháp/từ vựng Nhật, model dễ trượt về tiếng Nhật/Anh cho phần giải thích, đặc biệt khi ví dụ toàn tiếng Nhật ở ngữ cảnh trước.
Contextualization: Đối tượng là người Việt; explanation/bản dịch tiếng Anh-Nhật làm mất tác dụng hỗ trợ hiểu bài.
Creative Synthesis: Ràng buộc rõ trong prompt cho TỪNG trường (explanation_vi, translation_vi) phải là tiếng Việt, tách bản dịch câu hỏi và bản dịch từng lựa chọn (bf7d630), và kiểm tra ngôn ngữ đầu ra ở server, regen nếu lệch.
Decision: Ràng buộc theo từng trường + verify ngôn ngữ đầu ra — một chỉ thị chung không đủ; phải khóa yêu cầu ngôn ngữ ở cấp trường và kiểm tra lại.

**Evidence**

Commit: e6b5cc2 (explanation/dịch tiếng Việt), bf7d630 (tách dịch câu/lựa chọn), 256c928 (bản dịch câu hỏi)
Files:
- backend/utils/questionGen.js, jlptMock.js
- frontend/src/components/admin/mock/QuestionCard.jsx, MockExamReview.jsx
Reason: AI explanation/bản dịch luôn tiếng Việt (ràng buộc theo trường + verify). HALLUCINATION CASE #4.

---

### Entry #018 — PROBLEM-SOLVING · Abstraction

**Problem / Context**

Output AI đôi khi chèn thẻ HTML (vd `<u>`) vào nội dung câu hỏi; khi render lên giao diện làm hỏng hiển thị hoặc tạo rủi ro chèn HTML. Cần chuẩn hóa/sanitize output AI.

**Prompt to AI**

AI sinh câu JLPT thỉnh thoảng trả nội dung có thẻ HTML như `<u>...</u>` (gạch chân chỗ trống). Khi hiển thị lên trang làm vỡ layout. Tôi muốn xử lý sạch output AI và cấm HTML trong prompt. Hãy làm.

**AI Response (Summary)**

AI thêm chỉ thị "không dùng HTML" vào prompt và bỏ qua bước làm sạch, cho rằng cấm trong prompt là đủ.

**Human Delta & Reflection**

Critical Thinking: Cấm HTML trong prompt không đảm bảo — model vẫn trả `<u>` để biểu thị chỗ điền; nếu render thẳng thì vừa vỡ layout vừa là điểm chèn HTML không kiểm soát (rủi ro như XSS dạng stored).
Contextualization: Nội dung này hiển thị cho student; mọi output AI đưa vào DOM phải coi là không đáng tin và phải làm sạch.
Creative Synthesis: Sanitize ở server: chuyển `<u>...</u>` thành ký hiệu chỗ trống chuẩn (`＿…＿`), loại bỏ các thẻ HTML khác trong output AI, đồng thời vẫn cấm HTML trong prompt như lớp phòng thủ thứ hai.
Decision: Sanitize output AI ở điểm nhận, không chỉ cấm trong prompt — trừu tượng hóa nguyên tắc "không tin output AI khi đưa vào giao diện"; đây là defense-in-depth.

**Evidence**

Commit: ed231eb
Files:
- backend/utils/questionGen.js (+22 −...)
- frontend/src/components/mockexam/AudioPlayer.jsx, MockExamRoom.jsx
Reason: Sanitize thẻ HTML trong output AI (`<u>`→`＿…＿`) + cấm HTML trong prompt. HALLUCINATION CASE #5.

---

### Entry #019 — DECISION · Algorithms

**Problem / Context**

Phần Nghe (聴解) của đề JLPT cần audio. Không thể thu âm thủ công cho mọi câu; cần sinh audio từ transcript bằng server-side TTS tiếng Nhật, và chuyển audio về từng câu thay vì cả phần.

**Prompt to AI**

Phần nghe của đề JLPT cần audio. Tôi muốn: 1) Server-side TTS sinh audio tiếng Nhật từ transcript của từng câu nghe. 2) Audio/transcript gắn theo TỪNG câu (không phải cả phần), để làm bài nghe từng câu. Hãy làm util TTS + đổi mô hình audio về per-question.

**AI Response (Summary)**

AI sinh `ttsJa.js` (~92), tích hợp sinh audio trong admin editor, migration chuyển listening về per-question (`023_mock_listening_per_question.sql`), cập nhật QuestionCard/room/review.

**Human Delta & Reflection**

Critical Thinking: AI sinh TTS mỗi lần lưu câu, kể cả khi transcript không đổi — tốn thời gian và chi phí TTS lặp lại; đồng thời không xử lý trường hợp transcript rỗng (sinh audio rỗng).
Contextualization: Admin sửa câu nhiều lần; TTS chỉ nên chạy khi transcript thật sự thay đổi; audio là dữ liệu tốn kém, cần cache theo nội dung.
Creative Synthesis: Chỉ sinh TTS khi transcript thay đổi (so nội dung), bỏ qua khi rỗng; audio lưu và tái dùng; cho phép upload audio thật thay thế TTS. Autosave transcript onBlur (7b521c1).
Decision: TTS theo thay đổi nội dung (không sinh lặp) + fallback upload — AI cho cơ chế nhưng thiếu tối ưu chi phí và edge case transcript rỗng.

**Evidence**

Commit: ee07187 (server-TTS), 338c42a (audio per-question)
Files:
- backend/utils/ttsJa.js (+92), adminMockExamController.js
- backend/migrations/023_mock_listening_per_question.sql
- frontend/src/components/admin/mock/QuestionCard.jsx
Reason: Server-TTS phần nghe + audio/transcript theo từng câu.

---

### Entry #020 — DECISION · Abstraction

**Problem / Context**

Các bảng mock_* nằm lẫn trong schema public gây rối và khó phân quyền; cần tách toàn bộ module thi thử JLPT (đề, câu, attempt, bank...) sang schema riêng `jlpt_module`, kèm ngân hàng đề + import Excel.

**Prompt to AI**

Module thi thử JLPT đang để 6 bảng mock_* trong schema public, lẫn với các bảng khác. Tôi muốn: 1) Chuyển 6 bảng sang schema riêng `jlpt_module`. 2) Thêm ngân hàng câu JLPT riêng (`jlpt_module.jlpt_bank_*`) + trang admin quản lý bank. 3) Import Excel/CSV vào bank (template + preview + commit). Hãy dựng migration + controller + cập nhật mọi truy vấn dùng schema mới.

**AI Response (Summary)**

AI sinh migration `024_jlpt_module_schema.sql`, chuyển truy vấn sang `supabaseAdmin.schema('jlpt_module')` trong các controller, sinh `jlptBankController.js` (~292), `AdminJlptBank.jsx` (~650), và bộ import `jlptBankImport.js` với template/preview.

**Human Delta & Reflection**

Critical Thinking: AI đổi phần lớn truy vấn sang schema mới nhưng BỎ SÓT một số nơi vẫn trỏ `from('mock_...')` ở schema public (đặc biệt service phụ như examGuard) — chạy sẽ lỗi hoặc tệ hơn là "không thấy dữ liệu" mà không báo lỗi rõ.
Contextualization: Đổi schema là thay đổi xuyên suốt; sót một chỗ trỏ schema cũ gây bug ngầm khó thấy.
Creative Synthesis: Rà toàn bộ nơi truy cập bảng mock_*, định nghĩa một `jlptDb = supabaseAdmin.schema('jlpt_module')` dùng lại; sau đó vẫn phát hiện examGuard bị sót và sửa riêng (Entry #... / commit 6ec06eb).
Decision: Tập trung hóa truy cập schema qua một client `jlpt_module` + rà soát toàn diện — AI làm phần lớn nhưng đổi schema kiểu này luôn phải audit từng điểm truy cập, không tin "đã đổi hết".

**Evidence**

Commit: cd67652 (schema move), ad6f1a1 (bank), a72f146/1c2430b/7887318/f13e7e3 (import Excel)
Files:
- backend/migrations/024_jlpt_module_schema.sql, 026_jlpt_bank.sql
- backend/controllers/jlptBankController.js (+292), backend/utils/jlptBankImport.js
- frontend/src/pages/admin/AdminJlptBank.jsx (+650)
Reason: Tách schema jlpt_module + ngân hàng đề + import Excel/CSV.

---

## 3. Hallucination Detection Log

> MỖI PROJECT PHẢI PHÁT HIỆN ÍT NHẤT: Lab (≥1), Assignment (≥2), Project (≥3) cases hallucination

### Entry #013 — Logic Error

- **AI's Claim:** AI sinh module chấm điểm JLPT và khẳng định "tính điểm theo phần trăm số câu đúng, đậu nếu tổng ≥ ngưỡng %" là đúng chuẩn.
- **Reality Check:** JLPT dùng điểm quy đổi (scaled score) theo phân mục và yêu cầu đậu gồm CẢ điểm tổng ≥ ngưỡng LẪN mỗi phân mục ≥ điểm sàn. Chấm theo % đơn thuần khiến người liệt một phần (vd nghe) vẫn "đậu" sai.
- **How Detected:** Đối chiếu với quy chế chấm JLPT thật; dựng ca test một thí sinh điểm đọc cao nhưng nghe = 0 → hệ thống báo "đậu", trái quy chế.
- **Corrective Action:** Định nghĩa blueprint theo phân mục điểm với điểm tổng + sàn từng phần; hàm chấm kiểm tra đồng thời tổng ≥ ngưỡng và mỗi phần ≥ sàn (commit 9fe9cef, blueprint khóa ở 23683b8).

### Entry #002 — Oversimplification

- **AI's Claim:** AI cho rằng lỗi 500 ở search từ điển do dữ liệu, chỉ cần bọc try/catch và ép kiểu page/limit là ổn.
- **Reality Check:** Nguyên nhân là chuỗi truyền thẳng vào `.or()` của PostgREST: ký tự `,` `(` `)` `"` trong từ khóa phá vỡ cú pháp filter → 500 (parse-break/injection). Try/catch không sửa gốc.
- **How Detected:** Gõ từ khóa chứa dấu phẩy/ngoặc vào ô tìm kiếm → 500 lặp lại; xác định do cú pháp `.or()` chứ không phải dữ liệu.
- **Corrective Action:** Viết `escapeOrPattern()` bọc nháy kép + escape `\` `"` trước khi đưa vào `.or()`, và clamp phân trang `page≥1`, `limit∈[1,50]` (commit 7d36100).

### Entry #016 — Oversimplification

- **AI's Claim:** AI khẳng định chỉ cần thêm chỉ thị "đừng lặp câu" vào prompt là AI sẽ không sinh câu JLPT trùng nhau.
- **Reality Check:** Khi gọi sinh nhiều câu độc lập, model không biết các câu đã có nên vẫn sinh câu na ná (cùng từ vựng/dạng). Chỉ thị prompt không tạo được ràng buộc chống trùng thực sự.
- **How Detected:** Sinh một loạt câu rồi rà: nhiều câu trùng từ khóa/cấu trúc; regen câu đơn cũng ra câu giống câu cũ.
- **Corrective Action:** Truyền danh sách câu/từ khóa đã sinh vào prompt làm ràng buộc loại trừ + dedup ở server trước khi lưu (commit 3afea48).

### Entry #017 — Context Misunderstanding

- **AI's Claim:** AI cho rằng thêm một câu "viết bằng tiếng Việt" vào prompt là đủ để explanation/bản dịch luôn ra tiếng Việt.
- **Reality Check:** Với câu thuần ngữ pháp/từ vựng Nhật, model vẫn trượt về tiếng Nhật/Anh cho phần giải thích do ngữ cảnh xung quanh toàn tiếng Nhật. AI không nắm đối tượng người học là người Việt cần giải thích tiếng Việt tuyệt đối.
- **How Detected:** Duyệt câu AI sinh: một số explanation/bản dịch ra tiếng Anh hoặc Nhật lẫn lộn.
- **Corrective Action:** Ràng buộc ngôn ngữ theo từng trường (explanation_vi, translation_vi), tách dịch câu hỏi và dịch từng lựa chọn, verify ngôn ngữ output ở server và regen nếu lệch (commit e6b5cc2, bf7d630).

### Entry #018 — Fabrication

- **AI's Claim:** AI khẳng định cấm HTML trong prompt là đủ để output câu hỏi không chứa thẻ HTML.
- **Reality Check:** Model vẫn tự chèn thẻ `<u>...</u>` (biểu thị chỗ điền) vào nội dung; render thẳng làm vỡ layout và tạo điểm chèn HTML không kiểm soát (rủi ro stored XSS).
- **How Detected:** Hiển thị câu AI sinh lên giao diện làm bài → thấy gạch chân/HTML lạ, layout vỡ; kiểm tra output thấy thẻ `<u>`.
- **Corrective Action:** Sanitize output AI ở server (`<u>`→`＿…＿`, loại thẻ HTML khác) trước khi lưu/hiển thị, giữ lệnh cấm HTML trong prompt như lớp phòng thủ thứ hai (commit ed231eb).

### Entry #020 — Logic Error

- **AI's Claim:** Khi tách 6 bảng mock_* sang schema `jlpt_module`, AI khẳng định "đã chuyển hết mọi truy vấn sang schema mới".
- **Reality Check:** Còn sót nơi trỏ bảng public (điển hình `examGuard.js` vẫn `from('mock_attempts')` schema public); và query lỗi bị bỏ qua âm thầm vì supabase-js không throw → trợ lý AI không bị khóa khi đang thi (fail-open bảo mật).
- **How Detected:** Rà toàn bộ điểm truy cập mock_* sau khi đổi schema; test mở /chat khi đang có bài thi in_progress → AI vẫn trả lời (đáng lẽ phải bị khóa).
- **Corrective Action:** Trỏ examGuard sang `supabaseAdmin.schema('jlpt_module')` và kiểm tra `error` rồi `throw` để caller không fail-open âm thầm; tập trung hóa client schema dùng lại (commit 6ec06eb).

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
| 1 | Prompt này ảnh hưởng đến quyết định quan trọng trong project? | ☑ | 20/20 entries là DECISION/PROBLEM-SOLVING tầm cao |
| 2 | Nếu không có prompt này, project có thay đổi về architecture/design? | ☑ | Entry 013: scoring JLPT; Entry 020: tách schema; Entry 002: escape filter |
| 3 | Tôi có thể giải thích lý do chọn/không chọn gợi ý của AI? | ☑ | Mỗi entry có Decision rõ ràng với lý do accept/reject/modify AI output |
| 4 | Có minh chứng cụ thể (code, metrics, comparison)? | ☑ | 20/20 entries có commit hash và file list cụ thể |
| 5 | Prompt này phản ánh tư duy phản biện, không chỉ copy AI? | ☑ | Mọi entry có Critical Thinking chỉ ra vấn đề với AI output |

### B. KIỂM TRA TỔNG THỂ LOG

| # | Tiêu chí | Pass? | Current Value |
|---|---|---|---|
| 1 | Số lượng entries nằm trong range (min-max)? | ☑ | 20 entries (~11% của ~178 total prompts) |
| 2 | Mỗi DTC component có ít nhất 1 core prompt? | ☑ | Decomposition:5, Pattern Recognition:4, Abstraction:5, Algorithms:6 |
| 3 | Đã phát hiện ≥ số lượng hallucination yêu cầu? | ☑ | 6 hallucinations (≥3 yêu cầu cho Project) |
| 4 | Mỗi entry đều có Human Delta đầy đủ (4 câu hỏi)? | ☑ | Critical Thinking + Contextualization + Creative Synthesis + Decision đủ 20/20 |
| 5 | Có evidence cho ≥70% entries? | ☑ | 20/20 entries (100%) có commit hash + files |

> **⚠️ LƯU Ý QUAN TRỌNG:**
>
> - Nếu entry KHÔNG pass ≥4/5 tiêu chí → LOẠI BỎ, không ghi vào Log
> - Nếu FAIL ≥2 tiêu chí tổng thể → AI Reflection = 0 điểm (mất 30%)

### C. CHUẨN BỊ CHO ORAL VIVAS (Q&A)

Giảng viên sẽ hỏi ngẫu nhiên về 3-5 entries. Tự hỏi bản thân:

| Entry # | Tôi có thể giải thích tại sao chọn approach này? | Tôi có nhớ AI response? | Tôi có evidence? |
|---|---|---|---|
| 001 | Có — tách pipeline import theo bước rời thay vì một khối | Có — dictionaryController + 10 script import | Commit 2e12bd5 |
| 002 | Có — escape input `.or()` chống parse-break, không chỉ try/catch | Có — AI đề xuất try/catch + ép kiểu | Commit 7d36100, escapeOrPattern() |
| 003 | Có — Promise.all nhưng phân loại query độc lập/phụ thuộc | Có — AI gộp hết vào Promise.all | Commit 47dbd5e |
| 005 | Có — tokenizer tách từ thay heuristic ký tự frontend | Có — WordLookupPopup + regex tách từ | Commit 671daef, jaTokenizer.js |
| 008 | Có — distractor cùng bộ thẻ, loại trùng đáp án đúng | Có — Learn/Test + flashcardQuiz | Commit 81667e4 |
| 009 | Có — trì hoãn xóa thay vì xóa-rồi-undo (mất data khi đóng tab) | Có — draft + undo | Commit 86d03ab |
| 011 | Có — validate schema output AI + quota theo server-time | Có — flashcardTestGen lưu DB | Commit cd9f86e |
| 013 | Có — scaled score + sectional pass thay vì % | Có — jlptMock scoring theo % | Commit 9fe9cef |
| 014 | Có — khóa blueprint nhưng cho phần đọc co giãn | Có — khóa cứng toàn bộ | Commit 23683b8 |
| 016 | Có — chống trùng bằng state + dedup, không chỉ prompt | Có — dặn prompt "đừng lặp" | Commit 3afea48 |
| 017 | Có — ràng buộc ngôn ngữ theo trường + verify output | Có — thêm 1 câu "viết tiếng Việt" | Commit e6b5cc2 |
| 018 | Có — sanitize output AI ở server, không chỉ cấm prompt | Có — cấm HTML trong prompt | Commit ed231eb |
| 019 | Có — TTS chỉ chạy khi transcript đổi, fallback upload | Có — server-TTS + per-question audio | Commit ee07187, 338c42a |
| 020 | Có — tập trung hóa client schema + audit từng điểm truy cập | Có — "đã chuyển hết truy vấn" (sót examGuard) | Commit cd67652, 6ec06eb |

> **Ghi chú:** File này giữ nguyên cấu trúc/format của `Format_AI_Auditlog.md` (mẫu của thành viên khác trong nhóm), chỉ thay nội dung theo các commit thực tế trên branch `Quyen`. Vui lòng điền `Student Name` và `Student ID` ở mục 1.

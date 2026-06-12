# Pipeline import dữ liệu từ điển Nhật-Việt

Nạp dữ liệu cho các bảng `dict_entries`, `dict_senses`, `dict_examples`, `dict_kanji`,
`dict_related_words` (xem `database/schema.sql`), phục vụ tính năng tra từ điển.

## Yêu cầu

- File `.env` ở thư mục gốc repo có `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FPT_AI_API_KEY`
  (và tuỳ chọn `FPT_AI_MODEL`).
- Lệnh `tar` khả dụng trong PATH (dùng để giải nén jmdict-simplified `.tgz`).
- Đã chạy `database/schema.sql` (hoặc `database/migrate.sql`) trên project Supabase.
- Đã `npm install` trong `backend/` (cần `wanakana`, `adm-zip`).

## Nguồn dữ liệu

| Nguồn | Dùng cho | Giấy phép |
|---|---|---|
| [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) (`jmdict-eng`, `jmdict-examples-eng`) | Từ vựng, sense (gloss), câu ví dụ | CC BY-SA 4.0 (JMdict/EDRDG) |
| [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) | Lọc từ theo cấp độ JLPT N5-N1 | MIT |
| [KanjiDictVN](https://github.com/trungnt2910/KanjiDictVN) | Âm Hán Việt, nghĩa Hán tự tiếng Việt, on/kun reading, số nét | MIT (kèm dữ liệu từ hvdic.thivien.net + KANJIDIC/EDRDG) |

Khi hiển thị dữ liệu từ điển ở frontend, cần ghi credit các nguồn trên (đã có ở footer trang Dictionary).

## Chạy pipeline

Chạy lần lượt từ thư mục gốc repo (mỗi script idempotent, có thể chạy lại an toàn):

```bash
# Dry-run với 50 từ đầu tiên (khuyến nghị chạy trước để kiểm tra)
node backend/scripts/dictionary-import/run-all.js --limit=50

# Chạy full (~10k từ JLPT N5-N1) — có thể mất nhiều giờ do dịch bằng AI theo batch
node backend/scripts/dictionary-import/run-all.js
```

Hoặc chạy từng bước riêng lẻ theo đúng thứ tự:

1. `download-sources.js` — tải JMdict, jlpt-word-list, KanjiDictVN vào `data/` (gitignored).
2. `build-jlpt-index.js` — lập chỉ mục `{kanji/kana -> JLPT level}` từ jlpt-word-list.
3. `import-entries.js` — lọc từ JMdict theo chỉ mục JLPT, sinh romaji, upsert `dict_entries`.
   Ghi `data/entries-with-senses.json` cho các bước sau.
4. `import-kanji-readings.js` — upsert `dict_kanji` (Hán Việt, nghĩa, on/kun, số nét, JLPT).
5. `translate-senses.js` — dịch gloss tiếng Anh sang tiếng Việt bằng AI (batch ~20 từ/lần),
   upsert `dict_senses`.
6. `import-examples.js` — lấy câu ví dụ từ `jmdict-examples-eng`, dịch sang tiếng Việt bằng AI,
   upsert `dict_examples` (tối đa 3 câu/sense).
7. `build-related-words.js` — resolve xref `related`/`antonym` trong JMdict sang `dict_entries.id`,
   upsert `dict_related_words`.

## Resume sau lỗi

Các bước 3, 5, 6 ghi checkpoint (`*.checkpoint.json`) trong `data/` sau mỗi batch — chạy lại script
sẽ tiếp tục từ batch chưa hoàn thành. Batch lỗi (ví dụ AI trả JSON không hợp lệ) được ghi vào
`*.failed-batches.json` để xem lại/chạy lại thủ công.

Để chạy lại từ đầu, xoá thư mục `backend/scripts/dictionary-import/data/`.

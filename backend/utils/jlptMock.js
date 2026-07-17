'use strict';

// ─── JLPT Mock Test: hằng số cấu trúc đề + quy tắc điểm + hàm chấm ───────────
// Nguồn cấu trúc: jlpt.jp (format hiện hành sau điều chỉnh 12/2020 N4-N5 và
// 12/2022 phần Nghe N1). Số câu mỗi mondai là 目安 (tham khảo) — chỉ dùng làm
// mặc định khi tạo khung đề; chấm điểm luôn theo số câu thực tế của đề.

// ── Cột chấm điểm theo cấp (khác với phần THI) ───────────────────────────────
// N1–N3: 3 cột language / reading / listening, mỗi cột 0–60, điểm liệt 19.
// N4–N5: 2 cột language_reading (0–120, liệt 38) / listening (0–60, liệt 19).
// `cats` = các score_category của group được gom vào cột đó.
const SCORE_COLUMNS = {
  N1: [
    { key: 'language',  max: 60, min: 19, cats: ['language'] },
    { key: 'reading',   max: 60, min: 19, cats: ['reading'] },
    { key: 'listening', max: 60, min: 19, cats: ['listening'] },
  ],
  N4: [
    { key: 'language_reading', max: 120, min: 38, cats: ['language', 'reading', 'language_reading'] },
    { key: 'listening',        max: 60,  min: 19, cats: ['listening'] },
  ],
};
SCORE_COLUMNS.N2 = SCORE_COLUMNS.N1;
SCORE_COLUMNS.N3 = SCORE_COLUMNS.N1;
SCORE_COLUMNS.N5 = SCORE_COLUMNS.N4;

// Điểm đậu tổng (/180) theo cấp
const PASS_TOTAL = { N1: 100, N2: 90, N3: 95, N4: 90, N5: 80 };

// ── Loại mondai (大問) ────────────────────────────────────────────────────────
// category: cột chấm mặc định; options_count: số lựa chọn chuẩn;
// ai_hint: mô tả dạng bài đưa vào prompt AI sinh câu;
// example: 1 câu mẫu JSON (few-shot) đưa vào prompt để AI bám đúng format.
const MONDAI_TYPES = {
  kanji_reading: {
    ja: '漢字読み', vi: 'Đọc kanji', category: 'language', options_count: 4,
    instruction: '＿＿＿のことばの読み方として最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu chứa 1 từ viết bằng kanji được đánh dấu (đặt trong 「」hoặc gạch dưới bằng ＿＿), hỏi cách đọc hiragana đúng. 4 lựa chọn là các cách đọc hiragana, distractor là âm đọc gần giống (trường âm, âm đục, âm ngắt).',
    example: '{"question_text":"きのう＿映画＿を見ました。","options":["えいが","えいか","えが","えいご"],"correct_index":0,"explanation":"「映画」đọc là えいが — có trường âm えい và âm đục が.","translation_vi":"Hôm qua tôi đã xem ＿phim＿.","option_translations":["えいが — đúng (映画 = phim)","えいか — sai âm đục (か thay vì が)","えが — thiếu trường âm えい","えいご — 英語 = tiếng Anh"]}',
  },
  orthography: {
    ja: '表記', vi: 'Cách viết (chữ Hán/Katakana)', category: 'language', options_count: 4,
    instruction: '＿＿＿のことばを漢字（または正しい表記）で書くとき、最もよいものを１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu chứa 1 từ viết bằng hiragana được đánh dấu, hỏi cách viết đúng bằng kanji (hoặc katakana). Distractor là kanji có hình dạng gần giống hoặc đồng âm khác nghĩa.',
    example: '{"question_text":"この＿しんぶん＿はおもしろいです。","options":["新聞","親聞","新間","親間"],"correct_index":0,"explanation":"「新聞」= báo. Distractor đổi 新→親 và 聞→間 là các kanji hình dạng gần giống.","translation_vi":"＿Tờ báo＿ này thú vị.","option_translations":["新聞 — báo (viết đúng)","親聞 — từ không tồn tại (親 sai)","新間 — từ không tồn tại (間 sai)","親間 — từ không tồn tại"]}',
  },
  word_formation: {
    ja: '語形成', vi: 'Cấu tạo từ', category: 'language', options_count: 4,
    instruction: '（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。',
    ai_hint: 'Câu có chỗ trống, điền tiền tố/hậu tố hoặc thành tố ghép đúng để tạo từ phái sinh (vd 「再～」「～性」「～的」). Chỉ có ở N2.',
    example: '{"question_text":"この製品は水に強く、耐久（　　）が高い。","options":["性","化","感","率"],"correct_index":0,"explanation":"「耐久性」= độ bền. Hậu tố 「～性」chỉ tính chất; 化/感/率 không ghép với 耐久.","translation_vi":"Sản phẩm này chịu nước tốt, độ bền（　　）cao.","option_translations":["～性 — tính chất","～化 — sự ...hóa","～感 — cảm giác","～率 — tỷ lệ"]}',
  },
  context: {
    ja: '文脈規定', vi: 'Điền từ theo ngữ cảnh', category: 'language', options_count: 4,
    instruction: '（　　）に入れるのに最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu có chỗ trống（　　）, chọn từ vựng đúng nhất theo ngữ cảnh. 4 lựa chọn cùng từ loại, distractor là từ cùng trường nghĩa nhưng sai sắc thái/collocation.',
    example: '{"question_text":"つかれたので、少し（　　）ましょう。","options":["やすみ","あそび","はたらき","いそぎ"],"correct_index":0,"explanation":"Vì mệt (つかれた) nên hành động hợp lý là 「休む」= nghỉ. Ba lựa chọn kia đều là động từ nhưng ngược ngữ cảnh.","translation_vi":"Vì mệt nên hãy（　　）một chút.","option_translations":["nghỉ","chơi","làm việc","vội"]}',
  },
  paraphrase: {
    ja: '言い換え類義', vi: 'Từ đồng nghĩa', category: 'language', options_count: 4,
    instruction: '＿＿＿のことばに意味が最も近いものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu chứa 1 từ/cụm được đánh dấu, chọn từ/cụm có nghĩa gần nhất. Distractor là từ liên quan nhưng nghĩa khác.',
    example: '{"question_text":"このもんだいは＿やさしい＿です。","options":["かんたん","むずかしい","たいせつ","ゆうめい"],"correct_index":0,"explanation":"「やさしい」ở đây = dễ, gần nghĩa nhất với 「かんたん」. 「むずかしい」là từ trái nghĩa.","translation_vi":"Bài này ＿dễ＿.","option_translations":["đơn giản","khó","quan trọng","nổi tiếng"]}',
  },
  usage: {
    ja: '用法', vi: 'Cách dùng từ', category: 'language', options_count: 4,
    instruction: 'つぎのことばの使い方として最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'question_text là 1 từ cho trước, 4 lựa chọn là 4 câu hoàn chỉnh dùng từ đó — chỉ 1 câu dùng đúng nghĩa/ngữ cảnh, 3 câu dùng sai một cách tự nhiên.',
    example: '{"question_text":"しゅうかん","options":["毎朝コーヒーを飲むのが父のしゅうかんだ。","この店のしゅうかんはとても親切だ。","電車のしゅうかんは10分おきだ。","彼は日本語のしゅうかんが上手だ。"],"correct_index":0,"explanation":"「習慣」= thói quen lặp lại của một người. Câu 2 phải dùng 「店員」, câu 3 dùng 「間隔」, câu 4 dùng 「発音」.","translation_vi":"Từ cho trước: しゅうかん (thói quen)","option_translations":["Uống cà phê mỗi sáng là thói quen của bố tôi.","「Thói quen」của quán này rất thân thiện (dùng sai — phải là 店員).","「Thói quen」của tàu là 10 phút một chuyến (dùng sai — phải là 間隔).","Anh ấy giỏi「thói quen」tiếng Nhật (dùng sai — phải là 発音)."]}',
  },
  grammar_form: {
    ja: '文の文法１（文法形式の判断）', vi: 'Chọn dạng ngữ pháp', category: 'language', options_count: 4,
    instruction: '（　　）に入れるのに最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu có chỗ trống（　　）, chọn cấu trúc ngữ pháp đúng. Distractor là mẫu ngữ pháp cùng cấp trông tương tự nhưng sai nghĩa/cách nối.',
    example: '{"question_text":"雨が降っていた（　　）、試合は中止になった。","options":["ので","のに","でも","ながら"],"correct_index":0,"explanation":"Quan hệ nguyên nhân–kết quả → 「ので」. 「のに」mang nghĩa nghịch ý, không hợp với kết quả hủy trận đấu.","translation_vi":"（　　）trời đang mưa nên trận đấu đã bị hủy.","option_translations":["ので — vì ~ nên (nguyên nhân)","のに — vậy mà (nghịch ý)","でも — nhưng","ながら — vừa ~ vừa"]}',
  },
  sentence_assembly: {
    ja: '文の文法２（文の組み立て）', vi: 'Sắp xếp câu (câu ★)', category: 'language', options_count: 4,
    instruction: 'つぎの文の　＿★＿　に入る最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu bị khuyết 4 chỗ liên tiếp ＿＿＿　＿★＿　＿＿＿　＿＿＿, 4 lựa chọn là 4 mảnh câu; hỏi mảnh nào nằm ở vị trí ★ khi sắp đúng thứ tự. explanation phải ghi rõ thứ tự đúng của cả 4 mảnh.',
    example: '{"question_text":"わたしは　＿＿＿　＿★＿　＿＿＿　＿＿＿　思っています。","options":["日本へ","来年","行きたいと","ぜひ"],"correct_index":3,"explanation":"Thứ tự đúng: 来年 → ぜひ → 日本へ → 行きたいと。Vị trí ★ là ô thứ 2 nên đáp án là 「ぜひ」(lựa chọn 4).","translation_vi":"Tôi đang nghĩ nhất định năm sau muốn đi Nhật.","option_translations":["đến Nhật","năm sau","muốn đi","nhất định"]}',
  },
  text_grammar: {
    ja: '文章の文法', vi: 'Ngữ pháp đoạn văn', category: 'language', options_count: 4,
    instruction: 'つぎの文章を読んで、文章全体の内容を考えて、（　　）に入る最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Cho 1 đoạn văn ngắn (passage_text của group) có các chỗ trống đánh số, mỗi câu hỏi tương ứng 1 chỗ trống — chọn từ nối/ngữ pháp đúng theo mạch văn.',
    example: '{"question_text":"（１）","options":["だから","でも","それに","たとえば"],"correct_index":1,"explanation":"Câu trước nói muốn đi chơi, câu sau nói trời mưa nên không đi được → quan hệ nghịch ý, dùng 「でも」.","translation_vi":"Chỗ trống (1)","option_translations":["vì vậy","nhưng","hơn nữa","ví dụ"]}',
  },
  reading_short: {
    ja: '内容理解（短文）', vi: 'Đọc hiểu đoạn ngắn', category: 'reading', options_count: 4,
    instruction: 'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Đoạn văn ngắn (~80–200 chữ tùy cấp, để ở passage_text) kèm 1 câu hỏi nội dung.',
    example: '{"question_text":"この文章の内容と合っているものはどれか。","options":["田中さんは今週の会議に出られない。","田中さんは会議の場所を変えたい。","会議は来週の月曜日に行われる。","会議の資料はまだできていない。"],"correct_index":0,"explanation":"Đoạn văn viết 「出張のため今週の会議には参加できません」→ Tanaka không dự họp tuần này được.","translation_vi":"Nội dung nào đúng với bài đọc?","option_translations":["Tanaka không dự được cuộc họp tuần này.","Tanaka muốn đổi địa điểm họp.","Cuộc họp diễn ra thứ Hai tuần sau.","Tài liệu họp chưa xong."]}',
  },
  reading_mid: {
    ja: '内容理解（中文）', vi: 'Đọc hiểu đoạn vừa', category: 'reading', options_count: 4,
    instruction: 'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Đoạn văn vừa (~250–500 chữ tùy cấp) kèm 2–3 câu hỏi về nội dung, lý do, ý người viết.',
    example: '{"question_text":"筆者が＿そう考える＿のはなぜか。","options":["経験から学ぶことのほうが多いから","本を読む時間が足りないから","学校の勉強が役に立たないから","失敗を避けたいから"],"correct_index":0,"explanation":"Đoạn 2 viết 「失敗して初めて分かることがある」— tác giả cho rằng học từ trải nghiệm được nhiều hơn.","translation_vi":"Vì sao tác giả ＿nghĩ như vậy＿?","option_translations":["Vì học từ trải nghiệm được nhiều hơn.","Vì không đủ thời gian đọc sách.","Vì học ở trường không có ích.","Vì muốn tránh thất bại."]}',
  },
  reading_long: {
    ja: '内容理解（長文）', vi: 'Đọc hiểu đoạn dài', category: 'reading', options_count: 4,
    instruction: 'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Đoạn văn dài (~550–1000 chữ tùy cấp) kèm 3–4 câu hỏi.',
    example: '{"question_text":"この文章全体で筆者が最も言いたいことは何か。","options":["技術の進歩には人の判断が欠かせない","新しい技術はできるだけ早く導入すべきだ","機械は人間の仕事をすべて代わりに行う","昔のやり方に戻ったほうがよい"],"correct_index":0,"explanation":"Đoạn cuối kết lại 「最後に決めるのはやはり人間である」— ý chính là tiến bộ kỹ thuật vẫn cần phán đoán của con người.","translation_vi":"Điều tác giả muốn nói nhất qua toàn bài là gì?","option_translations":["Tiến bộ kỹ thuật không thể thiếu phán đoán của con người.","Nên đưa công nghệ mới vào càng sớm càng tốt.","Máy móc sẽ làm thay toàn bộ công việc của con người.","Nên quay lại cách làm cũ."]}',
  },
  integrated_reading: {
    ja: '統合理解', vi: 'Đọc so sánh nhiều văn bản', category: 'reading', options_count: 4,
    instruction: 'つぎのＡとＢの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Hai văn bản A và B về cùng chủ đề (đặt cả hai trong passage_text, đánh dấu Ａ/Ｂ), câu hỏi yêu cầu so sánh/tổng hợp quan điểm.',
    example: '{"question_text":"在宅勤務について、ＡとＢはどのような点で共通しているか。","options":["通勤の負担が減ることを認めている点","制度の廃止を求めている点","若い社員だけに向くと考えている点","生産性が必ず上がると述べている点"],"correct_index":0,"explanation":"Ａ viết 「通勤時間がなくなる利点」, Ｂ viết 「移動の負担が軽い」— cả hai đều công nhận giảm gánh nặng đi lại, dù kết luận cuối khác nhau.","translation_vi":"Về làm việc tại nhà, Ａ và Ｂ giống nhau ở điểm nào?","option_translations":["Đều thừa nhận giảm gánh nặng đi lại.","Đều yêu cầu bãi bỏ chế độ này.","Đều cho rằng chỉ hợp với nhân viên trẻ.","Đều nói năng suất chắc chắn tăng."]}',
  },
  thematic_reading: {
    ja: '主張理解（長文）', vi: 'Hiểu chủ trương (xã luận)', category: 'reading', options_count: 4,
    instruction: 'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Bài xã luận/bình luận dài (~900–1000 chữ), câu hỏi về chủ trương, ý kiến của tác giả.',
    example: '{"question_text":"筆者の主張として最も適切なものはどれか。","options":["効率だけを追い求める姿勢を見直すべきだ","伝統的な手法をすべて守るべきだ","若い世代に任せておけばよい","議論より行動を優先すべきだ"],"correct_index":0,"explanation":"Xuyên suốt bài, tác giả phê phán 「効率至上主義」và kết bằng 「立ち止まって考える必要がある」— chủ trương là xem lại thái độ chỉ chạy theo hiệu quả.","translation_vi":"Chủ trương của tác giả là gì?","option_translations":["Cần xem lại thái độ chỉ theo đuổi hiệu quả.","Phải giữ toàn bộ phương pháp truyền thống.","Cứ giao hết cho thế hệ trẻ.","Nên ưu tiên hành động hơn bàn luận."]}',
  },
  info_retrieval: {
    ja: '情報検索', vi: 'Tìm kiếm thông tin', category: 'reading', options_count: 4,
    instruction: 'つぎのページを見て、下の質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Văn bản thông tin dạng thông báo/quảng cáo/thời khóa biểu (passage_text hoặc image_url), câu hỏi yêu cầu tra cứu thông tin thỏa điều kiện.',
    example: '{"question_text":"平日の夜に参加でき、料金が2,000円以下のコースはどれか。","options":["火曜コース","水曜コース","土曜コース","日曜コース"],"correct_index":0,"explanation":"Khóa thứ Ba: 19:00 (tối ngày thường) và 1,800 yên — thỏa cả hai điều kiện. Khóa thứ Tư 2,500 yên (quá giá), thứ Bảy/Chủ nhật không phải ngày thường.","translation_vi":"Khóa nào tham gia được vào buổi tối ngày thường và giá dưới 2.000 yên?","option_translations":["Khóa thứ Ba","Khóa thứ Tư","Khóa thứ Bảy","Khóa Chủ nhật"]}',
  },
  task_comprehension: {
    ja: '課題理解', vi: 'Nghe hiểu nhiệm vụ', category: 'listening', options_count: 4, needs_audio: true,
    instruction: 'まず質問を聞いてください。それから話を聞いて、問題用紙の１から４の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Hội thoại ngắn (viết script vào audio_transcript), hỏi người nghe tiếp theo phải làm gì. 4 lựa chọn in trên giấy (chữ hoặc mô tả tranh).',
    example: '{"question_text":"女の人はこのあとまず何をしますか。","options":["資料をコピーする","会議室を予約する","部長に電話する","レポートを書く"],"correct_index":0,"explanation":"Phòng họp đã đặt rồi; người nam nhờ 「この資料を10部コピーしてください」và người nữ đáp 「すぐにやります」→ việc làm ngay là photo tài liệu.","translation_vi":"Nội dung: Nam hỏi chuẩn bị họp xong chưa, nữ nói đã đặt phòng họp rồi, nam nhờ photo 10 bản tài liệu, nữ nói sẽ làm ngay.\\nCâu hỏi: Người nữ sẽ làm gì trước tiên?","option_translations":["Photo tài liệu","Đặt phòng họp","Gọi cho trưởng phòng","Viết báo cáo"],"audio_transcript":"女の人はこのあとまず何をしますか。\\n男：山田さん、会議の準備はできましたか。\\n女：はい、会議室はもう予約しました。\\n男：じゃあ、この資料を10部コピーしてください。\\n女：わかりました。すぐにやります。\\n女の人はこのあとまず何をしますか。"}',
  },
  point_comprehension: {
    ja: 'ポイント理解', vi: 'Nghe hiểu điểm chính', category: 'listening', options_count: 4, needs_audio: true,
    instruction: 'まず質問を聞いてください。そのあと、問題用紙のせんたくしを読んでください。それから話を聞いて、１から４の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Hội thoại/độc thoại, câu hỏi nêu trước điểm cần chú ý (lý do, thời gian...). 4 lựa chọn in trên giấy.',
    example: '{"question_text":"男の人はどうして昨日休みましたか。","options":["かぜをひいたから","子どもの学校へ行ったから","病院で検査があったから","引っ越しをしたから"],"correct_index":1,"explanation":"Người nam nói 「実は子どもの学校の行事があって」— nghỉ vì đến trường của con, không phải vì ốm (chỉ là phỏng đoán của người nữ).","translation_vi":"Nội dung: Nữ hỏi hôm qua anh nghỉ có phải bị cảm không, nam nói không phải, thật ra là có sự kiện ở trường của con nên phải đến.\\nCâu hỏi: Vì sao người nam nghỉ hôm qua?","option_translations":["Vì bị cảm","Vì đến trường của con","Vì đi khám ở bệnh viện","Vì chuyển nhà"],"audio_transcript":"男の人はどうして昨日休みましたか。\\n女：田中さん、昨日は休みでしたね。かぜですか。\\n男：いいえ、実は子どもの学校の行事があって、朝から行っていたんです。\\n女：そうだったんですか。\\n男の人はどうして昨日休みましたか。"}',
  },
  summary_comprehension: {
    ja: '概要理解', vi: 'Nghe hiểu khái quát', category: 'listening', options_count: 4, needs_audio: true,
    instruction: '問題用紙に何もいんさつされていません。この問題は、ぜんたいとしてどんなないようかを聞く問題です。話の前に質問はありません。',
    ai_hint: 'Độc thoại/hội thoại, hỏi đại ý toàn bài; câu hỏi và lựa chọn chỉ đọc trong audio (không in trên giấy) — question_text để trống, options vẫn nhập để chấm.',
    no_question_text: true,
    example: '{"question_text":null,"options":["新しい制度の利用方法","会社の歴史","社員旅行の予定","駅までの行き方"],"correct_index":0,"explanation":"Toàn bài người nói giải thích cách đăng ký và điều kiện của chế độ làm việc tại nhà mới → đại ý là cách sử dụng chế độ mới.","translation_vi":"Nội dung: Người nữ thông báo từ tháng sau công ty áp dụng chế độ làm việc tại nhà, giải thích ai được dùng và cách đăng ký qua hệ thống.\\nCâu hỏi (chỉ đọc trong audio): Người nữ đang nói về chuyện gì?","option_translations":["Cách sử dụng chế độ mới","Lịch sử công ty","Kế hoạch du lịch công ty","Đường ra ga"],"audio_transcript":"女：来月から、在宅勤務の制度が始まります。入社1年以上の社員なら、だれでも利用できます。使いたい人は、前の週の金曜日までに社内システムから申し込んでください。上司の許可が出れば、次の週から利用できます。\\n女の人は何について話していますか。\\n１　新しい制度の利用方法\\n２　会社の歴史\\n３　社員旅行の予定\\n４　駅までの行き方"}',
  },
  utterance_expression: {
    ja: '発話表現', vi: 'Chọn phát ngôn theo tranh', category: 'listening', options_count: 3, needs_audio: true, needs_image: true,
    instruction: 'えを見ながら質問を聞いてください。やじるし（→）の人は何と言いますか。１から３の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Tình huống có tranh (image_url), người được đánh dấu → phải nói gì. 3 lựa chọn là 3 câu nói ngắn. Chỉ có ở N3–N5.',
    example: '{"question_text":null,"options":["すみません、写真を撮ってもらえませんか。","すみません、写真を撮りましょうか。","すみません、写真を撮ってあげます。"],"correct_index":0,"explanation":"Người mũi tên muốn NHỜ người khác chụp ảnh hộ mình → 「撮ってもらえませんか」. Lựa chọn 2–3 là ngỏ ý chụp giúp người kia, ngược tình huống.","translation_vi":"Tình huống (có tranh): Người mũi tên muốn nhờ người qua đường chụp ảnh giúp.","option_translations":["Xin lỗi, anh chụp ảnh giúp tôi được không?","Xin lỗi, để tôi chụp ảnh cho nhé?","Xin lỗi, tôi sẽ chụp ảnh cho anh."],"audio_transcript":"旅行先で写真を撮りたいです。近くの人にお願いします。何と言いますか。\\n女：\\n１　すみません、写真を撮ってもらえませんか。\\n２　すみません、写真を撮りましょうか。\\n３　すみません、写真を撮ってあげます。"}',
  },
  quick_response: {
    ja: '即時応答', vi: 'Đáp lại tức thì', category: 'listening', options_count: 3, needs_audio: true,
    instruction: 'ぶんを聞いて、１から３の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Một câu nói ngắn + 3 câu đáp lại (tất cả chỉ nghe, không in trên giấy) — question_text để trống; ghi câu mở lời + 3 lựa chọn vào script; options nhập text để chấm và review.',
    no_question_text: true,
    example: '{"question_text":null,"options":["ええ、おかげさまで。","はい、行ってきます。","いいえ、まだです。"],"correct_index":0,"explanation":"「お元気でしたか」là câu hỏi thăm sức khỏe → đáp tự nhiên là 「ええ、おかげさまで」. Hai câu còn lại trả lời cho ngữ cảnh khác.","translation_vi":"Câu mở: Lâu rồi không gặp. Dạo này anh khỏe chứ?","option_translations":["Vâng, nhờ trời ạ.","Vâng, tôi đi đây.","Không, vẫn chưa."],"audio_transcript":"男：お久しぶりです。お元気でしたか。\\n女：\\n１　ええ、おかげさまで。\\n２　はい、行ってきます。\\n３　いいえ、まだです。"}',
  },
  integrated_listening: {
    ja: '統合理解（聴解）', vi: 'Nghe tổng hợp', category: 'listening', options_count: 4, needs_audio: true,
    instruction: '長めの話を聞いて、質問に答えてください。１から４の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Bài nghe dài (nhiều người nói/so sánh thông tin), 1 audio dùng chung cho 1–2 câu hỏi con. Chỉ có ở N1–N2.',
    example: '{"question_text":"男の人はどのコースを選びますか。","options":["Ａコース","Ｂコース","Ｃコース","Ｄコース"],"correct_index":1,"explanation":"Người nam nói 「土日は仕事があるから平日の夜がいい」và 「会話中心がいい」→ chỉ khóa Ｂ (tối thứ Tư, trọng tâm hội thoại) thỏa cả hai.","translation_vi":"Nội dung: Nhân viên trung tâm giới thiệu 4 khóa tiếng Nhật (giờ học và trọng tâm khác nhau). Người nam nói cuối tuần bận việc nên muốn học tối ngày thường và muốn khóa chú trọng hội thoại.\\nCâu hỏi: Người nam chọn khóa nào?","option_translations":["Khóa A","Khóa B","Khóa C","Khóa D"],"audio_transcript":"女：日本語コースは4つあります。Ａコースは土曜の午前で、文法が中心です。Ｂコースは水曜の夜で、会話が中心です。Ｃコースは日曜の午後で、読解が中心です。Ｄコースは月曜の午前で、漢字が中心です。\\n男：土日は仕事があるので、平日の夜がいいですね。それに、話す練習がしたいんです。\\n女：それでしたら、ちょうどいいコースがありますよ。\\n男の人はどのコースを選びますか。"}',
  },
};

// ── Blueprint khung đề chuẩn từng cấp ────────────────────────────────────────
// Tiện ích tạo group theo blueprint: [mondai_type, question_count, score_category]
const g = (type, count, category) => ({ mondai_type: type, question_count: count, score_category: category });

const BLUEPRINTS = {
  N5: {
    total_questions: 67,
    sections: [
      {
        section_type: 'vocab', title: '言語知識（文字・語彙）', time_limit_minutes: 20,
        groups: [
          g('kanji_reading', 7, 'language_reading'),
          g('orthography', 5, 'language_reading'),
          g('context', 6, 'language_reading'),
          g('paraphrase', 3, 'language_reading'),
        ],
      },
      {
        section_type: 'grammar_reading', title: '言語知識（文法）・読解', time_limit_minutes: 40,
        groups: [
          g('grammar_form', 9, 'language_reading'),
          g('sentence_assembly', 4, 'language_reading'),
          g('text_grammar', 4, 'language_reading'),
          g('reading_short', 2, 'language_reading'),
          g('reading_mid', 2, 'language_reading'),
          g('info_retrieval', 1, 'language_reading'),
        ],
      },
      {
        section_type: 'listening', title: '聴解', time_limit_minutes: 30,
        groups: [
          g('task_comprehension', 7, 'listening'),
          g('point_comprehension', 6, 'listening'),
          g('utterance_expression', 5, 'listening'),
          g('quick_response', 6, 'listening'),
        ],
      },
    ],
  },
  N4: {
    total_questions: 85,
    sections: [
      {
        section_type: 'vocab', title: '言語知識（文字・語彙）', time_limit_minutes: 25,
        groups: [
          g('kanji_reading', 7, 'language_reading'),
          g('orthography', 5, 'language_reading'),
          g('context', 8, 'language_reading'),
          g('paraphrase', 4, 'language_reading'),
          g('usage', 4, 'language_reading'),
        ],
      },
      {
        section_type: 'grammar_reading', title: '言語知識（文法）・読解', time_limit_minutes: 55,
        groups: [
          g('grammar_form', 13, 'language_reading'),
          g('sentence_assembly', 4, 'language_reading'),
          g('text_grammar', 4, 'language_reading'),
          g('reading_short', 3, 'language_reading'),
          g('reading_mid', 3, 'language_reading'),
          g('info_retrieval', 2, 'language_reading'),
        ],
      },
      {
        section_type: 'listening', title: '聴解', time_limit_minutes: 35,
        groups: [
          g('task_comprehension', 8, 'listening'),
          g('point_comprehension', 7, 'listening'),
          g('utterance_expression', 5, 'listening'),
          g('quick_response', 8, 'listening'),
        ],
      },
    ],
  },
  N3: {
    total_questions: 102,
    sections: [
      {
        section_type: 'vocab', title: '言語知識（文字・語彙）', time_limit_minutes: 30,
        groups: [
          g('kanji_reading', 8, 'language'),
          g('orthography', 6, 'language'),
          g('context', 11, 'language'),
          g('paraphrase', 5, 'language'),
          g('usage', 5, 'language'),
        ],
      },
      {
        section_type: 'grammar_reading', title: '言語知識（文法）・読解', time_limit_minutes: 70,
        groups: [
          g('grammar_form', 13, 'language'),
          g('sentence_assembly', 5, 'language'),
          g('text_grammar', 5, 'language'),
          g('reading_short', 4, 'reading'),
          g('reading_mid', 6, 'reading'),
          g('reading_long', 4, 'reading'),
          g('info_retrieval', 2, 'reading'),
        ],
      },
      {
        section_type: 'listening', title: '聴解', time_limit_minutes: 40,
        groups: [
          g('task_comprehension', 6, 'listening'),
          g('point_comprehension', 6, 'listening'),
          g('summary_comprehension', 3, 'listening'),
          g('utterance_expression', 4, 'listening'),
          g('quick_response', 9, 'listening'),
        ],
      },
    ],
  },
  N2: {
    total_questions: 106,
    sections: [
      {
        section_type: 'language_reading', title: '言語知識（文字・語彙・文法）・読解', time_limit_minutes: 105,
        groups: [
          g('kanji_reading', 5, 'language'),
          g('orthography', 5, 'language'),
          g('word_formation', 4, 'language'),
          g('context', 7, 'language'),
          g('paraphrase', 5, 'language'),
          g('usage', 5, 'language'),
          g('grammar_form', 12, 'language'),
          g('sentence_assembly', 5, 'language'),
          g('text_grammar', 5, 'language'),
          g('reading_short', 5, 'reading'),
          g('reading_mid', 9, 'reading'),
          g('integrated_reading', 2, 'reading'),
          g('thematic_reading', 3, 'reading'),
          g('info_retrieval', 2, 'reading'),
        ],
      },
      {
        section_type: 'listening', title: '聴解', time_limit_minutes: 50,
        groups: [
          g('task_comprehension', 5, 'listening'),
          g('point_comprehension', 6, 'listening'),
          g('summary_comprehension', 5, 'listening'),
          g('quick_response', 12, 'listening'),
          g('integrated_listening', 4, 'listening'),
        ],
      },
    ],
  },
  N1: {
    total_questions: 101,
    sections: [
      {
        section_type: 'language_reading', title: '言語知識（文字・語彙・文法）・読解', time_limit_minutes: 110,
        groups: [
          g('kanji_reading', 6, 'language'),
          g('context', 7, 'language'),
          g('paraphrase', 6, 'language'),
          g('usage', 6, 'language'),
          g('grammar_form', 10, 'language'),
          g('sentence_assembly', 5, 'language'),
          g('text_grammar', 5, 'language'),
          g('reading_short', 4, 'reading'),
          g('reading_mid', 9, 'reading'),
          g('reading_long', 4, 'reading'),
          g('integrated_reading', 3, 'reading'),
          g('thematic_reading', 4, 'reading'),
          g('info_retrieval', 2, 'reading'),
        ],
      },
      {
        // Format phần Nghe N1 từ 12/2022
        section_type: 'listening', title: '聴解', time_limit_minutes: 55,
        groups: [
          g('task_comprehension', 5, 'listening'),
          g('point_comprehension', 6, 'listening'),
          g('summary_comprehension', 5, 'listening'),
          g('quick_response', 11, 'listening'),
          g('integrated_listening', 3, 'listening'),
        ],
      },
    ],
  },
};

// ── Chấm điểm ────────────────────────────────────────────────────────────────
// questions: [{ id, correct_index, score_category }]
// answersMap: { [question_id]: selected_index }
// Trả về: { scores, total_score, passed, perQuestion }
//   scores = { [colKey]: { score, max, min, correct, total, passed } }
// Điểm cột = round(số đúng / tổng câu cột × max) — điểm ƯỚC LƯỢNG (JLPT thật
// dùng scaled score IRT, không tái tạo được). Đậu = tổng ≥ PASS_TOTAL[level]
// VÀ mọi cột ≥ điểm liệt.
function computeJlptScores(questions, answersMap, level) {
  const columns = SCORE_COLUMNS[level];
  if (!columns) throw new Error(`Cấp độ JLPT không hợp lệ: ${level}`);

  const stats = {};
  for (const col of columns) stats[col.key] = { correct: 0, total: 0 };
  const catToCol = {};
  for (const col of columns) for (const cat of col.cats) catToCol[cat] = col.key;

  const perQuestion = [];
  for (const q of questions) {
    const colKey = catToCol[q.score_category];
    const selected = answersMap[q.id];
    const isCorrect = selected !== undefined && selected !== null && Number(selected) === Number(q.correct_index);
    perQuestion.push({ question_id: q.id, selected_index: selected ?? null, is_correct: isCorrect });
    if (!colKey) continue; // score_category không khớp cấp độ — bỏ qua khỏi điểm
    stats[colKey].total += 1;
    if (isCorrect) stats[colKey].correct += 1;
  }

  const scores = {};
  let totalScore = 0;
  let allColumnsPassed = true;
  for (const col of columns) {
    const { correct, total } = stats[col.key];
    const score = total > 0 ? Math.round((correct / total) * col.max) : 0;
    // Cột không có câu (đề chưa hoàn chỉnh) không tính liệt — validate lúc publish đã chặn
    const colPassed = total > 0 ? score >= col.min : true;
    if (!colPassed) allColumnsPassed = false;
    scores[col.key] = { score, max: col.max, min: col.min, correct, total, passed: colPassed };
    totalScore += score;
  }

  const passed = allColumnsPassed && totalScore >= PASS_TOTAL[level];
  return { scores, total_score: totalScore, passed, perQuestion };
}

// ── Validate payload 1 câu hỏi JLPT (trắc nghiệm 3–4 lựa chọn) ───────────────
// Dùng chung cho đề thi thử (mock_questions) và ngân hàng đề (jlpt_bank_questions).
function validateQuestionPayload(q) {
  if (!Array.isArray(q.options) || q.options.length < 3 || q.options.length > 4)
    return 'Mỗi câu phải có 3 hoặc 4 lựa chọn.';
  if (q.options.some(o => typeof o !== 'string' || !o.trim()))
    return 'Lựa chọn không được để trống.';
  const ci = Number(q.correct_index);
  if (!Number.isInteger(ci) || ci < 0 || ci >= q.options.length)
    return 'Đáp án đúng (correct_index) không hợp lệ.';
  if (q.option_translations != null) {
    if (!Array.isArray(q.option_translations) || q.option_translations.length !== q.options.length
        || q.option_translations.some(t => typeof t !== 'string'))
      return 'Bản dịch lựa chọn (option_translations) phải là mảng chuỗi cùng số lượng với lựa chọn.';
  }
  return null;
}

module.exports = { SCORE_COLUMNS, PASS_TOTAL, MONDAI_TYPES, BLUEPRINTS, computeJlptScores, validateQuestionPayload };

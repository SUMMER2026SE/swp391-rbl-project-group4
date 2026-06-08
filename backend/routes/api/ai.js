'use strict';

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { chatCompletion } = require('../../config/ai');
const { supabaseAdmin } = require('../../config/supabase');

// GET /api/ai/ping  (admin)
router.get('/ping', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await chatCompletion([{ role: 'user', content: 'Say "OK" in one word.' }], { max_tokens: 10 });
    res.json({ ok: true, model: result.model, reply: result.choices?.[0]?.message?.content?.trim() });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// POST /api/ai/check-json  (admin)
// Body: { type: 'vocab'|'kanji', items: [...] }    — kiểm tra nội dung
//    or { type: 'vocab'|'kanji', rawText: "..." }  — sửa format JSON + kiểm tra nội dung
router.post('/check-json', requireAuth, requireAdmin, async (req, res) => {
  const { type, items, rawText } = req.body;
  if (!['vocab', 'kanji'].includes(type)) return res.status(400).json({ error: 'type phải là vocab hoặc kanji.' });

  // ── rawText mode: fix broken JSON format then check content ────────────────
  if (rawText !== undefined) {
    if (!rawText || !rawText.trim()) return res.status(400).json({ error: 'rawText không được rỗng.' });
    if (rawText.length > 30000)      return res.status(400).json({ error: 'Văn bản quá dài (tối đa 30 000 ký tự).' });

    const fixPrompt = type === 'vocab'
      ? `Bạn là chuyên gia tiếng Nhật và JSON. Văn bản đầu vào là JSON từ vựng có thể bị lỗi định dạng.

BƯỚC 1 — Sửa lỗi định dạng JSON:
- Sửa thiếu/thừa dấu phẩy, dấu ngoặc vuông/nhọn, dấu nháy kép
- Chuyển key thành đúng tên: kanji, reading, meaning_vi, meaning_ja, level, type, example_sentence
- Đảm bảo kết quả là mảng JSON hợp lệ

BƯỚC 2 — Kiểm tra và sửa nội dung từng từ:
1. Sửa reading (furigana) nếu sai so với kanji
2. Sửa lỗi chính tả trong meaning_vi
3. Bổ sung level nếu thiếu (N5/N4/N3/N2/N1)
4. Bổ sung type nếu thiếu (DANH TỪ/ĐỘNG TỪ/TÍNH TỪ/PHÓ TỪ/LIÊN TỪ)
5. Thêm "_notes": mô tả ngắn những gì đã sửa. Nếu không sửa gì thì ""
6. Thêm "_changed": true nếu có bất kỳ thay đổi nào, ngược lại false

Trả về ĐÚNG mảng JSON hợp lệ, không giải thích gì ngoài JSON.`
      : `Bạn là chuyên gia tiếng Nhật và JSON. Văn bản đầu vào là JSON kanji có thể bị lỗi định dạng.

BƯỚC 1 — Sửa lỗi định dạng JSON:
- Sửa thiếu/thừa dấu phẩy, dấu ngoặc, dấu nháy kép
- Key hợp lệ: character, reading_on (mảng katakana), reading_kun (mảng hiragana), meaning_vi, stroke_count, level
- Đảm bảo reading_on và reading_kun là mảng chuỗi
- Đảm bảo kết quả là mảng JSON hợp lệ

BƯỚC 2 — Kiểm tra và sửa nội dung từng kanji:
1. Kiểm tra reading_on (on-yomi, katakana) — sửa nếu sai
2. Kiểm tra reading_kun (kun-yomi, hiragana) — sửa nếu sai
3. Sửa lỗi chính tả trong meaning_vi
4. Bổ sung level nếu thiếu (N5/N4/N3/N2/N1)
5. Sửa stroke_count nếu sai
6. Thêm "_notes": mô tả ngắn những gì đã sửa. Nếu không sửa gì thì ""
7. Thêm "_changed": true nếu có bất kỳ thay đổi nào, ngược lại false

Trả về ĐÚNG mảng JSON hợp lệ, không giải thích gì ngoài JSON.`;

    try {
      const result = await chatCompletion(
        [{ role: 'system', content: fixPrompt }, { role: 'user', content: 'Sửa và kiểm tra JSON sau:\n' + rawText }],
        { max_tokens: 4096, temperature: 0.1 }
      );
      const raw = result.choices?.[0]?.message?.content || '';
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return res.status(502).json({ error: 'AI không trả về JSON hợp lệ.', raw: raw.slice(0, 500) });

      let checked;
      try { checked = JSON.parse(match[0]); }
      catch { return res.status(502).json({ error: 'Không thể parse JSON từ AI.', raw: raw.slice(0, 500) }); }

      const changedCount = checked.filter(i => i._changed).length;
      return res.json({
        items: checked,
        summary: 'Đã sửa định dạng và kiểm tra ' + checked.length + ' mục. ' +
          (changedCount > 0 ? 'AI đã sửa ' + changedCount + ' mục.' : 'Không phát hiện lỗi nội dung.'),
        usage: result.usage,
      });
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // ── items mode: content check only ────────────────────────────────────────
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items phải là mảng không rỗng.' });
  if (items.length > 50) return res.status(400).json({ error: 'Chỉ kiểm tra tối đa 50 mục một lần.' });

  const systemPrompt = type === 'vocab'
    ? `Bạn là chuyên gia tiếng Nhật. Nhiệm vụ: kiểm tra và sửa mảng JSON từ vựng tiếng Nhật.
Với mỗi từ, hãy:
1. Sửa reading (furigana) nếu sai so với kanji
2. Sửa lỗi chính tả trong meaning_vi (tiếng Việt)
3. Bổ sung level phù hợp nếu thiếu (N5/N4/N3/N2/N1)
4. Bổ sung type phù hợp nếu thiếu (DANH TỪ/ĐỘNG TỪ/TÍNH TỪ/PHÓ TỪ/LIÊN TỪ)
5. Sửa example_sentence nếu sai ngữ pháp
6. Thêm "_notes" giải thích ngắn những thay đổi (tiếng Việt). Nếu không thay đổi gì thì "_notes" = ""
7. Thêm "_changed": true nếu có bất kỳ thay đổi nào, ngược lại false

Trả về ĐÚNG mảng JSON gốc với các trường đã sửa. Không thêm trường nào khác ngoài _notes và _changed. Không giải thích gì ngoài JSON.`
    : `Bạn là chuyên gia tiếng Nhật. Nhiệm vụ: kiểm tra và sửa mảng JSON kanji tiếng Nhật.
Với mỗi kanji, hãy:
1. Kiểm tra reading_on (on-yomi, katakana) — sửa nếu sai
2. Kiểm tra reading_kun (kun-yomi, hiragana) — sửa nếu sai
3. Sửa lỗi chính tả trong meaning_vi (tiếng Việt)
4. Bổ sung level phù hợp nếu thiếu (N5/N4/N3/N2/N1)
5. Sửa stroke_count nếu sai
6. Thêm "_notes" giải thích ngắn những thay đổi (tiếng Việt). Nếu không thay đổi gì thì "_notes" = ""
7. Thêm "_changed": true nếu có bất kỳ thay đổi nào, ngược lại false

Trả về ĐÚNG mảng JSON gốc với các trường đã sửa. Không thêm trường nào khác ngoài _notes và _changed. Không giải thích gì ngoài JSON.`;

  try {
    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Kiểm tra và sửa mảng JSON sau:\n' + JSON.stringify(items, null, 2) },
      ],
      { max_tokens: 4096, temperature: 0.2 }
    );

    const raw = result.choices?.[0]?.message?.content || '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(502).json({ error: 'AI không trả về JSON hợp lệ.', raw: raw.slice(0, 500) });

    let checked;
    try { checked = JSON.parse(match[0]); }
    catch { return res.status(502).json({ error: 'Không thể parse JSON từ AI.', raw: raw.slice(0, 500) }); }

    const changedCount = checked.filter(i => i._changed).length;
    res.json({
      items: checked,
      summary: 'Đã kiểm tra ' + checked.length + ' mục. ' +
        (changedCount > 0 ? 'AI đề xuất sửa ' + changedCount + ' mục.' : 'Không phát hiện lỗi nào.'),
      usage: result.usage,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Chat session management ───────────────────────────────────────────────────

// GET /api/ai/sessions
router.get('/sessions', requireAuth, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ sessions: data });
});

// GET /api/ai/sessions/:id  — load messages
router.get('/sessions/:id', requireAuth, async (req, res) => {
  const { data: session, error: sErr } = await supabaseAdmin
    .from('chat_sessions')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (sErr || !session) return res.status(404).json({ error: 'Session not found.' });

  const { data: messages, error: mErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id, role, content, context_items, created_at')
    .eq('session_id', req.params.id)
    .order('created_at', { ascending: true });
  if (mErr) return res.status(500).json({ error: mErr.message });
  res.json({ messages });
});

// DELETE /api/ai/sessions/:id
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('chat_sessions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/ai/chat  (all authenticated users)
// Body: { messages, sessionId?, imageBase64?, imageType? }
router.post('/chat', requireAuth, async (req, res) => {
  const { messages, sessionId: incomingSessionId, imageBase64, imageType } = req.body;
  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'messages phải là mảng không rỗng.' });

  const userId  = req.user.id;
  const trimmed = messages.slice(-20);

  // ── Resolve / create session ──────────────────────────────────────────────
  let sessionId = incomingSessionId || null;
  const isNewSession = !sessionId;

  if (isNewSession) {
    const firstContent = messages.find(m => m.role === 'user')?.content || 'Cuộc trò chuyện mới';
    const title = firstContent.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Cuộc trò chuyện mới';
    const { data: newSession, error: cErr } = await supabaseAdmin
      .from('chat_sessions')
      .insert({ user_id: userId, title })
      .select('id')
      .single();
    if (cErr) return res.status(500).json({ error: 'Không thể tạo session: ' + cErr.message });
    sessionId = newSession.id;
  }

  // Save the last user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg) {
    await supabaseAdmin.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: lastUserMsg.content + (imageBase64 ? '\n[Hình ảnh đính kèm]' : ''),
    });
  }

  const lastUser = [...trimmed].reverse().find(m => m.role === 'user');
  let contextText = '';
  let ctxVocabs = [];
  let ctxKanjis = [];

  if (lastUser) {
    // Extract Japanese tokens (hiragana, katakana, CJK)
    const jpTokens = (lastUser.content.match(/[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]+/g) || []).join('');

    // Extract Vietnamese keywords — remove stop words
    const VI_STOPS = new Set([
      'là','gì','tiếng','nhật','kanji','từ','vựng','nghĩa','về','của','trong',
      'và','với','cho','như','có','không','được','này','kia','đó','thì','mà',
      'để','vì','nên','nhưng','hay','hoặc','cũng','đã','sẽ','đang','bị','phân',
      'biệt','giải','thích','cách','dùng','sử','dụng','hỏi','đáp','tôi','biết',
      'xin','hãy','bạn','mình','ơi','ạ','nhé','nha','muốn','học','hiểu','ý','nghĩa',
    ]);
    const viKeywords = lastUser.content
      .replace(/[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ%_,()!?。、]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 2 && !VI_STOPS.has(w))
      .slice(0, 4);

    const hasJp = jpTokens.length >= 1;
    const hasVi = viKeywords.length > 0;

    if (hasJp || hasVi) {
      try {
        const vocabFilters = [];
        if (hasJp) {
          vocabFilters.push('kanji.ilike.%' + jpTokens + '%');
          vocabFilters.push('reading.ilike.%' + jpTokens + '%');
        }
        viKeywords.forEach(kw => vocabFilters.push('meaning_vi.ilike.%' + kw + '%'));

        const kanjiFilters = [];
        if (hasJp) kanjiFilters.push('character.ilike.%' + jpTokens + '%');
        viKeywords.forEach(kw => kanjiFilters.push('meaning_vi.ilike.%' + kw + '%'));

        const [{ data: vocabs }, { data: kanjis }] = await Promise.all([
          supabaseAdmin.from('vocabulary')
            .select('id,kanji,reading,meaning_vi,meaning_ja,level,type,example_sentence')
            .or(vocabFilters.join(','))
            .limit(5),
          supabaseAdmin.from('kanji')
            .select('id,character,reading_on,reading_kun,meaning_vi,level,stroke_count')
            .or(kanjiFilters.join(','))
            .limit(3),
        ]);

        ctxVocabs = vocabs || [];
        ctxKanjis = kanjis || [];

        if (ctxVocabs.length) {
          contextText += '\n\n[DỮ LIỆU TỪ VỰNG HỆ THỐNG]\n' +
            ctxVocabs.map(v =>
              '• ' + (v.kanji || '—') + ' (' + v.reading + '): ' + v.meaning_vi +
              ' [' + (v.level || '?') + ', ' + (v.type || '?') + ']' +
              (v.example_sentence ? ' — VD: ' + v.example_sentence : '')
            ).join('\n');
        }
        if (ctxKanjis.length) {
          contextText += '\n\n[DỮ LIỆU KANJI HỆ THỐNG]\n' +
            ctxKanjis.map(k => {
              const on  = Array.isArray(k.reading_on)  ? k.reading_on.join('、')  : (k.reading_on  || '—');
              const kun = Array.isArray(k.reading_kun) ? k.reading_kun.join('、') : (k.reading_kun || '—');
              return '• ' + k.character + ': on-yomi=' + on + ', kun-yomi=' + kun +
                ' — ' + k.meaning_vi + ' [' + (k.level || '?') + ', ' + (k.stroke_count || '?') + ' nét]';
            }).join('\n');
        }
      } catch (_) { /* bỏ qua lỗi DB */ }
    }
  }

  const SYSTEM = 'Bạn là trợ lý học tiếng Nhật của nền tảng Kizuna Nihongo.\n\n' +
    'NHIỆM VỤ: Chỉ trả lời các câu hỏi liên quan đến tiếng Nhật — từ vựng, kanji, ngữ pháp, cách phát âm, JLPT, văn hóa Nhật Bản.\n' +
    'Nếu người dùng hỏi về chủ đề KHÔNG liên quan tiếng Nhật, hãy lịch sự từ chối và nhắc họ hỏi về tiếng Nhật.\n\n' +
    'QUY TẮC:\n' +
    '- Trả lời bằng tiếng Việt trừ khi người dùng yêu cầu ngôn ngữ khác.\n' +
    '- Khi giải thích từ vựng hoặc kanji, luôn cung cấp: chữ kanji, cách đọc (furigana), nghĩa tiếng Việt, ví dụ câu nếu có.\n' +
    '- Ưu tiên dùng dữ liệu từ hệ thống (phần [] bên dưới) để trả lời chính xác, nhất quán với nội dung học.\n' +
    '- Trả lời ngắn gọn, rõ ràng, thân thiện.' +
    contextText;

  // Build multimodal message list if image is present
  let aiMessages = trimmed;
  if (imageBase64) {
    const lastUserIdx = [...aiMessages].map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === 'user')?.i;
    if (lastUserIdx != null) {
      const userMsg = aiMessages[lastUserIdx];
      const multimodalContent = [];
      if (userMsg.content && userMsg.content.trim())
        multimodalContent.push({ type: 'text', text: userMsg.content });
      else
        multimodalContent.push({ type: 'text', text: 'Hãy phân tích hình ảnh này và trả lời bằng tiếng Việt.' });
      multimodalContent.push({
        type: 'image_url',
        image_url: { url: 'data:' + (imageType || 'image/jpeg') + ';base64,' + imageBase64 },
      });
      aiMessages = [
        ...aiMessages.slice(0, lastUserIdx),
        { role: 'user', content: multimodalContent },
        ...aiMessages.slice(lastUserIdx + 1),
      ];
    }
  }

  try {
    const result = await chatCompletion(
      [{ role: 'system', content: SYSTEM }, ...aiMessages],
      { max_tokens: 1024, temperature: 0.7 }
    );
    const reply = result.choices?.[0]?.message?.content || '';

    // Save assistant message + update session timestamp
    await Promise.all([
      supabaseAdmin.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: reply,
        context_items: (ctxVocabs.length || ctxKanjis.length)
          ? { vocabs: ctxVocabs, kanjis: ctxKanjis }
          : null,
      }),
      supabaseAdmin.from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId),
    ]);

    res.json({
      reply,
      contextItems: { vocabs: ctxVocabs, kanjis: ctxKanjis },
      sessionId,
      usage: result.usage,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;

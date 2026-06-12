'use strict';

const wanakana = require('wanakana');
const { supabaseAdmin } = require('../config/supabase');

// Bảng từ điển nằm trong schema riêng dictionary_module — mọi truy vấn dùng client này
const dictDb = supabaseAdmin.schema('dictionary_module');

const KANA_REGEX  = /[぀-ヿ]/;
const KANJI_REGEX = /[一-龯]/;
const KANJI_GLOBAL_REGEX = /[一-龯]/g;

// GET /api/dictionary/search
exports.search = async (req, res) => {
  const { q = '', level, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const term = q.trim();

  if (!term) return res.json({ data: [], total: 0, page: Number(page), limit: Number(limit) });

  try {
    let query = dictDb.from('dict_entries')
      .select('id, kanji, kana, romaji, jlpt_level', { count: 'exact' })
      .order('is_common', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level) query = query.eq('jlpt_level', level);

    if (KANA_REGEX.test(term) || KANJI_REGEX.test(term)) {
      // Hiragana/Katakana/Kanji: tìm trực tiếp theo kana hoặc kanji
      query = query.or(`kana.ilike.${term}%,kanji.ilike.${term}%`);
    } else if (/^[a-zA-Z\s]+$/.test(term)) {
      // Romaji: convert sang hiragana rồi tìm theo kana hoặc romaji
      const kana = wanakana.toHiragana(term);
      query = query.or(`kana.ilike.${kana}%,romaji.ilike.${term}%`);
    } else {
      // Tiếng Việt: tìm theo nghĩa qua RPC (khớp nguyên từ, ưu tiên đúng dấu, đã xếp hạng)
      const { data: senseRows, error: senseErr } = await dictDb
        .rpc('search_dict_by_meaning', { p_query: term, p_limit: Number(limit), p_offset: offset });
      if (senseErr) throw senseErr;

      // RPC đã trả entry_id theo đúng thứ hạng — giữ nguyên thứ tự này
      const entryIds = [...new Set((senseRows || []).map(r => r.entry_id))];
      if (entryIds.length === 0) return res.json({ data: [], total: 0, page: Number(page), limit: Number(limit) });

      let viQuery = dictDb.from('dict_entries')
        .select('id, kanji, kana, romaji, jlpt_level', { count: 'exact' })
        .in('id', entryIds);
      if (level) viQuery = viQuery.eq('jlpt_level', level);

      const { data, error, count } = await viQuery;
      if (error) throw error;

      // .in() không bảo toàn thứ tự — sắp xếp lại theo thứ hạng của RPC
      const rankByEntry = new Map(entryIds.map((id, i) => [id, i]));
      const ordered = (data || []).slice().sort((a, b) => rankByEntry.get(a.id) - rankByEntry.get(b.id));

      const dataWithMeaning = await attachMeaningPreview(ordered);
      return res.json({ data: dataWithMeaning, total: count, page: Number(page), limit: Number(limit) });
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const dataWithMeaning = await attachMeaningPreview(data);
    res.json({ data: dataWithMeaning, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Dictionary search error:', err);
    res.status(500).json({ error: 'Không thể tra cứu từ điển.' });
  }
};

// Gắn nghĩa tiếng Việt đầu tiên (preview) cho mỗi entry trong danh sách kết quả
async function attachMeaningPreview(entries) {
  if (!entries || entries.length === 0) return [];

  const entryIds = entries.map(e => e.id);
  const { data: senses, error } = await dictDb
    .from('dict_senses')
    .select('entry_id, meaning_vi, order_index')
    .in('entry_id', entryIds)
    .order('order_index', { ascending: true });
  if (error) throw error;

  const previewByEntry = {};
  for (const sense of senses || []) {
    if (!(sense.entry_id in previewByEntry)) previewByEntry[sense.entry_id] = sense.meaning_vi;
  }

  return entries.map(e => ({ ...e, meaning_vi: previewByEntry[e.id] || null }));
}

// GET /api/dictionary/:id
exports.getOne = async (req, res) => {
  try {
    const { data: entry, error: entryErr } = await dictDb
      .from('dict_entries')
      .select('id, kanji, kana, romaji, jlpt_level')
      .eq('id', req.params.id)
      .single();
    if (entryErr || !entry) return res.status(404).json({ error: 'Không tìm thấy từ.' });

    const { data: senses, error: sensesErr } = await dictDb
      .from('dict_senses')
      .select('id, pos, meaning_vi, order_index')
      .eq('entry_id', entry.id)
      .order('order_index', { ascending: true });
    if (sensesErr) throw sensesErr;

    const senseIds = (senses || []).map(s => s.id);
    let examplesBySense = {};
    if (senseIds.length > 0) {
      const { data: examples, error: examplesErr } = await dictDb
        .from('dict_examples')
        .select('id, sense_id, sentence_jp, sentence_vi, furigana')
        .in('sense_id', senseIds);
      if (examplesErr) throw examplesErr;

      examplesBySense = (examples || []).reduce((acc, ex) => {
        (acc[ex.sense_id] = acc[ex.sense_id] || []).push(ex);
        return acc;
      }, {});
    }

    const sensesWithExamples = (senses || []).map(s => ({
      ...s,
      examples: examplesBySense[s.id] || [],
    }));

    // Phân tích từng ký tự kanji trong từ -> âm Hán Việt
    const kanjiChars = [...new Set((entry.kanji || '').match(KANJI_GLOBAL_REGEX) || [])];
    let kanjiBreakdown = [];
    if (kanjiChars.length > 0) {
      const { data: kanjiData, error: kanjiErr } = await dictDb
        .from('dict_kanji')
        .select('character, sino_vi, meaning_vi, reading_on, reading_kun')
        .in('character', kanjiChars);
      if (kanjiErr) throw kanjiErr;
      kanjiBreakdown = kanjiData || [];
    }

    // Từ liên quan
    const { data: relatedRows, error: relatedErr } = await dictDb
      .from('dict_related_words')
      .select('related_id, relation_type')
      .eq('entry_id', entry.id);
    if (relatedErr) throw relatedErr;

    let related = [];
    const relatedIds = (relatedRows || []).map(r => r.related_id);
    if (relatedIds.length > 0) {
      const { data: relatedEntries, error: relatedEntriesErr } = await dictDb
        .from('dict_entries')
        .select('id, kanji, kana, jlpt_level')
        .in('id', relatedIds);
      if (relatedEntriesErr) throw relatedEntriesErr;

      const relatedWithMeaning = await attachMeaningPreview(relatedEntries);
      const relationByEntry = (relatedRows || []).reduce((acc, r) => {
        acc[r.related_id] = r.relation_type;
        return acc;
      }, {});
      related = relatedWithMeaning.map(e => ({ ...e, relation_type: relationByEntry[e.id] }));
    }

    res.json({
      ...entry,
      senses: sensesWithExamples,
      kanji_breakdown: kanjiBreakdown,
      related,
    });
  } catch (err) {
    console.error('Dictionary getOne error:', err);
    res.status(500).json({ error: 'Không thể tải chi tiết từ.' });
  }
};

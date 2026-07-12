import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import api from '../../lib/api';
import { useLang } from '../../contexts/LangContext';
import { translatePos } from '../../lib/posLabels';

const NEW_SET = '__new__';

// Dựng định nghĩa điền sẵn: dòng đầu 【kana】 (nếu từ có kanji), sau đó nghĩa đánh số kèm loại từ,
// mỗi nghĩa kèm 1 câu ví dụ đầu tiên (nếu có) + bản dịch tiếng Việt của câu (nếu có).
function buildDefinition(entry) {
  const lines = [];
  if (entry.kanji && entry.kana) lines.push(`【${entry.kana}】`);
  const senses = (entry.senses || []).filter(s => s.meaning_vi);
  const multi = senses.length > 1;
  senses.forEach((s, i) => {
    const pos    = translatePos(s.pos);
    const prefix = multi ? `${i + 1}. ` : '';
    lines.push(pos ? `${prefix}(${pos}) ${s.meaning_vi}` : `${prefix}${s.meaning_vi}`);

    // Câu ví dụ đầu tiên của nghĩa (nếu có)
    const ex = (s.examples || [])[0];
    if (ex?.sentence_jp) {
      lines.push(`   例: ${ex.sentence_jp}`);
      if (ex.sentence_vi) lines.push(`       ${ex.sentence_vi}`);
    }
  });
  return lines.join('\n').trim();
}

export default function AddToFlashcardModal({ entry, open, onClose }) {
  const { t } = useLang();
  const [term, setTerm]             = useState('');
  const [definition, setDefinition] = useState('');
  const [sets, setSets]             = useState([]);
  const [target, setTarget]         = useState(NEW_SET); // id set có sẵn | NEW_SET
  const [query, setQuery]           = useState(''); // từ khóa lọc học phần
  const [newTitle, setNewTitle]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [savedSetId, setSavedSetId] = useState(null); // id set vừa lưu thành công

  // Mỗi lần mở modal: điền sẵn từ entry + tải danh sách học phần của user
  useEffect(() => {
    if (!open || !entry) return;
    setTerm(entry.kanji || entry.kana || '');
    setDefinition(buildDefinition(entry));
    setNewTitle('');
    setQuery('');
    setError('');
    setSavedSetId(null);
    (async () => {
      try {
        const r = await api.get('/flashcards/sets');
        const list = r.data.data || [];
        setSets(list);
        setTarget(list.length ? list[0].id : NEW_SET);
      } catch (e) {
        setSets([]);
        setTarget(NEW_SET);
        setError(e.message);
      }
    })();
  }, [open, entry]);

  // Tự giãn chiều cao textarea theo nội dung
  const autoGrow = (elOrEvent) => {
    const el = elOrEvent?.target ?? elOrEvent;
    if (!el || !el.style) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const isNewSet  = target === NEW_SET;
  const canSave   = term.trim() && definition.trim() && (!isNewSet || newTitle.trim());

  const q = query.trim().toLowerCase();
  const filteredSets = q ? sets.filter(s => s.title.toLowerCase().includes(q)) : sets;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError('');
    try {
      if (isNewSet) {
        const r = await api.post('/flashcards/sets', {
          title: newTitle.trim(),
          cards: [{ term: term.trim(), definition: definition.trim() }],
        });
        setSavedSetId(r.data.data.id);
      } else {
        await api.post(`/flashcards/sets/${target}/cards`, {
          term: term.trim(), definition: definition.trim(),
        });
        setSavedSetId(target);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('dictionary.add_to_flashcards')} size="md"
      footer={savedSetId ? (
        <Button variant="secondary" onClick={onClose}>{t('dictionary.fc_close')}</Button>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>{t('dictionary.fc_cancel')}</Button>
          <Button onClick={handleSave} loading={saving} disabled={!canSave}>{t('dictionary.fc_save')}</Button>
        </>
      )}
    >
      {savedSetId ? (
        <div className="text-center space-y-4 py-4">
          <span className="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>
          <p className="font-medium text-charcoal">{t('dictionary.fc_saved')}</p>
          <Link to={`/flashcards/${savedSetId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-tsubaki-red hover:underline">
            {t('dictionary.fc_view_set')}
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

          <Input
            label={t('dictionary.fc_term')}
            value={term}
            onChange={e => setTerm(e.target.value)}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-on-muted">{t('dictionary.fc_definition')}</label>
            <textarea
              value={definition}
              onChange={e => setDefinition(e.target.value)}
              onInput={autoGrow}
              ref={autoGrow}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none whitespace-pre-wrap"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-on-muted">{t('dictionary.fc_choose_set')}</label>
            {sets.length > 0 && (
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('dictionary.fc_search_set')}
                className="w-full px-4 py-2.5 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all"
              />
            )}
            <div className="max-h-48 overflow-y-auto border border-outline rounded-xl divide-y divide-outline/40">
              <button
                type="button"
                onClick={() => setTarget(NEW_SET)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${isNewSet ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold' : 'hover:bg-surface-low text-charcoal'}`}
              >
                ➕ {t('dictionary.fc_new_set')}
              </button>
              {filteredSets.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTarget(s.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${target === s.id ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold' : 'hover:bg-surface-low text-charcoal'}`}
                >
                  {s.title}
                </button>
              ))}
              {sets.length > 0 && filteredSets.length === 0 && (
                <p className="px-4 py-2.5 text-sm text-on-muted">{t('dictionary.fc_no_set_found')}</p>
              )}
            </div>
          </div>

          {isNewSet && (
            <Input
              label={t('dictionary.fc_new_set_title')}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder={t('dictionary.fc_new_set_placeholder')}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

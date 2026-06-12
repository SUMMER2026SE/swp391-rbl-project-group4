import { useState } from 'react';
import FuriganaText from '../ui/FuriganaText';
import Modal from '../ui/Modal';
import SpeakButton from './SpeakButton';
import { useLang } from '../../contexts/LangContext';
import { translatePos } from '../../lib/posLabels';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

const KANJI_REGEX = /[一-龯]/g;

export default function WordDetail({ entry, onSelectRelated }) {
  const { t } = useLang();
  const [selectedKanji, setSelectedKanji] = useState(null);

  const kanjiMap = new Map((entry.kanji_breakdown || []).map(k => [k.character, k]));
  const hanViet = entry.kanji
    ? [...entry.kanji.matchAll(KANJI_REGEX)]
        .map(([ch]) => kanjiMap.get(ch)?.sino_vi?.split(',')[0]?.trim())
        .filter(Boolean)
        .join(' ')
        .toUpperCase()
    : '';

  const hasKanjiBreakdown = entry.kanji_breakdown?.length > 0;
  const hasRelated = entry.related?.length > 0;
  const hasSidebar = hasKanjiBreakdown || hasRelated;

  // Tách từ liên quan theo loại: trái nghĩa để riêng, còn lại gộp vào "liên quan"
  const antonyms     = (entry.related || []).filter(r => r.relation_type === 'antonym');
  const relatedWords = (entry.related || []).filter(r => r.relation_type !== 'antonym');

  const renderPills = (words) => (
    <div className="flex flex-wrap gap-2">
      {words.map(r => (
        <button
          key={r.id}
          type="button"
          onClick={() => onSelectRelated(r)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-surface-low text-charcoal hover:bg-tsubaki-red/10 hover:text-tsubaki-red transition-colors"
        >
          <span>{r.kanji || r.kana}</span>
          {r.meaning_vi && <span className="text-xs text-on-muted">— {r.meaning_vi}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className={`glass-card rounded-3xl p-6 md:p-8 space-y-6 ${hasSidebar ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
        {/* Headword */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-5xl font-bold text-tsubaki-red">{entry.kanji || entry.kana}</h2>
              <SpeakButton text={entry.kanji || entry.kana} />
            </div>
            {entry.kanji && (
              <p className="text-lg text-on-muted mt-1">
                {entry.kana}
                {hanViet && <span className="ml-2 font-semibold text-tsubaki-red">「{hanViet}」</span>}
              </p>
            )}
            {entry.romaji && <p className="text-sm text-on-muted">{entry.romaji}</p>}
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {entry.jlpt_level && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[entry.jlpt_level] || 'bg-surface-low text-on-muted'}`}>
                {entry.jlpt_level}
              </span>
            )}
          </div>
        </div>

        {/* Senses */}
        {entry.senses?.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-2">{t('dictionary.meanings')}</h3>
            <ol className="space-y-4">
              {entry.senses.map((sense, idx) => (
                <li key={sense.id} className="border-l-2 border-tsubaki-red/30 pl-4">
                  <p className="text-charcoal">
                    <span className="font-bold text-tsubaki-red mr-1">{idx + 1}.</span>
                    {sense.pos && <span className="text-xs px-2 py-0.5 rounded-full bg-surface-low text-on-muted mr-2 align-middle">{translatePos(sense.pos)}</span>}
                    <span className="font-semibold">{sense.meaning_vi}</span>
                  </p>

                  {sense.examples?.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {sense.examples.map(ex => (
                        <div key={ex.id} className="flex items-start gap-2 bg-surface-low rounded-xl px-4 py-2.5">
                          <div className="flex-1">
                            <FuriganaText text={ex.sentence_jp} html={ex.furigana || ''} enabled={!!ex.furigana} textClassName="text-lg text-charcoal [&_rt]:text-[0.6em] [&_rt]:font-normal" block />
                            {ex.sentence_vi && <p className="text-sm text-on-muted italic mt-1">{ex.sentence_vi}</p>}
                          </div>
                          <SpeakButton text={ex.sentence_jp} />
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Cột phải: Phân tích Hán tự + Từ liên quan */}
      {hasSidebar && (
        <div className="lg:col-span-4 space-y-5">
          {hasKanjiBreakdown && (
            <div className="glass-card rounded-3xl p-6 md:p-8">
              <h3 className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-2">{t('dictionary.kanji_breakdown')}</h3>
              <div className="grid grid-cols-1 gap-3">
                {entry.kanji_breakdown.map(k => (
                  <button
                    key={k.character}
                    type="button"
                    onClick={() => setSelectedKanji(k)}
                    className="flex items-center gap-4 border border-outline/30 rounded-2xl p-4 text-left w-full cursor-pointer hover:border-tsubaki-red/50 transition-colors"
                  >
                    <div className="shrink-0 text-center w-14">
                      <p className="text-4xl font-bold text-charcoal leading-none">{k.character}</p>
                      {k.sino_vi && <p className="text-[11px] font-semibold text-tsubaki-red mt-1">{k.sino_vi.toUpperCase()}</p>}
                    </div>
                    <div className="flex-1 min-w-0">
                      {k.meaning_vi && <p className="text-sm font-medium text-charcoal">{k.meaning_vi}</p>}
                      {(k.reading_on?.length > 0 || k.reading_kun?.length > 0) && (
                        <div className="text-xs text-on-muted mt-1 space-y-0.5">
                          {k.reading_on?.length > 0 && <p>{t('dictionary.on_reading')}: {k.reading_on.join('、')}</p>}
                          {k.reading_kun?.length > 0 && <p>{t('dictionary.kun_reading')}: {k.reading_kun.join('、')}</p>}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasRelated && (
            <div className="glass-card rounded-3xl p-6 md:p-8 space-y-4">
              {antonyms.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-2">{t('dictionary.antonyms')}</h3>
                  {renderPills(antonyms)}
                </div>
              )}
              {relatedWords.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-2">{t('dictionary.related_words')}</h3>
                  {renderPills(relatedWords)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Modal open={!!selectedKanji} onClose={() => setSelectedKanji(null)} size="sm" showHeader={false}>
        {selectedKanji && (
          <div className="text-center space-y-3">
            <p className="text-8xl font-bold text-charcoal">{selectedKanji.character}</p>
            {selectedKanji.sino_vi && <p className="text-xl font-semibold text-tsubaki-red">{selectedKanji.sino_vi.toUpperCase()}</p>}
            {selectedKanji.meaning_vi && <p className="text-base text-on-muted">{selectedKanji.meaning_vi}</p>}
            {(selectedKanji.reading_on?.length > 0 || selectedKanji.reading_kun?.length > 0) && (
              <div className="text-sm text-on-muted space-y-1">
                {selectedKanji.reading_on?.length > 0 && <p>{t('dictionary.on_reading')}: {selectedKanji.reading_on.join('、')}</p>}
                {selectedKanji.reading_kun?.length > 0 && <p>{t('dictionary.kun_reading')}: {selectedKanji.reading_kun.join('、')}</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

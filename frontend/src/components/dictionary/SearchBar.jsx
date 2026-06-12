import { useEffect, useRef, useState } from 'react';
import useDebounce from '../../hooks/useDebounce';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

export default function SearchBar({ onSelect, hero = false }) {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const term = debouncedQuery.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ q: term, limit: 8 });

    api.get(`/dictionary/search?${params}`)
      .then(r => {
        if (cancelled) return;
        setSuggestions(r.data.data || []);
        setOpen(true);
      })
      .catch(() => { if (!cancelled) setSuggestions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (entry) => {
    setOpen(false);
    setQuery(entry.kanji || entry.kana);
    onSelect(entry);
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${hero ? 'max-w-2xl' : 'max-w-xl'}`}>
      <div className="relative">
        <span className={`material-symbols-outlined absolute top-1/2 -translate-y-1/2 text-on-muted ${hero ? 'left-5 text-xl' : 'left-4 text-lg'}`}>search</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={t('dictionary.search_placeholder')}
          className={hero
            ? 'w-full pl-14 pr-6 py-4 bg-white border border-outline/20 rounded-full shadow-lg text-base outline-none focus:border-tsubaki-red transition-colors'
            : 'w-full pl-11 pr-4 py-3 border border-outline rounded-2xl text-sm outline-none focus:border-tsubaki-red transition-colors'}
        />
        {loading && (
          <span className={`material-symbols-outlined absolute top-1/2 -translate-y-1/2 text-on-muted animate-spin ${hero ? 'right-5 text-xl' : 'right-4 text-lg'}`}>progress_activity</span>
        )}
      </div>

      {open && (
        <div className="absolute z-40 mt-2 w-full bg-white rounded-2xl shadow-xl border border-outline/30 max-h-96 overflow-y-auto">
          {suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-on-muted">{t('dictionary.no_results')}</p>
          ) : (
            suggestions.map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleSelect(entry)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-low transition-colors border-b border-outline/10 last:border-b-0"
              >
                <div>
                  <p className="font-bold text-charcoal">
                    {entry.kanji || entry.kana}
                    {entry.kanji && <span className="ml-2 text-sm font-normal text-on-muted">{entry.kana}</span>}
                  </p>
                  {entry.meaning_vi && <p className="text-sm text-on-muted truncate max-w-xs">{entry.meaning_vi}</p>}
                </div>
                {entry.jlpt_level && (
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-bold bg-surface-low text-on-muted">{entry.jlpt_level}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

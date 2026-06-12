import { useState } from 'react';
import Alert from '../../components/ui/Alert';
import SearchBar from '../../components/dictionary/SearchBar';
import WordDetail from '../../components/dictionary/WordDetail';
import DictionaryHero from '../../components/dictionary/DictionaryHero';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

export default function DictionaryView() {
  const { t } = useLang();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadEntry = async (id) => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/dictionary/${id}`);
      setEntry(r.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {!entry && !loading ? (
        <DictionaryHero onSelect={(e) => loadEntry(e.id)} />
      ) : (
        <>
          <div className="mb-6">
            <SearchBar onSelect={(e) => loadEntry(e.id)} />
          </div>

          {loading ? (
            <div className="glass-card rounded-3xl p-8 animate-pulse h-64" />
          ) : (
            <WordDetail entry={entry} onSelectRelated={(r) => loadEntry(r.id)} />
          )}
        </>
      )}

      <p className="text-[11px] text-on-muted/70 text-center mt-8">{t('dictionary.attribution')}</p>
    </>
  );
}

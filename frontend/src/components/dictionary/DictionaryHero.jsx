import SearchBar from './SearchBar';
import { useLang } from '../../contexts/LangContext';

// Màn hình ban đầu của trang Từ điển: hero nền tranh thủy mặc + brand + ô tìm kiếm + thẻ chỉ số
export default function DictionaryHero({ onSelect }) {
  const { t } = useLang();

  const stats = [
    { icon: 'trending_up', value: '10k+',        label: t('dictionary.stat_kanji') },
    { icon: 'translate',   value: 'JLPT N1–N5',  label: t('dictionary.stat_vocab') },
    { icon: 'verified',    value: t('dictionary.stat_verified_value'), label: t('dictionary.stat_verified') },
  ];

  return (
    <div
      className="relative rounded-3xl overflow-hidden bg-surface-stone bg-cover bg-center min-h-[560px] md:min-h-[640px] flex flex-col"
      style={{ backgroundImage: "url('/dictionary-hero.png')" }}
    >
      {/* Lớp phủ trắng nhẹ giúp chữ dễ đọc trên nền tranh */}
      <div className="absolute inset-0 bg-white/15" />

      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-16 md:pt-20 flex-1">
        <h1 className="font-display text-5xl md:text-6xl font-bold text-tsubaki-red">{t('dictionary.brand')}</h1>
        <p className="text-on-muted mt-3 text-base md:text-lg">{t('dictionary.subtitle')}</p>

        <div className="w-full max-w-2xl mt-8">
          <SearchBar hero onSelect={onSelect} />
        </div>

        {/* Thẻ chỉ số gần đáy */}
        <div className="mt-auto w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 pb-12 pt-12">
          {stats.map(s => (
            <div key={s.label} className="glass-card rounded-2xl p-5 text-left">
              <span className="material-symbols-outlined text-tsubaki-red text-2xl">{s.icon}</span>
              <p className="font-display font-bold text-lg text-charcoal mt-2">{s.value}</p>
              <p className="text-xs text-on-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

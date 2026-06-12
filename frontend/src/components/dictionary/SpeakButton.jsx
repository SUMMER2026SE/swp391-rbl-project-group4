import { useLang } from '../../contexts/LangContext';

const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

export default function SpeakButton({ text, className = '' }) {
  const { t } = useLang();

  if (!isSupported || !text) return null;

  const speak = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={speak}
      title={t('dictionary.play_audio')}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors ${className}`}
    >
      <span className="material-symbols-outlined text-[20px]">volume_up</span>
    </button>
  );
}

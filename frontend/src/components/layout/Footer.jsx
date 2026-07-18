import { useLang } from '../../contexts/LangContext';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer id="footer" className="bg-surface-stone w-full border-t border-outline-variant/20">
      <div className="max-w-max-width-desktop mx-auto flex flex-col md:flex-row justify-between items-center px-gutter py-md">
        <div className="text-on-surface-variant font-body-md mb-4 md:mb-0">
          © 2026 Kizuna Nihongo. All rights reserved.
        </div>
        <div className="flex gap-lg">
          <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-on-surface hover:text-tsubaki-red transition-colors font-label-md">
            Facebook
          </a>
          <a href="mailto:contact@kizunanihongo.com" className="text-on-surface hover:text-tsubaki-red transition-colors font-label-md">
            Gmail
          </a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-on-surface hover:text-tsubaki-red transition-colors font-label-md">
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}

import { Link } from 'react-router-dom';
import { useLang } from '../../contexts/LangContext';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="bg-surface-stone w-full">
      <div className="max-w-max-width-desktop mx-auto grid grid-cols-1 md:grid-cols-4 gap-lg px-gutter py-xl">
        <div className="md:col-span-1">
          <div className="font-h2 text-h2 font-semibold text-tsubaki-red mb-md">Kizuna Nihongo</div>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {t('common.copyright')}
          </p>
        </div>
        <div>
          <h5 className="font-label-md text-label-md font-bold text-on-surface mb-md">{t('footer.product')}</h5>
          <ul className="space-y-sm">
            <li><a href="#features" className="font-body-md text-body-md text-on-surface-variant hover:text-sumire-purple transition-colors opacity-80 hover:opacity-100">{t('footer.ai_features')}</a></li>
            <li><a href="#courses"  className="font-body-md text-body-md text-on-surface-variant hover:text-sumire-purple transition-colors opacity-80 hover:opacity-100">{t('footer.jlpt_courses')}</a></li>
            <li><a href="#"         className="font-body-md text-body-md text-on-surface-variant hover:text-sumire-purple transition-colors opacity-80 hover:opacity-100">{t('footer.conversation')}</a></li>
          </ul>
        </div>
        <div>
          <h5 className="font-label-md text-label-md font-bold text-on-surface mb-md">{t('footer.explore')}</h5>
          <ul className="space-y-sm">
            <li><a href="#" className="font-body-md text-body-md text-on-surface-variant hover:text-sumire-purple transition-colors opacity-80 hover:opacity-100">{t('footer.cultural_blog')}</a></li>
            <li><a href="#" className="font-body-md text-body-md text-on-surface-variant hover:text-sumire-purple transition-colors opacity-80 hover:opacity-100">{t('footer.community')}</a></li>
            <li><a href="#" className="font-body-md text-body-md text-on-surface-variant hover:text-sumire-purple transition-colors opacity-80 hover:opacity-100">{t('footer.support')}</a></li>
          </ul>
        </div>
        <div>
          <h5 className="font-label-md text-label-md font-bold text-on-surface mb-md">{t('footer.legal')}</h5>
          <ul className="space-y-sm">
            <li><a href="#" className="font-body-md text-body-md text-on-surface-variant hover:text-sumire-purple transition-colors opacity-80 hover:opacity-100">{t('footer.privacy')}</a></li>
            <li><a href="#" className="font-body-md text-body-md text-on-surface-variant hover:text-sumire-purple transition-colors opacity-80 hover:opacity-100">{t('footer.terms')}</a></li>
          </ul>
          <div className="flex gap-md mt-lg">
            <span className="material-symbols-outlined text-on-surface-variant hover:text-tsubaki-red cursor-pointer transition-colors">public</span>
            <span className="material-symbols-outlined text-on-surface-variant hover:text-tsubaki-red cursor-pointer transition-colors">language</span>
            <span className="material-symbols-outlined text-on-surface-variant hover:text-tsubaki-red cursor-pointer transition-colors">alternate_email</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

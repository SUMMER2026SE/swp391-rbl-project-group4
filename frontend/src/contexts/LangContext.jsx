import { createContext, useContext, useState } from 'react';
import { t as translate } from '../lib/i18n';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'vi');

  const switchLang = (l) => {
    if (l === 'vi' || l === 'ja') {
      setLang(l);
      localStorage.setItem('lang', l);
    }
  };

  const t = (key) => translate(lang, key);

  return (
    <LangContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
};

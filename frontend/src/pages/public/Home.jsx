import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { useLang } from '../../contexts/LangContext';

// Constants removed as they are now hardcoded or fetched via translations

// Hook scroll reveal
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('visible'); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function Home() {
  const { t, lang } = useLang();
  const l = lang === 'ja' ? 'ja' : 'vi';

  const refMa       = useScrollReveal();
  const refAI       = useScrollReveal();
  const refCourses  = useScrollReveal();
  const refTestimon = useScrollReveal();
  const refCTA      = useScrollReveal();

  return (
    <div className="bg-surface-stone text-on-surface font-body-md selection:bg-tsubaki-red/10">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
          <img id="hero-img"
            className="w-full h-full object-cover brightness-105 saturate-110"
            src="/images/dragon_bridge_hero.png"
            alt="Dragon Bridge between Japan and Vietnam" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>
        <div className="relative z-10 max-w-max-width-desktop mx-auto px-gutter w-full">
          <div className="max-w-2xl mt-12 md:mt-0">
            <div className="inline-block px-4 py-1.5 rounded-full bg-tsubaki-red/20 backdrop-blur-md border border-tsubaki-red/30 mb-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <span className="font-label-md text-label-md font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-tsubaki-red animate-pulse shadow-[0_0_8px_rgba(255,0,0,1)]" />
                {t('index.hero_badge')}
              </span>
            </div>
            <h1 className="font-h1 text-display-mobile md:text-display text-white leading-tight mb-md drop-shadow-xl" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
              {t('index.hero_title1')} <span className="text-red-400 font-extrabold drop-shadow-[0_2px_15px_rgba(0,0,0,0.9)] whitespace-nowrap">{t('index.hero_title2')}</span>
            </h1>
            <p className="font-body-lg text-body-lg text-white/95 font-medium leading-relaxed max-w-xl mb-10 drop-shadow-lg" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
              {t('index.hero_desc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-md">
              <Link to="/register"
                className="bg-tsubaki-red text-on-primary px-8 py-4 rounded-lg font-label-md text-body-md shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-base">
                {t('index.hero_start')}
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
              <a href="#about"
                className="bg-surface-lowest text-charcoal-text border border-outline-variant/50 px-8 py-4 rounded-lg font-label-md text-body-md hover:bg-surface-stone transition-all active:scale-95 text-center">
                {t('index.hero_learn_more')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Personalized Path ────────────────────────────────────────────── */}
      <section id="path" className="ma-whitespace bg-surface-lowest relative overflow-hidden">
        <div ref={refMa} className="max-w-max-width-desktop mx-auto px-gutter text-center scroll-reveal relative z-10">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-h2 text-h1 md:text-headline-lg text-charcoal-text mb-sm">{t('index.ai_path_title')}</h2>
            <div className="w-16 h-1 bg-tsubaki-red mx-auto mb-md opacity-80" />
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-12">
              {t('index.ai_path_desc')}
            </p>
            
            <div className="grid md:grid-cols-3 gap-md text-left mt-md">
              {/* Step 1 */}
              <div className="relative p-md rounded-2xl bg-white border border-outline-variant/30 hover:border-tsubaki-red/50 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="absolute -right-2 -bottom-4 text-[100px] font-display font-bold text-tsubaki-red/5 group-hover:text-tsubaki-red/10 transition-colors leading-none z-0 select-none">1</div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-tsubaki-red/10 flex items-center justify-center mb-md group-hover:bg-tsubaki-red group-hover:text-white transition-colors duration-300">
                    <span className="material-symbols-outlined text-tsubaki-red group-hover:text-white text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>query_stats</span>
                  </div>
                  <h3 className="font-h2 text-h3 mb-xs text-charcoal-text">{t('index.ai_path_step1_title')}</h3>
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">{t('index.ai_path_step1_desc')}</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative p-md rounded-2xl bg-white border border-outline-variant/30 hover:border-tsubaki-red/50 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="absolute -right-2 -bottom-4 text-[100px] font-display font-bold text-tsubaki-red/5 group-hover:text-tsubaki-red/10 transition-colors leading-none z-0 select-none">2</div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-tsubaki-red/10 flex items-center justify-center mb-md group-hover:bg-tsubaki-red group-hover:text-white transition-colors duration-300">
                    <span className="material-symbols-outlined text-tsubaki-red group-hover:text-white text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>route</span>
                  </div>
                  <h3 className="font-h2 text-h3 mb-xs text-charcoal-text">{t('index.ai_path_step2_title')}</h3>
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">{t('index.ai_path_step2_desc')}</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative p-md rounded-2xl bg-white border border-outline-variant/30 hover:border-tsubaki-red/50 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="absolute -right-2 -bottom-4 text-[100px] font-display font-bold text-tsubaki-red/5 group-hover:text-tsubaki-red/10 transition-colors leading-none z-0 select-none">3</div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-tsubaki-red/10 flex items-center justify-center mb-md group-hover:bg-tsubaki-red group-hover:text-white transition-colors duration-300">
                    <span className="material-symbols-outlined text-tsubaki-red group-hover:text-white text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>monitoring</span>
                  </div>
                  <h3 className="font-h2 text-h3 mb-xs text-charcoal-text">{t('index.ai_path_step3_title')}</h3>
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">{t('index.ai_path_step3_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 Skills AI Features ──────────────────────────────────────────────── */}
      <section id="features" className="ma-whitespace bg-surface-stone relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sumire-purple/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-tsubaki-red/5 rounded-full blur-[120px]" />
        <div ref={refAI} className="max-w-max-width-desktop mx-auto px-gutter relative z-10 scroll-reveal">
          <div className="grid lg:grid-cols-2 gap-xl items-center">
            <div className="order-2 lg:order-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-sm relative">
                {/* Luyện Nghe */}
                <div className="bg-white p-md rounded-2xl shadow-sm border border-outline-variant/20 hover:shadow-md hover:border-tsubaki-red/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-tsubaki-red/10 flex items-center justify-center mb-sm group-hover:bg-tsubaki-red transition-colors duration-300">
                    <span className="material-symbols-outlined text-tsubaki-red group-hover:text-white text-xl">headphones</span>
                  </div>
                  <h4 className="font-h2 text-body-lg text-charcoal-text font-bold mb-1">{t('index.skill_listen_title')}</h4>
                  <p className="font-body-md text-sm text-on-surface-variant leading-snug">{t('index.skill_listen_desc')}</p>
                </div>

                {/* Luyện Nói */}
                <div className="bg-white p-md rounded-2xl shadow-sm border border-outline-variant/20 hover:shadow-md hover:border-tsubaki-red/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-tsubaki-red/10 flex items-center justify-center mb-sm group-hover:bg-tsubaki-red transition-colors duration-300">
                    <span className="material-symbols-outlined text-tsubaki-red group-hover:text-white text-xl">mic</span>
                  </div>
                  <h4 className="font-h2 text-body-lg text-charcoal-text font-bold mb-1">{t('index.skill_speak_title')}</h4>
                  <p className="font-body-md text-sm text-on-surface-variant leading-snug">{t('index.skill_speak_desc')}</p>
                </div>

                {/* Luyện Đọc */}
                <div className="bg-white p-md rounded-2xl shadow-sm border border-outline-variant/20 hover:shadow-md hover:border-tsubaki-red/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-tsubaki-red/10 flex items-center justify-center mb-sm group-hover:bg-tsubaki-red transition-colors duration-300">
                    <span className="material-symbols-outlined text-tsubaki-red group-hover:text-white text-xl">menu_book</span>
                  </div>
                  <h4 className="font-h2 text-body-lg text-charcoal-text font-bold mb-1">{t('index.skill_read_title')}</h4>
                  <p className="font-body-md text-sm text-on-surface-variant leading-snug">{t('index.skill_read_desc')}</p>
                </div>

                {/* Luyện Viết */}
                <div className="bg-white p-md rounded-2xl shadow-sm border border-outline-variant/20 hover:shadow-md hover:border-tsubaki-red/30 transition-all duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-tsubaki-red/10 flex items-center justify-center mb-sm group-hover:bg-tsubaki-red transition-colors duration-300">
                    <span className="material-symbols-outlined text-tsubaki-red group-hover:text-white text-xl">edit</span>
                  </div>
                  <h4 className="font-h2 text-body-lg text-charcoal-text font-bold mb-1">{t('index.skill_write_title')}</h4>
                  <p className="font-body-md text-sm text-on-surface-variant leading-snug">{t('index.skill_write_desc')}</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="font-display text-headline-lg md:text-display text-charcoal-text mb-md leading-tight">
                {t('index.ai_title1')} <span className="text-gradient-ai">{t('index.ai_sensei')}</span>
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-lg leading-relaxed">
                {t('index.ai_desc')}
              </p>
              <div className="bg-surface-lowest p-md rounded-lg border border-outline-variant/30 inline-flex items-center gap-base animate-pulse-soft">
                <div className="w-3 h-3 rounded-full bg-sumire-purple shadow-[0_0_10px_rgba(113,42,226,0.6)]" />
                <span className="font-label-md text-label-md text-sumire-purple font-semibold uppercase tracking-wider">
                  {t('index.ai_active')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

 

 

 

      <Footer />
    </div>
  );
}

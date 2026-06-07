import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { useLang } from '../../contexts/LangContext';

// Bilingual site data (từ models/siteData.js)
const PHILOSOPHY = {
  vi: [
    { icon: 'filter_center_focus', title: 'Tập trung tối đa', desc: 'Giao diện tối giản loại bỏ mọi xao nhãng, giúp bạn chìm đắm hoàn toàn vào bài học.' },
    { icon: 'auto_awesome_motion', title: 'Nhịp độ tự nhiên', desc: 'Lộ trình học được thiết kế để tạo ra những khoảng nghỉ thông minh cho não bộ.' },
    { icon: 'flare',               title: 'Sự minh triết',    desc: 'Chuyển hóa dữ liệu ngôn ngữ thành kiến thức sâu sắc thông qua sự tĩnh lặng.' },
  ],
  ja: [
    { icon: 'filter_center_focus', title: '最大限の集中', desc: 'ミニマルなインターフェースがすべての散漫を取り除き、レッスンに完全に没頭できます。' },
    { icon: 'auto_awesome_motion', title: '自然なリズム',  desc: '学習パスは脳のための賢い休憩を作り出すよう設計されています。' },
    { icon: 'flare',               title: '明晰さ',       desc: '静寂を通して言語データを深い知識へと変換します。' },
  ],
};

const AI_FEATURES = {
  vi: [
    { icon: 'psychology',   title: 'AI Sensei 24/7',      desc: 'Giải đáp mọi thắc mắc ngữ pháp ngay lập tức với sự tinh tế của người bản xứ.' },
    { icon: 'analytics',    title: 'Phân tích chuyên sâu', desc: 'Theo dõi tiến trình học qua biểu đồ trực quan, nhận biết điểm yếu cần khắc phục.', offset: true },
    { icon: 'graphic_eq',   title: 'Luyện giọng chuẩn',   desc: 'AI nhận diện giọng nói và chỉnh sửa phát âm chính xác từng âm tiết.' },
    { icon: 'history_edu',  title: 'Gợi ý lộ trình',      desc: 'Cá nhân hóa nội dung học dựa trên sở thích và tốc độ tiếp thu của bạn.', offset: true },
  ],
  ja: [
    { icon: 'psychology',   title: 'AI Sensei 24/7',  desc: 'ネイティブスピーカーの繊細さで文法の疑問に即座に答えます。' },
    { icon: 'analytics',    title: '詳細な分析',       desc: 'ビジュアルチャートで学習の進捗を追跡し、改善すべき弱点を特定します。', offset: true },
    { icon: 'graphic_eq',   title: '発音練習',         desc: 'AIが音声を認識し、各音節の発音を正確に修正します。' },
    { icon: 'history_edu',  title: '学習パスの提案',   desc: 'あなたの好みと習熟速度に基づいて学習コンテンツをパーソナライズします。', offset: true },
  ],
};

const TESTIMONIALS = {
  vi: [
    { text: 'Giao diện của Kizuna Nihongo thực sự giúp mình tĩnh tâm hơn khi học. AI Sensei giải thích ngữ pháp còn dễ hiểu hơn cả giáo viên thật.', name: 'Minh Anh',     level: 'JLPT N2 Level' },
    { text: 'Khóa học Business Japanese rất thực tế. Mình đã tự tin hơn hẳn khi đi phỏng vấn tại các công ty IT Nhật Bản.',                            name: 'Hoàng Nam',    level: 'Software Engineer' },
    { text: 'Sự kết hợp giữa Zen và AI là một bước đột phá. Không còn cảm giác bị áp lực bởi khối lượng kiến thức khổng lồ.',                          name: 'Thanh Hương',  level: 'Du học sinh' },
  ],
  ja: [
    { text: 'Kizuna Nihongoのインターフェースは学習中に本当に心を落ち着かせてくれます。AI Senseiの文法説明は実際の先生より分かりやすいです。', name: 'Minh Anh',    level: 'JLPT N2 レベル' },
    { text: 'ビジネス日本語コースはとても実践的です。日系IT企業の面接でずっと自信を持てるようになりました。',                                     name: 'Hoàng Nam',   level: 'ソフトウェアエンジニア' },
    { text: '禅とAIの組み合わせは画期的です。膨大な知識量に圧倒される感覚がなくなりました。',                                                     name: 'Thanh Hương', level: '留学生' },
  ],
};

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
            className="w-full h-full object-cover grayscale-[20%] brightness-95"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdSuGZ1dG3njptiDzP3CcddDaKbRFuf1Ckl5yaPQaIoV7GDA26vg_La2T_pt8LljlT8USQIDNZoWQ17XC2mIABsGGDFvic5eT8-2IrezooPyUmNylNuPlpuKYLocVotTfGF7lHvAg_E75ZLxjVAm7a67nNr-0Avl7lX9jWFt9vAXDrPHihkIo0-I6enwC7lwXM6eH4ERKmx7M-oG4J1VpmD8oL2nvSRH3panh4oMC7FJjs-Qhkwbaxt-9EZUcQJFtRxxRZwuWZjT-d"
            alt="Serene Japanese Zen garden" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface-stone/80 via-surface-stone/40 to-transparent" />
        </div>
        <div className="relative z-10 max-w-max-width-desktop mx-auto px-gutter w-full">
          <div className="max-w-2xl">
            <span className="inline-block px-4 py-1 rounded-full bg-tsubaki-red/10 text-tsubaki-red font-label-md text-label-md mb-md">
              {t('index.hero_badge')}
            </span>
            <h1 className="font-display text-display-mobile md:text-display text-charcoal-text mb-md leading-tight">
              {t('index.hero_title1')} <br />
              <span className="text-tsubaki-red">{t('index.hero_title2')}</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-lg leading-relaxed max-w-lg">
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

      {/* ── Ma Philosophy ────────────────────────────────────────────── */}
      <section id="about" className="ma-whitespace bg-surface-lowest">
        <div ref={refMa} className="max-w-max-width-desktop mx-auto px-gutter text-center scroll-reveal">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-h2 text-h1 md:text-display-mobile text-charcoal-text mb-lg">{t('index.ma_title')}</h2>
            <div className="w-16 h-1 bg-tsubaki-red mx-auto mb-lg opacity-30" />
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed mb-xl">
              {t('index.ma_desc')}
            </p>
            <div className="grid md:grid-cols-3 gap-lg text-left mt-xl">
              {PHILOSOPHY[l].map((point, i) => (
                <div key={i} className="p-lg rounded-xl transition-all duration-500 hover:bg-surface-stone/50">
                  <span className="material-symbols-outlined text-tsubaki-red text-4xl mb-md block" style={{ fontVariationSettings: "'FILL' 0" }}>
                    {point.icon}
                  </span>
                  <h3 className="font-h2 text-h2 mb-base">{point.title}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">{point.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI Features ──────────────────────────────────────────────── */}
      <section id="features" className="ma-whitespace bg-surface-stone relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sumire-purple/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-tsubaki-red/5 rounded-full blur-[120px]" />
        <div ref={refAI} className="max-w-max-width-desktop mx-auto px-gutter relative z-10 scroll-reveal">
          <div className="grid lg:grid-cols-2 gap-xl items-center">
            <div className="order-2 lg:order-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {AI_FEATURES[l].map((f, i) => (
                  <div key={i} className={`glass-purple p-lg rounded-xl ai-border-gradient${f.offset ? ' translate-y-[8px]' : ''}`}>
                    <span className="material-symbols-outlined text-sumire-purple mb-base block">{f.icon}</span>
                    <h4 className="font-h2 text-body-lg font-bold mb-xs">{f.title}</h4>
                    <p className="font-body-md text-caption opacity-80">{f.desc}</p>
                  </div>
                ))}
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

      {/* ── Courses Bento Grid ───────────────────────────────────────── */}
      <section id="courses" className="ma-whitespace bg-surface-lowest">
        <div ref={refCourses} className="max-w-max-width-desktop mx-auto px-gutter scroll-reveal">
          <div className="flex flex-col md:flex-row justify-between items-end mb-xl gap-md">
            <div className="max-w-xl">
              <h2 className="font-h2 text-h1 md:text-headline-lg text-charcoal-text mb-base">{t('index.courses_title')}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">{t('index.courses_sub')}</p>
            </div>
            <Link to="/courses" className="text-tsubaki-red font-label-md flex items-center gap-xs hover:gap-base transition-all">
              {t('index.view_all_courses')} <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-md h-auto md:h-[600px]">
            {/* JLPT N5-N3 */}
            <div className="md:col-span-2 md:row-span-1 group relative overflow-hidden rounded-xl bg-surface-stone border border-outline-variant/20 hover:shadow-xl transition-all duration-500">
              <img className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-700"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-S6pLrRsJCK6axBmeDyDKyTDOvACSE411-segYPxC6jnQn4QhvtS-WM3Eigy5nZ052FhigMlYnAaeZHnQDmMxgwFgT7pgOo7SaMoMUePl7B8Kc-pns2cBgG1pRTs_r0bxW9Az8uTaORnngQk454wNCkOHxi7U36rP4ebfKwjNNDCZdfTDsNcrds40gNQxUOTdTCaPRmpPXwOuxWExVf8IDd098McsFXmXFgRE1zOepishjxr3t135iq3aylYPwat-ROyw4hCcSiVz"
                alt="JLPT N5-N3" />
              <div className="relative p-lg h-full flex flex-col justify-end">
                <h4 className="font-h2 text-h2 mb-xs">JLPT N5 - N3</h4>
                <p className="font-body-md text-on-surface-variant">{t('index.course_n5n3_desc')}</p>
              </div>
            </div>
            {/* Business Japanese (featured) */}
            <div className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-xl bg-charcoal-text text-on-primary shadow-2xl">
              <img className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBPgZ7XquOQru5HW1OPYV34vqwKwE2jBtOMJJ6kCR5buw6ZaYEFvJHWpMse7KOervC9NuDSYfBnOfTM7Sutbl_XtBFaROQYTyw1O6JzxZ3p-BVLC0TQhLKHi0tCj3x0CgSxa3qjM1jSBhGYB_CFgu5JuFdXh9Vu_WCKm8Vpr4kmW80gSSn4PrEpC_GyPTHVZXLLqHv-5Z0j_oINxvX_BnO4qg-CP5hzmbo7LUY4J1RxAl2yR6u9cJR87wLf6FImfXhetQeEeq1oZ1Bq"
                alt="Business Japanese" />
              <div className="relative p-lg h-full flex flex-col justify-end">
                <span className="inline-block w-fit px-3 py-1 bg-tsubaki-red text-white text-caption rounded mb-md">Popular</span>
                <h4 className="font-h2 text-display-mobile mb-md">{t('index.course_business_title')}</h4>
                <p className="font-body-lg opacity-80 mb-lg">{t('index.course_business_desc')}</p>
                <Link to="/courses" className="w-fit bg-white text-charcoal-text px-6 py-2 rounded-full font-label-md hover:bg-surface-stone transition-colors">
                  {t('index.register_now')}
                </Link>
              </div>
            </div>
            {/* N2-N1 */}
            <div className="md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-xl bg-surface-stone border border-outline-variant/20 hover:shadow-xl transition-all duration-500">
              <div className="p-lg h-full flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-4xl text-tsubaki-red mb-base">workspace_premium</span>
                <h4 className="font-h2 text-h2 mb-xs">N2 - N1</h4>
                <p className="font-caption text-on-surface-variant">{t('index.peak_language')}</p>
              </div>
            </div>
            {/* Kanji */}
            <div className="md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-xl bg-tsubaki-red text-on-primary hover:shadow-xl transition-all duration-500">
              <div className="p-lg h-full flex flex-col justify-between">
                <div className="text-4xl font-bold opacity-20">漢字</div>
                <div>
                  <h4 className="font-h2 text-h2 mb-xs">Master Kanji</h4>
                  <p className="font-caption opacity-90">{t('index.kanji_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────── */}
      <section className="ma-whitespace bg-surface-stone border-y border-outline-variant/10">
        <div ref={refTestimon} className="max-w-max-width-desktop mx-auto px-gutter scroll-reveal">
          <div className="text-center mb-xl">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-md">
              {t('index.trusted_by')}
            </p>
            <div className="flex flex-wrap justify-center items-center gap-xl opacity-40 grayscale">
              {['NIKKEI','NHK','ASAHI','YOMIURI'].map(b => (
                <span key={b} className="font-display font-bold text-h2">{b}</span>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-lg">
            {TESTIMONIALS[l].map((item, i) => (
              <div key={i} className="bg-surface-lowest p-lg rounded-xl shadow-sm border border-outline-variant/10">
                <div className="flex gap-xs mb-md">
                  {[0,1,2,3,4].map(s => (
                    <span key={s} className="material-symbols-outlined text-tsubaki-red" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  ))}
                </div>
                <p className="font-body-md text-on-surface italic mb-lg leading-relaxed">"{item.text}"</p>
                <div className="flex items-center gap-base">
                  <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant font-bold">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-label-md text-label-md font-bold">{item.name}</div>
                    <div className="font-caption text-caption text-on-surface-variant">{item.level}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="ma-whitespace bg-surface-lowest relative overflow-hidden">
        <div ref={refCTA} className="max-w-max-width-desktop mx-auto px-gutter text-center relative z-10 scroll-reveal">
          <div className="max-w-2xl mx-auto py-lg px-md md:px-xl rounded-3xl bg-surface-stone border border-outline-variant/30 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-tsubaki-red/5 rounded-full blur-3xl" />
            <h2 className="font-h2 text-h1 md:text-headline-lg text-charcoal-text mb-md">{t('index.cta_title')}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-lg">{t('index.cta_desc')}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-md">
              <Link to="/register"
                className="bg-tsubaki-red text-on-primary px-10 py-4 rounded-full font-label-md text-body-md shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95">
                {t('index.cta_join')}
              </Link>
              <Link to="/register?trial=true"
                className="bg-white text-charcoal-text border border-outline px-10 py-4 rounded-full font-label-md text-body-md hover:bg-surface-stone transition-all active:scale-95">
                {t('index.cta_trial')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

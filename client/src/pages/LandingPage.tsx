import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Heart, EyeOff, Camera, Users, ArrowRight, CheckCircle2, Lock, BellRing, KeyRound, Pill, Sparkles, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, isCaregiver } = useAuth();

  const [phraseIndex, setPhraseIndex] = useState(0);

  const phrasesByLang: Record<string, string[]> = {
    hi: ['कभी अनसुने नहीं।', 'हमेशा सुरक्षित।', 'परिवार से जुड़े हुए।'],
    kn: ['ಎಂದಿಗೂ ಕಡೆಗಣಿಸುವುದಿಲ್ಲ.', 'ಯಾವಾಗಲೂ ಸುರಕ್ಷಿತ.', 'ಕುಟುಂಬದೊಂದಿಗೆ ಸಂಪರ್ಕ.'],
    en: ['Never unheard.', 'Always protected.', 'Connected to family.'],
  };

  const currentPhrases = phrasesByLang[i18n.language] || phrasesByLang.en;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % currentPhrases.length);
    }, 3600);
    return () => clearInterval(timer);
  }, [currentPhrases.length]);

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900 gradient-warm flex flex-col selection:bg-sarthak-200">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-surface-50/90 backdrop-blur-md border-b border-surface-200/80 px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Leftmost Corner: Brand & Subtitle */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-sarthak-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Shield size={22} className="stroke-[2.2]" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-surface-900 block leading-tight">
                Sarthak
              </span>
              <span className="text-xs sm:text-sm font-semibold text-surface-600 tracking-tight">
                Senior Safety &amp; Care Companion
              </span>
            </div>
          </Link>

          {/* Rightmost Corner: Language Switcher, Caregiver Portal, and Get Started */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher variant="pill" />

            {isAuthenticated ? (
              <Link
                to={isCaregiver ? "/dashboard" : "/companion"}
                className="btn-primary py-2 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold flex items-center gap-1.5"
              >
                <span>{isCaregiver ? t('landing.goToDashboard') : t('landing.goToCompanion')}</span>
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  to="/caregiver/login"
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-surface-800 hover:text-sarthak-800 bg-surface-100 hover:bg-surface-200 border border-surface-200/80 rounded-xl transition-colors shadow-2xs"
                >
                  <KeyRound size={15} className="text-sarthak-700" />
                  <span>{t('landing.caregiverPortalBtn')}</span>
                </Link>
                <Link
                  to="/register"
                  className="btn-primary py-2 px-3.5 sm:px-5 text-xs sm:text-sm font-bold shadow-sm"
                >
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative px-4 sm:px-8 pt-10 sm:pt-16 pb-16 sm:pb-24 overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sarthak-100 border border-sarthak-300 text-sarthak-800 text-xs sm:text-sm font-semibold tracking-wide shadow-2xs">
              <Heart size={14} className="text-sarthak-600 fill-sarthak-600" />
              <span>{t('landing.badge')}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-surface-900 tracking-tight leading-[1.15]">
              {t('landing.hero1')} <br />
              <span
                key={currentPhrases[phraseIndex % currentPhrases.length]}
                className="headline-phrase font-display italic text-sarthak-700"
              >
                <em>{currentPhrases[phraseIndex % currentPhrases.length]}</em>
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-surface-700 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
              {t('landing.heroDesc')}
            </p>

            {/* Action buttons (No shortcut/demo bypass) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <Link
                to="/register"
                className="btn-primary text-base sm:text-lg px-8 py-4 shadow-md hover:shadow-lg"
              >
                <span>{t('landing.getStartedSenior')}</span>
                <ArrowRight size={20} />
              </Link>
              <Link
                to="/caregiver/login"
                className="btn-secondary text-base sm:text-lg px-6 py-4 flex items-center justify-center gap-2.5 bg-white border border-surface-300 hover:border-sarthak-500 shadow-2xs"
              >
                <KeyRound size={18} className="text-sarthak-700" />
                <span>{t('landing.caregiverPortalBtn')}</span>
              </Link>
            </div>

            {/* Trust highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 text-left border-t border-surface-200/80">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-sarthak-600 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-surface-700 font-medium">{t('landing.trust1')}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-sarthak-600 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-surface-700 font-medium">{t('landing.trust2')}</span>
              </div>
              <div className="flex items-start gap-2.5 col-span-2 sm:col-span-1">
                <CheckCircle2 size={18} className="text-sarthak-600 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-surface-700 font-medium">{t('landing.trust3')}</span>
              </div>
            </div>
          </div>

          {/* CareCircle-Style Organic Arched Photo Frame (Authentic Non-AI Elder Connection) */}
          <div className="lg:col-span-5 relative flex justify-center items-center py-6 sm:py-8">
            <div className="relative flex justify-center items-center w-full min-h-[480px]">
              {/* Dashed ambient orbit rings */}
              <div className="hero-orbit hero-orbit--one" />
              <div className="hero-orbit hero-orbit--two" />

              {/* Sparkle playful doodle top left */}
              <div
                className="absolute -top-3 left-4 text-amber-500/80 z-20 pointer-events-none"
                style={{ animation: 'sparkle-drift 3.8s ease-in-out infinite' }}
              >
                <Sparkles size={28} />
              </div>

              {/* Top Right Floating Badge */}
              <div
                className="absolute -top-2 right-0 sm:-right-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 border border-surface-200 shadow-lg flex items-center gap-3"
                style={{ animation: 'gentle-float 4.5s ease-in-out infinite' }}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Shield size={18} className="stroke-[2.2]" />
                </div>
                <div>
                  <strong className="text-xs font-bold text-surface-900 block leading-tight">
                    Fall Guard Active
                  </strong>
                  <span className="text-[10px] font-semibold text-emerald-700 block mt-0.5">
                    Living Room • All Clear
                  </span>
                </div>
              </div>

              {/* The Organic Arched Photo Frame (Non-rectangular, authentic elder portrait) */}
              <div className="photo-frame">
                <img
                  src="/images/elderly_hero.jpg"
                  alt="A family member warmly embracing an older woman at home"
                  className="w-full h-full object-cover"
                />
                <div className="photo-wash" />

                {/* Subtle caption overlay inside the arched frame */}
                <div className="absolute bottom-4 left-4 right-4 z-10 text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold tracking-wide drop-shadow-md">
                    Always connected • Privacy protected
                  </span>
                </div>
              </div>

              {/* Bottom Left Floating Badge */}
              <div
                className="absolute -bottom-4 -left-2 sm:-left-6 z-20 bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 border border-surface-200 shadow-lg flex items-center gap-3"
                style={{ animation: 'gentle-float 4.5s ease-in-out 1.2s infinite' }}
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Pill size={18} />
                </div>
                <div>
                  <strong className="text-xs font-bold text-surface-900 block leading-tight">
                    Single-Lens Verified
                  </strong>
                  <span className="text-[10px] font-medium text-surface-600 block mt-0.5">
                    Hand-to-mouth adherence ✓
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3-Step "How It Works" Section ── */}
      <section id="how-it-works" className="px-4 sm:px-8 py-16 sm:py-20 bg-white border-y border-surface-200/70">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs sm:text-sm font-bold text-sarthak-700 uppercase tracking-wider block mb-2">
              {t('landing.gentleDesign')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900 tracking-tight">
              {t('landing.howItWorks')}
            </h2>
            <p className="text-base sm:text-lg text-surface-700 mt-3">
              {t('landing.howItWorksSub')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-surface-50 border border-surface-200 rounded-3xl p-7 shadow-2xs hover:shadow-md transition-all flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-sarthak-100 text-sarthak-700 flex items-center justify-center mb-6 shadow-2xs">
                <Camera size={28} className="stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-sarthak-800 uppercase tracking-wider mb-1">{t('landing.step1')}</div>
              <h3 className="text-xl font-bold text-surface-900 mb-2.5">
                {t('landing.step1Title')}
              </h3>
              <p className="text-surface-700 leading-relaxed text-sm sm:text-base flex-1">
                {t('landing.step1Desc')}
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-surface-50 border border-surface-200 rounded-3xl p-7 shadow-2xs hover:shadow-md transition-all flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-6 shadow-2xs">
                <Heart size={28} className="stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">{t('landing.step2')}</div>
              <h3 className="text-xl font-bold text-surface-900 mb-2.5">
                {t('landing.step2Title')}
              </h3>
              <p className="text-surface-700 leading-relaxed text-sm sm:text-base flex-1">
                {t('landing.step2Desc')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-surface-50 border border-surface-200 rounded-3xl p-7 shadow-2xs hover:shadow-md transition-all flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center mb-6 shadow-2xs">
                <Users size={28} className="stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-sky-800 uppercase tracking-wider mb-1">{t('landing.step3')}</div>
              <h3 className="text-xl font-bold text-surface-900 mb-2.5">
                {t('landing.step3Title')}
              </h3>
              <p className="text-surface-700 leading-relaxed text-sm sm:text-base flex-1">
                {t('landing.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Honest Privacy Section ── */}
      <section id="privacy" className="px-4 sm:px-8 py-16 sm:py-24 bg-surface-50">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white border-2 border-surface-200 rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 pb-6 border-b border-surface-200">
              <div className="w-12 h-12 rounded-2xl bg-sarthak-600 text-white flex items-center justify-center shrink-0">
                <Lock size={24} />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
                  {t('landing.privacyTitle')}
                </h2>
                <p className="text-surface-700 text-sm sm:text-base">
                  {t('landing.privacySub')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sarthak-800 font-bold text-base">
                  <EyeOff size={18} className="text-sarthak-600 shrink-0" />
                  <span>{t('landing.privacy1Title')}</span>
                </div>
                <p className="text-sm text-surface-700 leading-relaxed">
                  {t('landing.privacy1Desc')}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sarthak-800 font-bold text-base">
                  <Shield size={18} className="text-sarthak-600 shrink-0" />
                  <span>{t('landing.privacy2Title')}</span>
                </div>
                <p className="text-sm text-surface-700 leading-relaxed">
                  {t('landing.privacy2Desc')}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sarthak-800 font-bold text-base">
                  <BellRing size={18} className="text-sarthak-600 shrink-0" />
                  <span>{t('landing.privacy3Title')}</span>
                </div>
                <p className="text-sm text-surface-700 leading-relaxed">
                  {t('landing.privacy3Desc')}
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-2xl bg-sarthak-50 border border-sarthak-200 text-sarthak-900 text-sm flex items-center gap-3">
              <Shield size={20} className="text-sarthak-700 shrink-0" />
              <span>
                <strong>{t('landing.zeroSurprisesTitle')}:</strong> {t('landing.zeroSurprisesDesc')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Family Support & CTA Section ── */}
      <section id="support" className="px-4 sm:px-8 py-14 sm:py-20 bg-sarthak-700 text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-base sm:text-lg text-sarthak-100 max-w-2xl mx-auto font-normal">
            {t('landing.ctaDesc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-sarthak-800 font-bold text-base sm:text-lg shadow-md hover:bg-sarthak-50 hover:shadow-lg transition-all"
            >
              {t('landing.getStartedSenior')}
            </Link>
            <Link
              to="/caregiver/login"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-sarthak-800 hover:bg-sarthak-900 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 border border-sarthak-600 transition-all shadow-md"
            >
              <KeyRound size={20} />
              <span>{t('landing.caregiverPortalBtn')}</span>
            </Link>
          </div>

          <div className="pt-6">
            <p className="text-base sm:text-lg md:text-xl font-medium text-sarthak-100 max-w-2xl mx-auto leading-relaxed bg-sarthak-800/50 py-3.5 px-6 rounded-2xl border border-sarthak-600/60 inline-block shadow-sm">
              {t('landing.ctaEmail')}{' '}
              <a href="mailto:support@sarthak.care" className="underline font-bold text-white hover:text-sarthak-200 transition-colors">
                support@sarthak.care
              </a>{' '}
              — {t('landing.ctaResponseTime')}
            </p>
          </div>
        </div>

        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-black/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* ── Footer ── */}
      <footer className="bg-surface-50 border-t border-surface-200 py-8 px-4 sm:px-8 text-xs text-surface-700">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-bold text-surface-900">{t('landing.footerTitle')}</span>
            <p className="text-surface-700/80 mt-0.5">{t('landing.footerSub')}</p>
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:support@sarthak.care" className="hover:text-sarthak-700 transition-colors">
              support@sarthak.care
            </a>
            <Link to="/caregiver/login" className="hover:text-sarthak-700 transition-colors">
              {t('landing.caregiverPortalBtn')}
            </Link>
            <Link to="/login" className="hover:text-sarthak-700 transition-colors">
              {t('nav.login')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

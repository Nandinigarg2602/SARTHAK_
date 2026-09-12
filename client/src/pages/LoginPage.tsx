import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  HeartHandshake,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

interface LoginPageProps {
  initialMode?: 'login' | 'register';
}

export function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const { t, i18n } = useTranslation();
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<'login' | 'register'>(
    location.pathname.includes('register') ? 'register' : initialMode
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Caregiver invite modal state after successful registration
  const [caregiverInviteLink, setCaregiverInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (location.pathname.includes('register')) {
      setMode('register');
    } else {
      setMode('login');
    }
    setError('');
  }, [location.pathname]);

  const currentLang = i18n.language?.substring(0, 2) || 'en';

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    age: 72,
    phone: '',
    primaryLanguage: currentLang,
    // Caregiver details (mandatory for senior signup)
    caregiverFullName: '',
    caregiverPhone: '',
    caregiverEmail: '',
    caregiverRelationship: 'Daughter',
  });

  // Keep primaryLanguage synced if user switches language on this screen
  useEffect(() => {
    if (currentLang && currentLang !== formData.primaryLanguage) {
      setFormData((prev) => ({ ...prev, primaryLanguage: currentLang }));
    }
  }, [currentLang]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const user = await login(formData.email, formData.password);
        if (user.role === 'caregiver') {
          navigate('/dashboard');
        } else {
          navigate('/companion');
        }
      } else {
        // Senior registration with caregiver
        if (!formData.caregiverFullName || !formData.caregiverPhone || !formData.caregiverEmail) {
          setError(t('auth.caregiverRequiredErr'));
          setLoading(false);
          return;
        }

        const registered = await register({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          age: Number(formData.age) || 70,
          phone: formData.phone,
          primaryLanguage: formData.primaryLanguage,
          caregiver: {
            fullName: formData.caregiverFullName,
            phone: formData.caregiverPhone,
            email: formData.caregiverEmail,
            relationship: formData.caregiverRelationship,
          },
        });

        // If invite link is available, show modal so caregiver can be set up immediately
        const inviteLink = registered?.caregiverInviteLink;
        if (inviteLink) {
          setCaregiverInviteLink(inviteLink);
        } else {
          navigate('/companion');
        }
      }
    } catch (err: any) {
      const rawMsg = err.response?.data?.error || err.message || '';
      console.error('Auth error caught:', rawMsg);

      if (rawMsg.includes('already registered') || rawMsg.includes('exists')) {
        setError(t('auth.errAlreadyRegistered'));
      } else if (rawMsg) {
        setError(rawMsg);
      } else {
        setError(
          mode === 'login'
            ? t('auth.errInvalidCredentials')
            : t('auth.errRegistrationFailed')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!caregiverInviteLink) return;
    navigator.clipboard.writeText(caregiverInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface-50 text-surface-900 gradient-warm p-4 sm:p-6 py-10">
      {/* Top Bar with Language Switcher and Links */}
      <div className="w-full max-w-lg mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-surface-700 hover:text-sarthak-700 transition-colors py-1.5 px-3 rounded-xl hover:bg-surface-100"
        >
          <ArrowLeft size={16} />
          <span>{t('auth.backToHome')}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="compact" />
          <Link
            to="/caregiver/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sarthak-700 hover:underline py-1 px-2 rounded-lg bg-surface-100 hover:bg-surface-200"
          >
            <KeyRound size={14} />
            <span>{t('auth.caregiverPortalLink')}</span>
          </Link>
        </div>
      </div>

      <div className="w-full max-w-lg animate-slide-up">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-sarthak-600 text-white flex items-center justify-center shadow-md">
            <Shield size={28} className="stroke-[2.2]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
            {t('auth.seniorTitle')}
          </h1>
          <p className="text-surface-700 text-sm font-medium mt-1">
            {mode === 'login' ? t('auth.signInSub') : t('auth.registerSub')}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white border-2 border-surface-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-surface-100 p-1 mb-6 border border-surface-200">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                navigate('/login');
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'login'
                  ? 'bg-white text-sarthak-800 shadow-xs'
                  : 'text-surface-700 hover:text-surface-900'
              }`}
            >
              {t('auth.seniorSignIn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                navigate('/register');
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'register'
                  ? 'bg-white text-sarthak-800 shadow-xs'
                  : 'text-surface-700 hover:text-surface-900'
              }`}
            >
              {t('auth.seniorSignUp')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="pb-1 border-b border-surface-200">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-sarthak-800">
                    {t('auth.seniorInfoSection')}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                    {t('auth.seniorFullName')}
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Ramesh Patel"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                      {t('auth.age')}
                    </label>
                    <input
                      className="input-field"
                      type="number"
                      min={40}
                      max={115}
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                      {t('auth.primaryLanguage')}
                    </label>
                    <select
                      className="input-field bg-white font-medium"
                      value={formData.primaryLanguage}
                      onChange={(e) => setFormData({ ...formData, primaryLanguage: e.target.value })}
                    >
                      <option value="en">English</option>
                      <option value="hi">हिंदी (Hindi)</option>
                      <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                    {t('auth.seniorPhone')}
                  </label>
                  <input
                    className="input-field"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>

                {/* Section 2: Caregiver Provisioning */}
                <div className="pt-3 pb-1 border-b border-surface-200">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-sarthak-800">
                    {t('auth.caregiverSection')}
                  </span>
                  <p className="text-xs text-surface-600 mt-0.5">
                    {t('auth.caregiverSectionDesc')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                    {t('auth.caregiverFullName')}
                  </label>
                  <input
                    className="input-field"
                    placeholder="e.g. Pooja Patel"
                    value={formData.caregiverFullName}
                    onChange={(e) => setFormData({ ...formData, caregiverFullName: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                      {t('auth.caregiverPhone')}
                    </label>
                    <input
                      className="input-field"
                      type="tel"
                      placeholder="+91 98123 45678"
                      value={formData.caregiverPhone}
                      onChange={(e) => setFormData({ ...formData, caregiverPhone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                      {t('auth.relationship')}
                    </label>
                    <select
                      className="input-field bg-white font-medium"
                      value={formData.caregiverRelationship}
                      onChange={(e) => setFormData({ ...formData, caregiverRelationship: e.target.value })}
                    >
                      <option value="Daughter">{t('auth.relDaughter')}</option>
                      <option value="Son">{t('auth.relSon')}</option>
                      <option value="Spouse">{t('auth.relSpouse')}</option>
                      <option value="Sibling">{t('auth.relSibling')}</option>
                      <option value="Nurse / Aide">{t('auth.relNurse')}</option>
                      <option value="Other">{t('auth.relOther')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                    {t('auth.caregiverEmail')}
                  </label>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="pooja.patel@example.com"
                    value={formData.caregiverEmail}
                    onChange={(e) => setFormData({ ...formData, caregiverEmail: e.target.value })}
                    required
                  />
                </div>

                <div className="pt-2 pb-1 border-b border-surface-200">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-sarthak-800">
                    {t('auth.credentialsSection')}
                  </span>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                {t('auth.seniorEmail')}
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="senior@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  className="input-field pr-12"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-700 hover:text-surface-900 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm font-medium leading-relaxed animate-fade-in shadow-2xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base font-bold shadow-sm hover:shadow mt-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin mx-auto" />
              ) : mode === 'login' ? (
                t('auth.signInBtn')
              ) : (
                t('auth.registerBtn')
              )}
            </button>
          </form>

          {/* Caregiver Portal helper */}
          <div className="mt-6 pt-4 border-t border-surface-200 text-center">
            <p className="text-xs text-surface-600">
              {t('auth.caregiverPrompt')}{' '}
              <Link to="/caregiver/login" className="font-bold text-sarthak-700 hover:underline">
                {t('auth.signInCaregiver')}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Caregiver Activation Modal Dialog */}
      {caregiverInviteLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-2 border-sarthak-200 text-left space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <HeartHandshake size={26} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-surface-900">
                  {t('auth.modalTitle')}
                </h3>
                <p className="text-xs text-surface-600 mt-0.5">
                  {t('auth.modalSub')}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-surface-50 border border-surface-200 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                {t('auth.modalLink')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={caregiverInviteLink}
                  className="w-full text-xs font-mono bg-white p-2.5 rounded-xl border border-surface-200 text-surface-800 select-all"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-3 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-800 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedLink ? t('auth.modalCopied') : t('auth.modalCopy')}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => window.open(caregiverInviteLink, '_blank')}
                className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700"
              >
                <ExternalLink size={16} />
                <span>{t('auth.modalSetupNow')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/companion')}
                className="w-full py-3 text-sm font-bold text-surface-700 hover:text-surface-900 hover:bg-surface-100 rounded-xl transition-colors"
              >
                {t('auth.modalContinue')} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

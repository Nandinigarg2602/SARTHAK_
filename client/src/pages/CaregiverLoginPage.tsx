import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  HeartHandshake,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function CaregiverLoginPage() {
  const { t } = useTranslation();
  const { caregiverLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fallback setup/invite link retrieval section
  const [showRetrieveInvite, setShowRetrieveInvite] = useState(false);
  const [retrieveEmail, setRetrieveEmail] = useState('');
  const [retrieving, setRetrieving] = useState(false);
  const [retrieveError, setRetrieveError] = useState('');
  const [retrievedLink, setRetrievedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await caregiverLogin(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || t('auth.errInvalidCredentials');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retrieveEmail) return;

    setRetrieving(true);
    setRetrieveError('');
    setRetrievedLink(null);

    try {
      const res = await authAPI.requestCaregiverInvite(retrieveEmail);
      if (res.data.success && res.data.data?.inviteLink) {
        setRetrievedLink(res.data.data.inviteLink);
      } else {
        setRetrieveError(res.data.error || 'Unable to retrieve setup link.');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'No caregiver record found for this email.';
      setRetrieveError(errorMsg);
    } finally {
      setRetrieving(false);
    }
  };

  const copyRetrievedLink = () => {
    if (!retrievedLink) return;
    navigator.clipboard.writeText(retrievedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface-50 text-surface-900 gradient-warm p-4 sm:p-6 py-10">
      {/* Top Navigation & Language Switcher */}
      <div className="w-full max-w-md mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-surface-700 hover:text-sarthak-700 transition-colors py-1.5 px-3 rounded-xl hover:bg-surface-100"
        >
          <ArrowLeft size={16} />
          <span>{t('auth.backToHome')}</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher variant="compact" />
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sarthak-700 hover:underline py-1 px-2 rounded-lg bg-surface-100 hover:bg-surface-200"
          >
            <span>{t('auth.seniorLoginLink')}</span>
          </Link>
        </div>
      </div>

      <div className="w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md">
            <HeartHandshake size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
            {t('caregiver.portalTitle')}
          </h1>
          <p className="text-surface-700 text-sm font-medium mt-1">
            {t('caregiver.portalSub')}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white border-2 border-surface-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center gap-2.5 leading-relaxed">
            <KeyRound size={16} className="text-sky-700 shrink-0" />
            <span>
              {t('caregiver.portalNotice')}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                {t('caregiver.emailLabel')}
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="caregiver@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                {t('caregiver.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  className="input-field pr-12"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
              className="btn-primary w-full py-3.5 text-base font-bold shadow-sm hover:shadow mt-2 bg-sky-600 hover:bg-sky-700"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin mx-auto" />
              ) : (
                t('caregiver.signInBtn')
              )}
            </button>
          </form>

          {/* Direct Activation / SMS Fallback Section */}
          <div className="pt-4 border-t border-surface-200">
            <button
              type="button"
              onClick={() => {
                setShowRetrieveInvite(!showRetrieveInvite);
                setRetrieveError('');
                setRetrievedLink(null);
              }}
              className="w-full flex items-center justify-between text-left text-xs font-bold text-sky-800 hover:text-sky-950 p-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 transition-colors"
            >
              <span>{t('caregiver.firstTimePrompt')}</span>
              {showRetrieveInvite ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showRetrieveInvite && (
              <div className="mt-3 p-4 bg-surface-50 border border-surface-200 rounded-2xl space-y-3 animate-fade-in">
                <p className="text-xs text-surface-700 leading-relaxed font-medium">
                  {t('caregiver.requestInvitePrompt')}
                </p>

                <form onSubmit={handleRetrieveInvite} className="space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={retrieveEmail}
                      onChange={(e) => setRetrieveEmail(e.target.value)}
                      placeholder="caregiver@example.com"
                      className="input-field text-xs py-2 bg-white"
                      required
                    />
                    <button
                      type="submit"
                      disabled={retrieving}
                      className="btn-primary px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 shrink-0"
                    >
                      {retrieving ? (
                        <Loader2 size={14} className="animate-spin mx-auto" />
                      ) : (
                        t('caregiver.sendLinkBtn')
                      )}
                    </button>
                  </div>
                </form>

                {retrieveError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                    {retrieveError}
                  </div>
                )}

                {retrievedLink && (
                  <div className="p-3 bg-white border-2 border-emerald-300 rounded-xl space-y-2 animate-fade-in">
                    <p className="text-xs font-bold text-emerald-800">
                      ✓ {t('auth.modalTitle')}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={retrievedLink}
                        className="w-full text-xs font-mono bg-surface-50 p-1.5 rounded-lg border border-surface-200 select-all"
                      />
                      <button
                        type="button"
                        onClick={copyRetrievedLink}
                        className="p-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-700 shrink-0"
                        title={t('auth.modalCopy')}
                      >
                        {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.location.href = retrievedLink}
                      className="btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <ExternalLink size={13} />
                      <span>{t('auth.modalSetupNow')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

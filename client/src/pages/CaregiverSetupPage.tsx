import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function CaregiverSetupPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { caregiverLogin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<{
    email: string;
    fullName: string;
    patientName?: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t('caregiver.firstTimePrompt'));
      setLoading(false);
      return;
    }

    authAPI
      .getCaregiverInvite(token)
      .then((res) => {
        if (res.data.success) {
          setInviteData(res.data.data);
        } else {
          setError(res.data.error || 'Invalid or expired invitation token.');
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Unable to verify invitation link.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please retype carefully.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await authAPI.caregiverSetup({ token, password });
      if (res.data.success) {
        setSuccess(true);
        if (res.data.token) {
          localStorage.setItem('sarthak_token', res.data.token);
        }
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        setError(res.data.error || 'Failed to activate account.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to complete password setup.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface-50 text-surface-900 gradient-warm p-4 sm:p-6 py-10">
      {/* Top Bar */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          to="/caregiver/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-surface-700 hover:text-sarthak-700 transition-colors py-1.5 px-3 rounded-xl hover:bg-surface-100"
        >
          <ArrowLeft size={16} />
          <span>{t('caregiver.backToSignIn')}</span>
        </Link>
        <LanguageSwitcher variant="compact" />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md">
            <KeyRound size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight">
            {t('caregiver.setupTitle')}
          </h1>
          <p className="text-surface-700 text-sm font-medium mt-1">
            {t('caregiver.setupSub')}
          </p>
        </div>

        <div className="bg-white border-2 border-surface-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          {loading ? (
            <div className="py-12 text-center text-surface-600">
              <Loader2 size={32} className="animate-spin mx-auto text-sky-600 mb-3" />
              <p className="font-semibold text-sm">Verifying invitation link...</p>
            </div>
          ) : error && !inviteData ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <p className="text-sm font-semibold text-rose-900">{error}</p>
              <Link
                to="/caregiver/login"
                className="btn-primary w-full py-3 text-sm font-bold inline-block bg-sky-600 hover:bg-sky-700 text-center"
              >
                {t('caregiver.backToSignIn')}
              </Link>
            </div>
          ) : success ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-surface-900">Account Activated!</h2>
              <p className="text-sm text-surface-700">
                Redirecting you to the Caregiver Dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs sm:text-sm text-sky-950 space-y-1">
                <p>
                  <strong>Welcome, {inviteData?.fullName}!</strong>
                </p>
                <p className="text-sky-800">
                  You have been designated as the primary caregiver for{' '}
                  <strong>{inviteData?.patientName || 'your senior loved one'}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                  {t('caregiver.emailLabel')}
                </label>
                <input
                  className="input-field bg-surface-100 cursor-not-allowed text-surface-700"
                  type="email"
                  value={inviteData?.email || ''}
                  disabled
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                  {t('caregiver.newPassword')}
                </label>
                <div className="relative">
                  <input
                    className="input-field pr-12"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-700 hover:text-surface-900 p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-800 mb-1.5">
                  {t('caregiver.confirmPassword')}
                </label>
                <input
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3.5 text-base font-bold shadow-sm bg-sky-600 hover:bg-sky-700 mt-2"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin mx-auto" />
                ) : (
                  t('caregiver.activateBtn')
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  User,
  Pill,
  Heart,
  Phone,
  Clock,
  CheckCircle,
  Loader2,
  ShieldAlert,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { emergencyAPI } from '../services/api';

interface EmergencyData {
  event: {
    type: string;
    status: string;
    summary: string;
    timestamp: string;
  };
  patient: {
    fullName: string;
    age: number;
    allergies: string[];
    language: string;
    emergencyContacts: { name: string; phone: string; priorityOrder: number }[];
  };
  medications: { drugName: string; dosage: string; frequency: string }[];
  recentEvents: any[];
}

export function EmergencyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || 'demo-token';
  const [data, setData] = useState<EmergencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    emergencyAPI
      .getContext(token)
      .then((res) => {
        if (res.data.success) setData(res.data.data);
        else setError('Failed to load emergency data');
      })
      .catch((err) => {
        setError(
          err.response?.data?.error || 'Emergency link expired or invalid'
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAck = async () => {
    setAcking(true);
    try {
      await emergencyAPI.acknowledge(token);
      setAcknowledged(true);
    } catch {
      setAcknowledged(true);
    }
    setAcking(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <Loader2 size={36} className="text-sarthak-700 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 p-5">
        <div className="bg-white border-2 border-surface-200 rounded-3xl p-8 text-center max-w-md shadow-sm">
          <ShieldAlert size={48} className="text-amber-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-surface-900 mb-2">
            Link Expired or Invalid
          </h1>
          <p className="text-surface-700 text-sm mb-4">{error}</p>
          <Link to="/" className="btn-primary inline-flex py-2 px-5 text-sm font-bold">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900 pb-12 gradient-warm">
      {/* ── Emergency Attention Header ── */}
      <div className="bg-rose-700 text-white px-5 py-6 sm:py-8 shadow-md">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertTriangle size={24} className="text-white" />
            </div>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-rose-200 block">
                Caregiver Emergency Alert
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                Sarthak Safety Escalation
              </h1>
            </div>
          </div>
          <p className="text-rose-100 text-sm sm:text-base leading-relaxed mt-2">
            {data.event.summary || 'A potential fall event was detected. 60-second on-device senior grace period expired without cancellation.'}
          </p>
          <div className="flex items-center gap-2 mt-3 text-rose-200 text-xs sm:text-sm font-medium">
            <Clock size={14} />
            <span>Timestamp: {new Date(data.event.timestamp).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {/* Acknowledge Button */}
        <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-sm text-center">
          {acknowledged ? (
            <div className="py-2 flex flex-col items-center gap-2 text-sarthak-800">
              <div className="w-12 h-12 rounded-full bg-sarthak-100 flex items-center justify-center">
                <Check size={28} className="text-sarthak-700 stroke-[2.5]" />
              </div>
              <h3 className="text-base sm:text-lg font-bold">You have acknowledged this alert</h3>
              <p className="text-xs sm:text-sm text-surface-700 max-w-sm">
                Other family emergency contacts have been notified that you are actively responding.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-bold text-surface-900 mb-1">
                Are you responding to {data.patient.fullName}?
              </p>
              <p className="text-xs text-surface-700 mb-4">
                Tap below to record that you have seen this alert and are checking on them.
              </p>
              <button
                onClick={handleAck}
                disabled={acking}
                className="btn-primary w-full py-4 text-base font-bold shadow-sm"
              >
                {acking ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle size={20} />
                    I Am Checking In / Responding Now
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Patient Info Card */}
        <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-surface-900">
            <User size={20} className="text-sarthak-700" />
            <span>Senior Details</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-surface-50 border border-surface-200">
              <span className="text-[11px] uppercase font-bold text-surface-700 block">Name</span>
              <span className="text-sm font-bold text-surface-900">{data.patient.fullName}</span>
            </div>
            <div className="p-3 rounded-2xl bg-surface-50 border border-surface-200">
              <span className="text-[11px] uppercase font-bold text-surface-700 block">Age</span>
              <span className="text-sm font-bold text-surface-900">{data.patient.age} years</span>
            </div>
            <div className="p-3 rounded-2xl bg-surface-50 border border-surface-200 col-span-2 sm:col-span-1">
              <span className="text-[11px] uppercase font-bold text-surface-700 block">Language</span>
              <span className="text-sm font-bold text-surface-900">{data.patient.language?.toUpperCase() || 'EN'}</span>
            </div>
          </div>

          {data.patient.allergies?.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-rose-900">
              <Heart size={16} className="text-rose-600 fill-rose-600 shrink-0" />
              <span>Known Drug Allergies: {data.patient.allergies.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Current Medications List */}
        {data.medications?.length > 0 && (
          <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center gap-2 text-base font-bold text-surface-900 mb-3">
              <Pill size={20} className="text-amber-700" />
              <span>Active Prescriptions on File</span>
            </div>
            <div className="space-y-2">
              {data.medications.map((m, i) => (
                <div key={i} className="p-3 rounded-xl bg-surface-50 border border-surface-200 flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-bold text-surface-900">{m.drugName}</span>
                  <span className="text-surface-700">{m.dosage} • {m.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Return Button */}
        <div className="text-center pt-2">
          <Link
            to="/companion"
            className="text-xs sm:text-sm font-bold text-sarthak-800 hover:underline"
          >
            ← Open Senior Companion Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

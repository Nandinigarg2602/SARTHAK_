import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  Filter,
  Loader2,
  User,
  Heart,
  AlertTriangle,
  Shield,
  Phone,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { EventCard } from '../components/EventCard';
import { AdherenceChart } from '../components/AdherenceChart';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { alertAPI, adherenceAPI, userAPI } from '../services/api';
import type { SafetyEvent, AdherenceLog, User as UserType } from '../types';

type FilterType = 'all' | 'FALL_TRIGGER' | 'MISSED_MEDICATION' | 'DISTRESS_VOICE';

export function DashboardPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [adherenceLogs, setAdherenceLogs] = useState<AdherenceLog[]>([]);
  const [seniorProfile, setSeniorProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const eventSourceRef = useRef<EventSource | null>(null);

  const seniorId = user?.role === 'caregiver' ? (user.linkedPatientId || user.linkedSeniorId) : user?._id;

  // Fetch initial data
  useEffect(() => {
    if (!seniorId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [eventsRes, adherenceRes, profileRes] = await Promise.all([
          alertAPI.list(seniorId),
          adherenceAPI.list(seniorId),
          userAPI.get(seniorId),
        ]);

        if (eventsRes.data.success) setEvents(eventsRes.data.data);
        if (adherenceRes.data.success) setAdherenceLogs(adherenceRes.data.data);
        if (profileRes.data.success) setSeniorProfile(profileRes.data.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [seniorId]);

  // SSE for real-time updates (skipped in demo mode to prevent proxy errors)
  useEffect(() => {
    if (!seniorId) return;

    const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
    const token = localStorage.getItem('sarthak_token');
    if (!token || token === 'demo-token') return;

    const es = new EventSource(
      `${apiBase}/alerts/sse/${seniorId}?token=${token}`
    );

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat' || data.type === 'connected') return;

        if (data.type === 'adherence_logged' && data.data) {
          setAdherenceLogs((prev) => [data.data, ...prev.filter((l) => l._id !== data.data._id)]);
          return;
        }

        setEvents((prev) => [data, ...prev.filter((e) => e._id !== data._id)]);
      } catch {}
    };

    es.onerror = () => {
      // SSE will auto-reconnect
    };

    eventSourceRef.current = es;

    return () => {
      es.close();
    };
  }, [seniorId]);

  // Event actions
  const handleFalseAlarm = async (id: string) => {
    try {
      const res = await alertAPI.falseAlarm(id);
      if (res.data.success) {
        setEvents((prev) =>
          prev.map((e) =>
            e._id === id
              ? { ...e, isFalseAlarm: true, escalationStatus: 'VERIFIED_SAFE' as const }
              : e
          )
        );
      }
    } catch (err) {
      console.error('False alarm error:', err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const res = await alertAPI.resolve(id);
      if (res.data.success) {
        setEvents((prev) =>
          prev.map((e) =>
            e._id === id ? { ...e, escalationStatus: 'RESOLVED' as const } : e
          )
        );
      }
    } catch (err) {
      console.error('Resolve error:', err);
    }
  };

  const filteredEvents =
    filter === 'all'
      ? events
      : events.filter((e) => e.eventType === filter);

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All Records' },
    { value: 'FALL_TRIGGER', label: 'Falls' },
    { value: 'MISSED_MEDICATION', label: 'Missed Meds' },
    { value: 'DISTRESS_VOICE', label: 'Distress' },
  ];

  return (
    <div className="page-enter min-h-screen pb-28 gradient-warm text-surface-900">
      {/* ── One-Line Purpose Header ── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-surface-200/80 px-4 sm:px-8 py-3.5 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
                <LayoutDashboard size={18} />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-surface-900">
                Family & Caregiver Portal
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-surface-700 mt-0.5">
              Family Dashboard — Real-time adherence logs, peace-of-mind metrics, and event history.
            </p>
          </div>
          <LanguageSwitcher variant="pill" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Patient Profile Summary */}
        {seniorProfile && (
          <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-sarthak-100 text-sarthak-800 flex items-center justify-center shrink-0">
                  <User size={28} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-surface-900">
                    {seniorProfile.fullName}
                  </h2>
                  <p className="text-xs sm:text-sm text-surface-700">
                    Age {seniorProfile.age} • Independent Living • Preferred: {seniorProfile.primaryLanguage.toUpperCase()}
                  </p>
                  {seniorProfile.allergies.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-rose-800 font-semibold">
                      <Heart size={13} className="text-rose-600 fill-rose-600" />
                      <span>Allergies: {seniorProfile.allergies.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-left sm:text-right px-3 py-1.5 rounded-xl bg-surface-50 border border-surface-200">
                  <span className="text-[10px] uppercase font-bold text-surface-700 block">Status</span>
                  <span className="text-xs font-bold text-sarthak-800">Peaceful & Well</span>
                </div>
                <div className="text-left sm:text-right px-3 py-1.5 rounded-xl bg-surface-50 border border-surface-200">
                  <span className="text-[10px] uppercase font-bold text-surface-700 block">Contacts</span>
                  <span className="text-xs font-bold text-surface-900">{seniorProfile.emergencyContacts.length} on file</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Adherence Chart */}
        <AdherenceChart logs={adherenceLogs} days={7} />

        {/* Event Logs Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
            <div>
              <h3 className="text-base font-bold text-surface-900">Safety & Compliance Event History</h3>
              <p className="text-xs text-surface-700">Filter by category or mark resolved</p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${
                    filter === opt.value
                      ? 'bg-sarthak-600 text-white border-sarthak-600 shadow-2xs'
                      : 'bg-white text-surface-700 border-surface-200 hover:border-sarthak-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <Loader2 size={24} className="text-sarthak-700 animate-spin mx-auto mb-2" />
              <p className="text-xs text-surface-700">Loading safety records...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white border-2 border-surface-200 rounded-3xl p-8 text-center">
              <Shield size={36} className="text-sarthak-300 mx-auto mb-2" />
              <p className="font-bold text-surface-800">No events found in this view</p>
              <p className="text-xs text-surface-700 mt-1">Everything has been peaceful and normal.</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <EventCard
                key={event._id}
                event={event}
                onFalseAlarm={handleFalseAlarm}
                onResolve={handleResolve}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

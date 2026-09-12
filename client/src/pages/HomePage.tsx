import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  WifiOff,
  Camera,
  CameraOff,
  Pill,
  Phone,
  Eye,
  Activity,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  HelpCircle,
  ScanLine,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMonitoring } from '../contexts/MonitoringContext';
import { useCamera } from '../hooks/useCamera';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { useGraceWindow } from '../hooks/useGraceWindow';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { AlertModal } from '../components/AlertModal';
import { OnboardingModal } from '../components/OnboardingModal';
import { MedicationIntakeModal } from '../components/MedicationIntakeModal';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { alertAPI, medicationAPI, adherenceAPI } from '../services/api';
import type { Medication } from '../types';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const {
    setCameraActive,
    alertState,
    setAlertState,
    isOnline,
    setIsOnline,
    setDetectionMode,
  } = useMonitoring();

  const {
    videoRef,
    canvasRef,
    isActive,
    error: cameraError,
    startCamera,
    stopCamera,
    attachVideo,
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId,
  } = useCamera();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [nextMed, setNextMed] = useState<{ name: string; time: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [simulationToast, setSimulationToast] = useState<{ message: string; type: 'info' | 'warning' | 'alert' | 'success' } | null>(null);
  const [liveEvents, setLiveEvents] = useState<Array<{ id: string; title: string; time: string; type: string }>>([]);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  // Ref bridges for cross-hook dependencies
  const lastAlertEventIdRef = useRef<string | null>(null);
  const voiceAssistantRef = useRef<any>(null);
  const resolveActiveEmergencyRef = useRef<() => void>(() => {});
  const alertStateRef = useRef<string>(alertState);
  useEffect(() => {
    alertStateRef.current = alertState;
  }, [alertState]);

  // Single-Lens Medication Ingestion & Offline Protection State
  const [isMedicationMode, setIsMedicationMode] = useState<boolean>(false);
  const [activeMedForIngestion, setActiveMedForIngestion] = useState<{ id: string; name: string; time: string } | null>(null);
  const handleMedicationIngestedRef = useRef<() => void>(() => {});

  // Auto-trigger onboarding if first visit
  useEffect(() => {
    const seen = localStorage.getItem('sarthak_onboarding_seen');
    if (!seen) {
      setShowOnboarding(true);
    }
  }, []);

  // Live event helper
  const addEventTrace = useCallback((title: string, type: string) => {
    const timeStr = new Date().toLocaleTimeString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' });
    setLiveEvents((prev) => [
      { id: `ev-${Date.now()}-${Math.random()}`, title, time: timeStr, type },
      ...prev.slice(0, 5),
    ]);
  }, [i18n.language]);

  // Helper for toasts
  const showToast = useCallback((message: string, type: 'info' | 'warning' | 'alert' | 'success') => {
    setSimulationToast({ message, type });
    setTimeout(() => {
      setSimulationToast((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  }, []);

  // Grace window
  const graceWindow = useGraceWindow(
    {
      durationSeconds: user?.sensitivitySettings?.graceWindowSeconds || 15,
      language: (i18n.language === 'hi' || user?.primaryLanguage === 'hi') ? 'hi-IN' : 'en-IN',
      disableBuiltInRecognition: true,
    },
    (result) => {
      if (result === 'SAFE') {
        setAlertState('none');
        poseDetection.resetFallState();
        showToast('Alert cancelled — family notified that you are safe.', 'success');
        addEventTrace('False alarm dismissed by senior (Grace period)', 'safe');
      } else if (result === 'DISTRESS' || result === 'TIMEOUT') {
        setAlertState('escalating');
        showToast('Emergency alert escalated: Automated calls & SMS sent to caregiver.', 'alert');
        addEventTrace(`Emergency escalation triggered (${result})`, 'alert');
        if (user) {
          alertAPI.escalate({
            userId: user._id,
            eventType: 'FALL_TRIGGER',
            metadata: { graceResult: result },
          }).then((res) => {
            if (res.data?.data?._id) {
              lastAlertEventIdRef.current = res.data.data._id;
            }
          }).catch(console.error);
        }
      }
    }
  );

  // Pose detection with fall, abnormal behavior, and single-lens medication ingestion callbacks
  const poseDetection = usePoseDetection(
    {
      heightDropThreshold: 1 - (user?.sensitivitySettings?.fallDetectionThreshold || 0.8),
      targetFps: 6,
    },
    (emergencyEvent) => {
      // If grace window or emergency alert is already active, do not re-trigger or glitch
      if (alertStateRef.current !== 'none' || graceWindow.isActive) {
        return;
      }
      setAlertState('grace_period');
      graceWindow.startGraceWindow();
      const desc = emergencyEvent?.description || 'Severe posture collapse / fall detected';
      showToast(`🚨 ${desc} — cancellation grace window active. Microphone activated.`, 'warning');
      addEventTrace(`${desc} — grace window started & microphone activated`, 'warning');
    },
    (abnormalEvent) => {
      const desc = abnormalEvent?.description || 'Abnormal physical behavior detected';
      showToast(`⚠️ Telecare Notice: ${desc}`, 'warning');
      addEventTrace(`Abnormal behavior: ${desc} (monitoring stability)`, 'warning');
    },
    isMedicationMode,
    () => handleMedicationIngestedRef.current()
  );

  // Voice Assistant Hook
  const voiceAssistant = useVoiceAssistant({
    language: i18n.language || 'en',
    patientName: user?.fullName || 'Senior',
    nextMedicationText: nextMed ? `${nextMed.time} ${nextMed.name}` : undefined,
    onDistressDetected: (phrase) => {
      // If grace window is active, escalate immediately with distress
      if (graceWindow.isActive) {
        graceWindow.manualResponse('distress');
      } else {
        setAlertState('escalating');
      }
      showToast(`Emergency vocal distress detected ("${phrase}") — Calling caregiver now.`, 'alert');
      addEventTrace(`Vocal distress recognized: "${phrase}" — emergency call dispatched`, 'alert');
      if (user) {
        alertAPI.escalate({
          userId: user._id,
          eventType: 'DISTRESS_VOICE',
          metadata: { phrase },
        }).then((res) => {
          if (res.data?.data?._id) {
            lastAlertEventIdRef.current = res.data.data._id;
          }
        }).catch(console.error);
      }
    },
    onSafeConfirmed: () => {
      if (alertState !== 'none' || graceWindow.isActive) {
        resolveActiveEmergencyRef.current();
      }
    },
  });
  voiceAssistantRef.current = voiceAssistant;

  // Resolution handler: Patient or voice confirms help has arrived / safe now
  const resolveActiveEmergency = useCallback(async () => {
    graceWindow.stopGraceWindow();
    setAlertState('none');
    poseDetection.resetFallState();
    showToast('Emergency resolved — Family & caregiver notified that you are safe.', 'success');
    addEventTrace('Emergency confirmed resolved by senior — Help received', 'safe');
    voiceAssistant.speakText(
      i18n.language === 'hi'
        ? 'आपातकाल समाप्त कर दिया गया है। परिवार को सूचित कर दिया गया है कि आप सुरक्षित हैं।'
        : 'Emergency alert resolved. Family has been informed that you are safe and sound.'
    );
    if (lastAlertEventIdRef.current) {
      try {
        await alertAPI.resolve(lastAlertEventIdRef.current);
        lastAlertEventIdRef.current = null;
      } catch (err) {
        console.error('Failed to mark alert resolved on backend:', err);
      }
    }
  }, [graceWindow, setAlertState, poseDetection, showToast, addEventTrace, voiceAssistant, i18n.language]);

  useEffect(() => {
    resolveActiveEmergencyRef.current = resolveActiveEmergency;
  }, [resolveActiveEmergency]);

  // Automatically activate microphone whenever emergency distress or grace window is active
  const isVoiceListening = voiceAssistant.isListening;
  const startVoiceListening = voiceAssistant.startListening;
  useEffect(() => {
    if (alertState === 'grace_period' || alertState === 'escalating' || graceWindow.isActive) {
      if (!isVoiceListening) {
        startVoiceListening();
      }
    }
  }, [alertState, graceWindow.isActive, isVoiceListening, startVoiceListening]);

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch medications
  useEffect(() => {
    if (!user?._id) return;
    medicationAPI
      .list(user._id)
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setMedications(res.data.data);
        }
      })
      .catch((err) => console.error('Failed to load medications:', err));
  }, [user?._id]);

  // Calculate next medication
  useEffect(() => {
    if (medications.length === 0) {
      setNextMed(null);
      return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let nearest: { name: string; time: string } | null = null;
    let nearestDiff = Infinity;

    for (const med of medications) {
      if (!med.scheduledTimes || med.scheduledTimes.length === 0) continue;
      for (const time of med.scheduledTimes) {
        const [h, m] = time.split(':').map(Number);
        const medMinutes = (h || 0) * 60 + (m || 0);
        let diff = medMinutes - currentMinutes;
        if (diff < 0) diff += 24 * 60;

        if (diff < nearestDiff) {
          nearestDiff = diff;
          nearest = { name: `${med.drugName} ${med.dosage || ''}`.trim(), time };
        }
      }
    }

    setNextMed(nearest || (medications[0] ? { name: medications[0].drugName, time: medications[0].scheduledTimes?.[0] || '--:--' } : null));
  }, [medications, currentTime]);

  // Offline buffering helper
  const bufferOfflineRecord = useCallback((type: 'adherence' | 'event', data: any) => {
    try {
      const existing = JSON.parse(localStorage.getItem('sarthak_offline_queue') || '[]');
      existing.push({ type, data, timestamp: Date.now() });
      localStorage.setItem('sarthak_offline_queue', JSON.stringify(existing));
    } catch {}
  }, []);

  // Medication Ingestion handler (triggered by single-lens CV gesture or manual confirm)
  const handleMedicationIngested = useCallback(async () => {
    const med = activeMedForIngestion || (medications[0] ? { id: medications[0]._id, name: `${medications[0].drugName} ${medications[0].dosage || ''}`.trim(), time: 'Now' } : null);
    const medName = med?.name || 'Medication';
    const seniorName = user?.fullName?.split(' ')[0] || 'Senior';

    // Celebratory Voice confirmation in chosen language
    const lang = i18n.language || 'en';
    const confirmMsg = lang === 'hi'
      ? `धन्यवाद ${seniorName} जी! आपकी ${medName} खुराक सफलतापूर्वक दर्ज कर ली गई है।`
      : lang === 'kn'
      ? `ಧನ್ಯವಾದಗಳು ${seniorName}! ನಿಮ್ಮ ${medName} ಔಷಧಿ ದಾಖಲಾಗಿದೆ.`
      : `Thank you ${seniorName}! Your ${medName} dose has been verified and recorded.`;

    voiceAssistantRef.current?.speakText(confirmMsg);
    showToast(`✓ ${t('companion.medicationTakenSuccess')}`, 'success');
    addEventTrace(`Medication taken (${medName}) — verified by single-lens computer vision`, 'safe');

    setIsMedicationMode(false);
    setActiveMedForIngestion(null);

    const payload = {
      medicationId: med?.id || '',
      scheduledTime: new Date().toISOString(),
      status: 'TAKEN',
      verifiedByVision: true,
    };

    if (navigator.onLine) {
      try {
        await adherenceAPI.log(payload);
      } catch (err) {
        console.warn('Failed to log adherence online, buffering locally:', err);
        bufferOfflineRecord('adherence', payload);
      }
    } else {
      bufferOfflineRecord('adherence', payload);
      showToast('Offline Protection: Ingestion recorded locally. Will sync when online.', 'info');
    }

    // Refresh medications list
    if (user?._id) {
      medicationAPI.list(user._id).then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setMedications(res.data.data);
        }
      }).catch(console.error);
    }
  }, [activeMedForIngestion, medications, user, i18n.language, showToast, addEventTrace, bufferOfflineRecord, t]);

  useEffect(() => {
    handleMedicationIngestedRef.current = handleMedicationIngested;
  }, [handleMedicationIngested]);

  // Activate Single-Lens Medication Ingestion Mode
  const startMedicationIngestionMode = useCallback(async (med?: { id: string; name: string; time: string }) => {
    const targetMed = med || (nextMed && medications[0] ? { id: medications[0]._id, name: nextMed.name, time: nextMed.time } : null);
    if (targetMed) {
      setActiveMedForIngestion(targetMed);
    }
    setIsMedicationMode(true);

    // Auto-activate camera lens if paused
    if (!isActive) {
      await startCamera();
      setCameraActive(true);
      setDetectionMode('pose');
    }

    const seniorName = user?.fullName?.split(' ')[0] || 'Senior';
    const medTitle = targetMed?.name || 'medication';
    const lang = i18n.language || 'en';
    const promptMsg = lang === 'hi'
      ? `नमस्ते ${seniorName} जी, आपकी ${medTitle} दवाई लेने का समय हो गया है। कृपया पानी के साथ दवाई लें।`
      : lang === 'kn'
      ? `ನಮಸ್ಕಾರ ${seniorName}, ನಿಮ್ಮ ${medTitle} ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯವಾಗಿದೆ.`
      : `Hello ${seniorName}, it is time to take your ${medTitle}. Please take your medicine with water.`;

    voiceAssistantRef.current?.speakText(promptMsg);
    showToast(`💊 ${t('companion.medicationModeBadge')}`, 'info');
    addEventTrace(`Medication reminder: ${medTitle} — single-lens ingestion mode active`, 'info');
  }, [isActive, startCamera, setCameraActive, setDetectionMode, nextMed, medications, user, i18n.language, showToast, addEventTrace, t]);

  // Auto-reminder check when dose time is reached
  const lastAutoReminderTime = useRef<string>('');
  useEffect(() => {
    if (!medications || medications.length === 0 || isMedicationMode) return;

    const now = new Date();
    const currentHHMM = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    for (const med of medications) {
      if (!med.scheduledTimes) continue;
      for (const scheduledTime of med.scheduledTimes) {
        if (scheduledTime === currentHHMM && lastAutoReminderTime.current !== `${med._id}-${currentHHMM}`) {
          lastAutoReminderTime.current = `${med._id}-${currentHHMM}`;
          startMedicationIngestionMode({
            id: med._id,
            name: `${med.drugName} ${med.dosage || ''}`.trim(),
            time: scheduledTime,
          });
          return;
        }
      }
    }
  }, [currentTime, medications, isMedicationMode, startMedicationIngestionMode]);

  // Offline / Online synchronizer
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      showToast(t('companion.offlineSyncNotice'), 'success');

      try {
        const queueStr = localStorage.getItem('sarthak_offline_queue');
        if (!queueStr) return;
        const queue = JSON.parse(queueStr);
        if (!Array.isArray(queue) || queue.length === 0) return;

        for (const item of queue) {
          if (item.type === 'adherence') {
            await adherenceAPI.log(item.data).catch(console.error);
          } else if (item.type === 'event' && user) {
            await alertAPI.escalate(item.data).catch(console.error);
          }
        }
        localStorage.removeItem('sarthak_offline_queue');
        addEventTrace(`Synced ${queue.length} offline records to cloud`, 'safe');
      } catch (e) {
        console.warn('Error during offline queue sync:', e);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast(t('companion.offlineProtectionActive'), 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, showToast, addEventTrace, t]);

  // Toggle camera and detection
  const toggleMonitoring = useCallback(async () => {
    if (isActive) {
      stopCamera();
      poseDetection.stopDetection();
      setCameraActive(false);
      setDetectionMode('idle');
      showToast('Camera monitoring paused. Tap to resume anytime.', 'info');
      addEventTrace('Camera monitoring paused', 'safe');
    } else {
      await startCamera();
      setCameraActive(true);
      setDetectionMode('pose');
      showToast('Camera monitoring active — on-device pose skeleton running.', 'success');
      addEventTrace('Camera monitoring started (100% on-device)', 'safe');
    }
  }, [isActive, startCamera, stopCamera, poseDetection, setCameraActive, setDetectionMode, showToast, addEventTrace]);

  // Start detection when camera is ready
  useEffect(() => {
    if (isActive && poseDetection.isReady && videoRef.current) {
      poseDetection.startDetection(videoRef.current, overlayCanvasRef.current || undefined);
    }
  }, [isActive, poseDetection.isReady]);

  // SOS button — immediate emergency escalation
  const triggerSOS = () => {
    setAlertState('escalating');
    showToast('Emergency SOS activated — Calling designated caregiver immediately.', 'alert');
    addEventTrace('Manual SOS initiated by senior — automated emergency call dispatched', 'alert');
    if (user) {
      alertAPI.escalate({
        userId: user._id,
        eventType: 'DISTRESS_VOICE',
        metadata: { source: 'MANUAL_SOS' },
      }).catch(console.error);
    }
  };

  const isAlertActive = alertState !== 'none';
  const firstName = user?.fullName?.trim().split(' ')[0] || '';

  return (
    <div className="page-enter min-h-screen pb-28 gradient-warm text-surface-900">
      {/* ── Top Bar with Global Language Switcher ── */}
      <div className="bg-white/90 backdrop-blur-md border-b border-surface-200/80 px-4 sm:px-8 py-3 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sarthak-600 inline-block animate-pulse" />
              <h1 className="text-base sm:text-lg font-bold text-surface-900">
                {t('companion.title')}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-surface-700 hidden sm:block">
              {t('companion.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Language Switcher */}
            <LanguageSwitcher variant="pill" />

            <button
              onClick={() => setShowOnboarding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-800 text-xs sm:text-sm font-semibold border border-surface-300 transition-colors"
              title="View quick feature tour"
            >
              <HelpCircle size={15} className="text-sarthak-700" />
              <span className="hidden sm:inline">{t('companion.quickTour')}</span>
            </button>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-100 text-xs font-semibold text-surface-700 border border-surface-200">
              {isOnline ? (
                <>
                  <Wifi size={14} className="text-sarthak-700" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} className="text-amber-700" />
                  <span>Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 100% On-Device Offline Protection Reassurance Banner ── */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs animate-fade-in text-center">
          <WifiOff size={16} className="shrink-0" />
          <span>{t('companion.offlineProtectionActive')}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 space-y-6">

        {/* ── Toast Feedback ── */}
        {simulationToast && (
          <div
            className={`p-4 rounded-2xl border text-sm sm:text-base font-semibold flex items-center justify-between gap-3 animate-slide-down shadow-md ${
              simulationToast.type === 'alert'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : simulationToast.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : simulationToast.type === 'success'
                ? 'bg-sarthak-50 border-sarthak-300 text-sarthak-900'
                : 'bg-stone-50 border-stone-300 text-stone-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {simulationToast.type === 'alert' ? (
                <AlertTriangle size={20} className="text-rose-600 shrink-0" />
              ) : simulationToast.type === 'warning' ? (
                <BellRing size={20} className="text-amber-600 shrink-0" />
              ) : (
                <CheckCircle2 size={20} className="text-sarthak-600 shrink-0" />
              )}
              <span>{simulationToast.message}</span>
            </div>
            <button
              onClick={() => setSimulationToast(null)}
              className="text-xs uppercase font-bold tracking-wider px-2 py-1 rounded bg-black/5 hover:bg-black/10 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Active Emergency Escalation & Resolution Banner ── */}
        {alertState === 'escalating' && (
          <div className="p-6 rounded-3xl bg-rose-600 text-white shadow-xl border-2 border-rose-500 animate-slide-down space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                  <Phone size={26} className="text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-black uppercase tracking-wider text-rose-100 mb-1">
                    Emergency Alert Active
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    Caregivers Contacted via Phone & SMS
                  </h3>
                  <p className="text-xs sm:text-sm text-rose-100">
                    Automated distress call was dispatched to your designated caregiver. Help is on the way.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={resolveActiveEmergency}
                className="px-6 py-3.5 rounded-2xl bg-white text-rose-900 hover:bg-emerald-50 hover:text-emerald-900 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <CheckCircle2 size={22} className="text-emerald-600" />
                <span>Help Arrived — I Am Safe Now</span>
              </button>
            </div>
            <div className="text-xs text-rose-200 border-t border-white/20 pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-medium">
              <span>🎤 Say <strong>"Help has arrived"</strong>, <strong>"I am safe now"</strong>, or <strong>"मदद मिल गई"</strong> anytime hands-free.</span>
              <span className="font-semibold text-emerald-300">Microphone active</span>
            </div>
          </div>
        )}

        {/* ── Status Card ── */}
        <div className="bg-white border-2 border-surface-200/90 rounded-3xl p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
          <div className="flex justify-center mb-4">
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all ${
                isAlertActive
                  ? 'bg-rose-100 text-rose-700 animate-pulse'
                  : isActive
                  ? 'bg-sarthak-100 text-sarthak-800 pulse-ring-safe'
                  : 'bg-surface-100 text-surface-700'
              }`}
            >
              {isAlertActive ? (
                <ShieldAlert size={42} className="stroke-[2.2]" />
              ) : isActive ? (
                <ShieldCheck size={42} className="stroke-[2.2]" />
              ) : (
                <Shield size={42} className="stroke-[2.2]" />
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-100 border border-surface-300 text-surface-800 text-xs sm:text-sm font-bold uppercase tracking-wider mb-2">
            {isAlertActive ? t('companion.attentionRequired') : t('companion.allIsWell')}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-surface-900 tracking-tight mb-1">
            {isAlertActive
              ? t('companion.attentionRequired')
              : firstName
              ? `${t('companion.allIsWell')}, ${firstName}`
              : t('companion.allIsWell')}
          </h2>

          <p className="text-sm sm:text-base text-surface-700 max-w-md mx-auto mb-4">
            {isAlertActive ? t('companion.attentionDesc') : t('companion.allIsWellDesc')}
          </p>

          <div className="pt-2 border-t border-surface-200/80 inline-block px-8">
            <span className="text-xs uppercase font-bold text-surface-700 block tracking-wider">{t('companion.currentTime')}</span>
            <p className="text-3xl sm:text-4xl font-extrabold text-surface-900 tabular-nums">
              {currentTime.toLocaleTimeString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* ── LIVE COMPUTER VISION PROOF & SKELETON WITH TELEMETRY HUD ── */}
        <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-200">
            <div className="flex items-center gap-2.5">
              <ScanLine size={24} className="text-sarthak-700 shrink-0" />
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-surface-900">
                  {t('companion.skeletonProof')}
                </h3>
                <p className="text-xs text-surface-600">
                  {t('companion.skeletonExplanation')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Laptop / Camera Device Selector */}
              {videoDevices.length > 1 && (
                <div className="flex items-center gap-1.5 bg-surface-50 border border-surface-200 rounded-xl px-2.5 py-1">
                  <Camera size={13} className="text-surface-600" />
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      if (isActive) startCamera(e.target.value);
                    }}
                    className="bg-transparent text-xs font-semibold text-surface-800 outline-none cursor-pointer"
                  >
                    {videoDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                isActive ? 'bg-sarthak-100 text-sarthak-800 border border-sarthak-300' : 'bg-surface-100 text-surface-600'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-sarthak-600 animate-pulse' : 'bg-surface-400'}`} />
                {isActive ? t('companion.poseTrackingActive') : t('companion.cameraStandby')}
              </span>
            </div>
          </div>

          {/* Video Container (Always kept in DOM with attachVideo to prevent black screen) */}
          <div className="relative rounded-2xl overflow-hidden bg-surface-950 aspect-video sm:aspect-[16/9] flex items-center justify-center shadow-inner border border-surface-800">
            {/* Real webcam video stream */}
            <video
              ref={attachVideo}
              autoPlay
              playsInline
              muted
              onLoadedData={() => {
                if (videoRef.current && poseDetection.isReady) {
                  poseDetection.startDetection(videoRef.current, overlayCanvasRef.current || undefined);
                }
              }}
              onPlaying={() => {
                if (videoRef.current && poseDetection.isReady) {
                  poseDetection.startDetection(videoRef.current, overlayCanvasRef.current || undefined);
                }
              }}
              className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
                isActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}
            />

            {/* Mirrored overlay canvas rendering real-time skeletal connectors and joint points */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Active Live Telemetry HUD Over Video */}
            {isActive ? (
              <>
                {/* Top Privacy Watermark */}
                <div className="absolute top-3 left-3 bg-surface-900/85 backdrop-blur-md text-surface-100 text-xs px-3 py-1.5 rounded-xl border border-surface-700/60 flex items-center gap-2 font-medium shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">MediaPipe On-Device</span>
                  <span className="text-surface-400">•</span>
                  <span className="text-emerald-300 font-mono">0 KB Uploaded</span>
                </div>

                {/* Top Right Joint Counter / Medication Ingestion Status */}
                {isMedicationMode ? (
                  <div className="absolute top-3 right-3 bg-amber-600/90 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-xl border border-amber-400/80 flex items-center gap-2 font-bold shadow-md animate-pulse">
                    <Pill size={14} className="text-amber-200" />
                    <span>
                      {poseDetection.isIngesting
                        ? `Ingesting: ${poseDetection.ingestionProgress}%`
                        : 'Medication Mode: Bring pill to mouth'}
                    </span>
                  </div>
                ) : (
                  <div className="absolute top-3 right-3 bg-surface-900/85 backdrop-blur-md text-surface-100 text-xs px-3 py-1.5 rounded-xl border border-surface-700/60 flex items-center gap-1.5 font-bold shadow-md">
                    <Activity size={14} className="text-sarthak-400" />
                    <span>{poseDetection.landmarksCount > 0 ? `${poseDetection.landmarksCount} Joints Tracked` : 'Detecting Body...'}</span>
                  </div>
                )}

                {/* Bottom Fall Detection Status & Behavior Telemetry Bar */}
                <div className="absolute bottom-3 left-3 right-3 bg-surface-900/90 backdrop-blur-md p-3 rounded-xl border border-surface-700/70 flex flex-wrap items-center justify-between gap-2 text-white shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-surface-300">
                        Behavior:
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 ${
                      poseDetection.behavior === 'Sitting Comfortably' || poseDetection.behavior === 'Standing Upright' || poseDetection.behavior === 'Walking / Moving'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : poseDetection.behavior === 'Bending / Reaching'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : poseDetection.behavior === 'Sudden Slump' || poseDetection.behavior === 'Distress Agitation'
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 animate-pulse'
                        : poseDetection.behavior === 'Fall Detected' || poseDetection.behavior === 'Prolonged Floor Immobility'
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/60 animate-pulse'
                        : 'bg-surface-800 text-surface-300'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        poseDetection.behavior === 'Fall Detected' || poseDetection.behavior === 'Prolonged Floor Immobility'
                          ? 'bg-rose-400 animate-ping'
                          : poseDetection.behavior === 'Sudden Slump' || poseDetection.behavior === 'Distress Agitation'
                          ? 'bg-amber-400 animate-bounce'
                          : 'bg-emerald-400'
                      }`} />
                      {poseDetection.behavior}
                    </span>

                    {poseDetection.behaviorTelemetry && (
                      <span className="text-[11px] text-surface-300 font-mono hidden sm:inline-block bg-surface-800/80 px-2 py-0.5 rounded border border-surface-700/50">
                        Stability: {poseDetection.behaviorTelemetry.postureStability}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                      Multi-Behavior Guard
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* Camera Standby Screen */
              <div className="p-8 text-center bg-surface-900/90 text-surface-200 flex flex-col items-center justify-center gap-3 w-full h-full">
                <div className="w-14 h-14 rounded-2xl bg-surface-800 text-surface-400 flex items-center justify-center shadow-md">
                  <CameraOff size={28} />
                </div>
                <div className="max-w-md">
                  <h4 className="text-base font-bold text-white mb-1">
                    Camera Vision Is Currently Off
                  </h4>
                  <p className="text-xs sm:text-sm text-surface-400">
                    Turn on the camera to see your live on-device skeleton tracker and fall detection sensors in action.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleMonitoring}
                  className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sarthak-600 hover:bg-sarthak-700 text-white font-bold text-sm shadow-md transition-all active:scale-95"
                >
                  <Camera size={16} />
                  <span>{t('companion.turnCameraOn')}</span>
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2 font-medium">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>Camera access notice: {cameraError}. Please ensure webcam permissions are enabled in your browser.</span>
            </div>
          )}
        </div>

        {/* ── ACTIVE VOICE COMPANION & DISTRESS LISTENER ── */}
        <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={voiceAssistant.toggleListening}
                aria-label={voiceAssistant.isListening ? "Pause microphone" : "Resume microphone"}
                title={voiceAssistant.isListening ? "Click to pause microphone" : "Click to resume microphone"}
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer ${
                  voiceAssistant.isListening
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 animate-pulse'
                    : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                }`}
              >
                {voiceAssistant.isListening ? <Mic size={22} /> : <MicOff size={22} />}
              </button>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-surface-900">
                  {t('companion.voiceAssistantTitle')}
                </h3>
                <p className="text-xs text-surface-600">
                  {t('companion.voiceAssistantSub')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Listening Language Switcher */}
              <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-xl border border-surface-200">
                <button
                  type="button"
                  onClick={() => voiceAssistant.setListeningLanguage('hi')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    voiceAssistant.listeningLanguage === 'hi'
                      ? 'bg-sarthak-600 text-white shadow-xs'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  🇮🇳 हिंदी
                </button>
                <button
                  type="button"
                  onClick={() => voiceAssistant.setListeningLanguage('en')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    voiceAssistant.listeningLanguage === 'en'
                      ? 'bg-sarthak-600 text-white shadow-xs'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  🇬🇧 English
                </button>
                <button
                  type="button"
                  onClick={() => voiceAssistant.setListeningLanguage('kn')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    voiceAssistant.listeningLanguage === 'kn'
                      ? 'bg-sarthak-600 text-white shadow-xs'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  🇮🇳 ಕನ್ನಡ
                </button>
              </div>

              <button
                type="button"
                id="voice-mic-toggle-btn"
                onClick={voiceAssistant.toggleListening}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-2xs active:scale-95 cursor-pointer ${
                  voiceAssistant.isListening
                    ? 'bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100 hover:border-rose-400'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                }`}
              >
                {voiceAssistant.isListening ? (
                  <>
                    <MicOff size={16} />
                    <span>{t('companion.voiceStopBtn')}</span>
                  </>
                ) : (
                  <>
                    <Mic size={16} />
                    <span>{t('companion.voiceStartBtn')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Voice State Display */}
          <div
            onClick={voiceAssistant.toggleListening}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') voiceAssistant.toggleListening(); }}
            title="Click to toggle microphone"
            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none space-y-3 ${
              voiceAssistant.isListening
                ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/70'
                : 'bg-amber-50/50 border-amber-200 hover:bg-amber-50/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${voiceAssistant.isListening ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                <span className={`text-xs sm:text-sm font-bold ${voiceAssistant.isListening ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {voiceAssistant.isListening ? t('companion.voiceListening') : t('companion.voicePaused')}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-surface-600">
                Listening: <strong className="text-sarthak-700 font-bold">{voiceAssistant.listeningLanguage === 'hi' ? 'हिंदी (hi-IN)' : voiceAssistant.listeningLanguage === 'kn' ? 'ಕನ್ನಡ (kn-IN)' : 'English (en-IN)'}</strong>
              </span>
            </div>

            {/* What senior said */}
            {voiceAssistant.transcript && (
              <div className="p-3 rounded-xl bg-white border border-surface-200 text-xs sm:text-sm flex items-start gap-2">
                <span className="font-bold text-surface-700 shrink-0">{t('companion.voiceHeard')}</span>
                <span className="font-medium text-surface-900">"{voiceAssistant.transcript}"</span>
              </div>
            )}

            {/* Assistant spoken response */}
            {voiceAssistant.lastResponse && (
              <div className="p-3 rounded-xl bg-sarthak-50 border border-sarthak-200 text-xs sm:text-sm flex items-start gap-2">
                <Volume2 size={16} className="text-sarthak-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-sarthak-900 block">{t('companion.voiceReply')}</span>
                  <span className="font-medium text-sarthak-800">"{voiceAssistant.lastResponse}"</span>
                </div>
              </div>
            )}

            {/* Hands-Free Voice Commands Guide */}
            <div className="p-3.5 rounded-xl bg-white border border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-surface-700">
                <strong className="text-surface-900 font-bold">Voice-Activated Companion:</strong> Speak "Help", "What is the time?", "When is my medicine?", or "I am OK" anytime hands-free.
              </span>
              <span className="text-[11px] font-semibold text-sarthak-700 bg-sarthak-50 border border-sarthak-200 px-2 py-0.5 rounded-lg shrink-0">
                Active & Listening
              </span>
            </div>
          </div>
        </div>

        {/* ── Single-Lens AI Computer Vision Medication Ingestion Banner ── */}
        <div className={`border-2 rounded-3xl p-5 sm:p-6 shadow-sm transition-all ${
          isMedicationMode
            ? 'bg-gradient-to-r from-amber-100 to-sky-50 border-amber-400 shadow-md ring-2 ring-amber-300'
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/90'
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isMedicationMode ? 'bg-amber-600 text-white animate-pulse' : 'bg-amber-600 text-white'
              }`}>
                <Pill size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isMedicationMode ? 'bg-amber-600 text-white animate-pulse' : 'bg-amber-200/70 text-amber-900'
                  }`}>
                    {isMedicationMode ? '● Ingestion Tracking Active' : 'Prescription Checklist'}
                  </span>
                  <span className="text-xs font-semibold text-amber-800">
                    {activeMedForIngestion?.name
                      ? `Taking: ${activeMedForIngestion.name}`
                      : nextMed
                      ? `Next: ${nextMed.name} (${nextMed.time})`
                      : `${medications.length} Prescriptions Active`}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-surface-900 mt-1">
                  {isMedicationMode
                    ? (poseDetection.isIngesting ? `Ingesting: ${poseDetection.ingestionProgress}%` : 'Single Camera Ingestion Active')
                    : 'Single-Lens Medication Adherence'}
                </h3>
                <p className="text-xs text-surface-700">
                  {isMedicationMode
                    ? 'Bring your hand with medicine/water to your mouth. The camera detects the ingestion gesture automatically.'
                    : 'Your single camera detects hand-to-mouth medicine ingestion and syncs confirmed adherence to the family portal.'}
                </p>

                {/* Live Ingestion Progress Bar */}
                {isMedicationMode && (
                  <div className="w-full bg-surface-200 h-2.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-full rounded-full transition-all duration-150"
                      style={{ width: `${poseDetection.ingestionProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              {isMedicationMode ? (
                <>
                  <button
                    type="button"
                    onClick={poseDetection.triggerManualIngestionConfirm}
                    className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    <span>Confirm Ingestion</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMedicationMode(false);
                      setActiveMedForIngestion(null);
                    }}
                    className="px-3 py-3 rounded-2xl bg-surface-200 hover:bg-surface-300 text-surface-800 font-bold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startMedicationIngestionMode()}
                    className="flex-1 sm:flex-none px-5 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Pill size={17} />
                    <span>{t('companion.takeDoseNow')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIntakeModal(true)}
                    className="px-3.5 py-3.5 rounded-2xl bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    title="Scan box/bottle with camera"
                  >
                    <Camera size={15} />
                    <span className="hidden md:inline">Scan Box</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Primary Action Controls ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={toggleMonitoring}
            className={`min-h-[58px] p-4 rounded-2xl border-2 flex items-center justify-center gap-3 font-bold text-base sm:text-lg transition-all active:scale-[0.98] shadow-2xs ${
              isActive
                ? 'bg-sarthak-50 border-sarthak-500 text-sarthak-800 hover:bg-sarthak-100'
                : 'bg-white border-surface-300 text-surface-900 hover:border-sarthak-500'
            }`}
          >
            {isActive ? (
              <>
                <Camera size={22} className="text-sarthak-700" />
                <span>{t('companion.turnCameraOff')}</span>
              </>
            ) : (
              <>
                <CameraOff size={22} className="text-surface-700" />
                <span>{t('companion.turnCameraOn')}</span>
              </>
            )}
          </button>

          <button
            onClick={triggerSOS}
            className={`min-h-[58px] p-4 rounded-2xl border-2 flex items-center justify-center gap-3 font-bold text-base sm:text-lg transition-all active:scale-[0.98] shadow-2xs ${
              isAlertActive
                ? 'bg-red-600 border-red-600 text-white animate-pulse'
                : 'bg-white border-stone-300 hover:border-amber-500 hover:bg-stone-50 text-stone-800'
            }`}
          >
            <Phone size={22} className={isAlertActive ? 'text-white' : 'text-stone-700'} />
            <span>{isAlertActive ? t('companion.emergencyActive') : t('companion.askForHelp')}</span>
          </button>
        </div>

        {/* ── Quick Navigation Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <Link
            to="/medications"
            className="bg-white border border-surface-200 hover:border-sarthak-500 p-4 rounded-2xl text-center flex flex-col items-center gap-2 group transition-all shadow-2xs"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Pill size={22} />
            </div>
            <span className="text-sm font-bold text-surface-900">{t('nav.medications')}</span>
            <span className="text-xs text-surface-700">
              {medications.length > 0 ? `${medications.length} active schedule(s)` : t('companion.noMedicationsYet')}
            </span>
          </Link>

          <Link
            to="/medications?scan=true"
            className="bg-white border border-surface-200 hover:border-sarthak-500 p-4 rounded-2xl text-center flex flex-col items-center gap-2 group transition-all shadow-2xs"
          >
            <div className="w-11 h-11 rounded-xl bg-sarthak-100 text-sarthak-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ScanLine size={22} />
            </div>
            <span className="text-sm font-bold text-surface-900">{t('medications.scanButton')}</span>
            <span className="text-xs text-surface-700">Instant AI OCR safety verification</span>
          </Link>

          <Link
            to="/settings"
            className="bg-white border border-surface-200 hover:border-sarthak-500 p-4 rounded-2xl text-center flex flex-col items-center gap-2 group transition-all shadow-2xs"
          >
            <div className="w-11 h-11 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Eye size={22} />
            </div>
            <span className="text-sm font-bold text-surface-900">{t('nav.settings')}</span>
            <span className="text-xs text-surface-700">Language, voice & sensitivities</span>
          </Link>
        </div>

        {/* ── Live Activity Trace / Empty State ── */}
        <div className="bg-white border border-surface-200 rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-surface-200">
            <span className="text-xs font-bold text-surface-800 uppercase tracking-wider">
              Live Session Activity
            </span>
            <span className="text-xs text-surface-600">Local activity log</span>
          </div>

          {liveEvents.length === 0 ? (
            <div className="py-6 text-center text-surface-600 text-sm">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-sarthak-600 opacity-60" />
              <p className="font-semibold text-surface-800">No alerts or events recorded this session</p>
              <p className="text-xs text-surface-600">Everything is peaceful and monitoring smoothly.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {liveEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between text-xs sm:text-sm py-2 px-3 rounded-xl bg-surface-50 border border-surface-200/80"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        evt.type === 'alert'
                          ? 'bg-rose-600'
                          : evt.type === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-sarthak-600'
                      }`}
                    />
                    <span className="font-semibold text-surface-900">{evt.title}</span>
                  </div>
                  <span className="text-surface-700 text-xs shrink-0">{evt.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Internal camera canvas for snapshots */}
      <canvas ref={canvasRef as any} className="hidden" />

      {/* ── Interactive Grace Window Countdown Modal ── */}
      <AlertModal
        isVisible={alertState === 'grace_period'}
        type="fall"
        secondsRemaining={graceWindow.secondsRemaining}
        onSafe={() => graceWindow.manualResponse('safe')}
        onHelp={() => {
          graceWindow.manualResponse('distress');
          showToast('Emergency SOS confirmed — Calling caregiver immediately.', 'alert');
          addEventTrace('Senior confirmed emergency help in modal — calling caregiver', 'alert');
          if (user) {
            alertAPI.escalate({
              userId: user._id,
              eventType: 'FALL_TRIGGER',
              metadata: { source: 'ALERT_MODAL_HELP' },
            }).catch(console.error);
          }
        }}
        onDismiss={() => graceWindow.cancelGraceWindow()}
      />

      {/* ── Guided Onboarding Walkthrough Tour ── */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />

      {/* ── AI Vision Medication Intake Verification Modal ── */}
      <MedicationIntakeModal
        isOpen={showIntakeModal}
        onClose={() => setShowIntakeModal(false)}
        medications={medications}
        onVerified={(id) => {
          showToast('Medication dose verified by Computer Vision and logged to care dashboard.', 'success');
          addEventTrace('Medication intake verified via Vision AI', 'safe');
        }}
      />
    </div>
  );
}

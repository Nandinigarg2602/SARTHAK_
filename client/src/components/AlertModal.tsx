import { useState, useEffect } from 'react';
import { AlertTriangle, Phone, X, CheckCircle } from 'lucide-react';

interface AlertModalProps {
  isVisible: boolean;
  type: 'fall' | 'distress' | 'medication';
  secondsRemaining: number;
  onSafe: () => void;
  onHelp: () => void;
  onDismiss: () => void;
}

export function AlertModal({
  isVisible,
  type,
  secondsRemaining,
  onSafe,
  onHelp,
  onDismiss,
}: AlertModalProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Trigger vibration
      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }
    }
  }, [isVisible]);

  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  const config = {
    fall: {
      title: 'Fall Detected!',
      titleHi: 'गिरने का पता चला!',
      subtitle: 'Are you okay?',
      subtitleHi: 'क्या आप ठीक हैं?',
      color: 'from-red-600 to-orange-600',
      bgGlow: 'shadow-red-500/30',
    },
    distress: {
      title: 'Distress Detected!',
      titleHi: 'परेशानी का पता चला!',
      subtitle: 'Do you need help?',
      subtitleHi: 'क्या आपको मदद चाहिए?',
      color: 'from-orange-600 to-yellow-600',
      bgGlow: 'shadow-orange-500/30',
    },
    medication: {
      title: 'Medication Reminder',
      titleHi: 'दवाई याद दिलाना',
      subtitle: 'Time to take your medicine',
      subtitleHi: 'दवाई लेने का समय',
      color: 'from-blue-600 to-cyan-600',
      bgGlow: 'shadow-blue-500/30',
    },
  };

  const c = config[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative w-[90vw] max-w-md p-8 rounded-3xl bg-gradient-to-br ${c.color} shadow-2xl ${c.bgGlow} animate-slide-up`}
      >
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Animated warning icon */}
        <div className="flex justify-center mb-6">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
              pulse ? 'bg-white/30 scale-110' : 'bg-white/20 scale-100'
            }`}
          >
            <AlertTriangle size={48} className="text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-center text-senior-3xl font-bold text-white mb-1">
          {c.title}
        </h1>
        <p className="text-center text-senior-lg text-white/80 mb-2">
          {c.titleHi}
        </p>

        {/* Subtitle */}
        <p className="text-center text-senior-lg text-white/90 mb-2">
          {c.subtitle}
        </p>
        <p className="text-center text-senior-base text-white/70 mb-6">
          {c.subtitleHi}
        </p>

        {/* Countdown */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10">
            <span className="text-senior-2xl font-bold tabular-nums">
              {secondsRemaining}
            </span>
            <span className="text-senior-sm text-white/70">seconds remaining</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onSafe}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-green-500/30 hover:bg-green-500/50 border border-green-400/30 transition-all active:scale-95"
          >
            <CheckCircle size={32} className="text-green-300" />
            <span className="text-senior-base font-bold text-white">I'm OK</span>
            <span className="text-sm text-white/60">मैं ठीक हूँ</span>
          </button>

          <button
            onClick={onHelp}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-red-500/30 hover:bg-red-500/50 border border-red-400/30 transition-all active:scale-95"
          >
            <Phone size={32} className="text-red-300" />
            <span className="text-senior-base font-bold text-white">Help!</span>
            <span className="text-sm text-white/60">मदद!</span>
          </button>
        </div>

        {/* Microphone listening indicator */}
        <div className="mt-6 flex items-center justify-center gap-2.5 text-white/95 text-xs sm:text-sm font-semibold bg-black/30 backdrop-blur-sm py-2.5 px-4 rounded-2xl border border-white/20">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span>Microphone Active — Say "Help!" to call or "I'm OK" to cancel</span>
        </div>
      </div>
    </div>
  );
}

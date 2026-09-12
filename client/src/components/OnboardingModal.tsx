import { useState } from 'react';
import { Shield, Camera, BellRing, Users, ArrowRight, ArrowLeft, Check, X } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      icon: Shield,
      badge: 'Welcome',
      color: 'bg-sarthak-100 text-sarthak-800',
      title: 'Welcome to your Sarthak companion',
      description:
        'Sarthak looks after your safety, daily medications, and family connection in one gentle, private place right on this device.',
      tip: 'Everything is processed locally on your tablet. No continuous video is ever sent to the cloud.',
    },
    {
      icon: Camera,
      badge: 'Medications',
      color: 'bg-amber-100 text-amber-800',
      title: 'Never miss a dose & scan packages',
      description:
        'Easily check your daily medication times. You can add new medicines in seconds simply by holding the box or bottle up to the camera.',
      tip: 'Tap "Medications" in the navigation bar to see your daily schedule and check for drug interactions.',
    },
    {
      icon: BellRing,
      badge: 'Fall & Safety',
      color: 'bg-rose-100 text-rose-800',
      title: 'Gentle fall protection with grace period',
      description:
        'If an unexpected stumble or fall occurs, a 60-second chime will ask if you are okay. Tap "I\'m OK / Cancel" to immediately dismiss false alarms.',
      tip: 'Your family is only alerted after the 60-second window expires without a response.',
    },
    {
      icon: Users,
      badge: 'Family Connection',
      color: 'bg-sky-100 text-sky-800',
      title: 'Your loved ones stay reassured',
      description:
        'Your designated emergency contacts and family members can view your daily adherence records and receive automated check-in notifications.',
      tip: 'Manage your family contacts and escalation delay anytime from the Settings page.',
    },
  ];

  const handleNext = () => {
    if (currentStep < slides.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem('sarthak_onboarding_seen', 'true');
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const current = slides[currentStep];
  const IconComponent = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border-2 border-surface-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-slide-up flex flex-col">
        {/* Close Button */}
        <button
          onClick={() => {
            localStorage.setItem('sarthak_onboarding_seen', 'true');
            onClose();
          }}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-surface-100 hover:bg-surface-200 text-surface-700 flex items-center justify-center transition-colors"
          aria-label="Close tour"
        >
          <X size={18} />
        </button>

        {/* Top Icon & Badge */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-14 h-14 rounded-2xl ${current.color} flex items-center justify-center shadow-2xs`}>
            <IconComponent size={28} className="stroke-[2.2]" />
          </div>
          <div>
            <span className="text-xs font-bold text-sarthak-800 uppercase tracking-wider block">
              Step {currentStep + 1} of {slides.length} • {current.badge}
            </span>
            <div className="flex gap-1.5 mt-1.5">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'w-6 bg-sarthak-600'
                      : i < currentStep
                      ? 'w-2.5 bg-sarthak-300'
                      : 'w-2.5 bg-surface-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-2xl font-bold text-surface-900 tracking-tight mb-3">
          {current.title}
        </h3>
        <p className="text-surface-700 text-base leading-relaxed mb-5">
          {current.description}
        </p>

        {/* Friendly Tip Box */}
        <div className="p-3.5 rounded-2xl bg-surface-50 border border-surface-200 text-surface-800 text-xs sm:text-sm font-medium mb-6">
          💡 <span className="font-semibold text-surface-900">Good to know:</span> {current.tip}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-surface-200">
          {currentStep > 0 ? (
            <button
              onClick={handlePrev}
              className="px-4 py-3 rounded-xl text-surface-700 hover:bg-surface-100 font-semibold text-sm flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Previous</span>
            </button>
          ) : (
            <button
              onClick={() => {
                localStorage.setItem('sarthak_onboarding_seen', 'true');
                onClose();
              }}
              className="px-3 py-2 text-surface-700 hover:text-surface-900 text-xs font-medium"
            >
              Skip tour
            </button>
          )}

          <button
            onClick={handleNext}
            className="btn-primary py-3 px-6 text-sm font-bold ml-auto"
          >
            {currentStep === slides.length - 1 ? (
              <>
                <span>Got it! Start Sarthak</span>
                <Check size={16} />
              </>
            ) : (
              <>
                <span>Next Step</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

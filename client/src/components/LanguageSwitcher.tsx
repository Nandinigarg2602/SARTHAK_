import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'pill' | 'select' | 'compact';
}

export function LanguageSwitcher({ className = '', variant = 'pill' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('sarthak_language', lng);
    localStorage.setItem('sarthak_voice_lang', lng);
    window.dispatchEvent(new CustomEvent('sarthak_lang_changed', { detail: lng }));
  };

  const languages = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'hi', label: 'हिंदी', short: 'हि' },
    { code: 'kn', label: 'ಕನ್ನಡ', short: 'ಕ' },
  ];

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1 bg-surface-100 p-1 rounded-xl border border-surface-200 ${className}`}>
        <Globe size={14} className="text-surface-700 ml-1.5 shrink-0" />
        <select
          value={i18n.language?.substring(0, 2) || 'en'}
          onChange={(e) => changeLanguage(e.target.value)}
          className="bg-transparent text-xs font-bold text-surface-900 border-none outline-none py-1 px-1 cursor-pointer"
          aria-label="Select Language"
        >
          {languages.map((lng) => (
            <option key={lng.code} value={lng.code}>
              {lng.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 bg-white/90 p-1 rounded-xl border border-surface-200/90 shadow-2xs ${className}`}>
      <div className="flex items-center gap-1 px-2 text-surface-600 text-xs font-semibold">
        <Globe size={14} className="text-sarthak-700 shrink-0" />
        <span className="hidden sm:inline">Lang:</span>
      </div>
      {languages.map((lng) => {
        const isCurrent = (i18n.language || 'en').startsWith(lng.code);
        return (
          <button
            key={lng.code}
            type="button"
            onClick={() => changeLanguage(lng.code)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              isCurrent
                ? 'bg-sarthak-600 text-white shadow-2xs'
                : 'text-surface-700 hover:text-surface-900 hover:bg-surface-100'
            }`}
          >
            {lng.label}
          </button>
        );
      })}
    </div>
  );
}

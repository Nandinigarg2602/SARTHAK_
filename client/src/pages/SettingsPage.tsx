import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Phone,
  Plus,
  Trash2,
  Save,
  Loader2,
  Sliders,
  Languages,
  Heart,
  LogOut,
  Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { userAPI } from '../services/api';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, logout, isCaregiver } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [age, setAge] = useState(user?.age || 70);
  const [language, setLanguage] = useState(user?.primaryLanguage || i18n.language || 'en');
  const [allergies, setAllergies] = useState<string[]>(user?.allergies || []);
  const [newAllergy, setNewAllergy] = useState('');
  const [contacts, setContacts] = useState(user?.emergencyContacts || []);
  const [fallThreshold, setFallThreshold] = useState(
    user?.sensitivitySettings?.fallDetectionThreshold || 0.7
  );
  const [graceWindow, setGraceWindow] = useState(
    user?.sensitivitySettings?.graceWindowSeconds || 60
  );

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setAge(user.age || 70);
      setLanguage(user.primaryLanguage || i18n.language || 'en');
      setAllergies(user.allergies || []);
      setContacts(user.emergencyContacts || []);
      if (user.sensitivitySettings) {
        setFallThreshold(user.sensitivitySettings.fallDetectionThreshold ?? 0.7);
        setGraceWindow(user.sensitivitySettings.graceWindowSeconds ?? 60);
      }
    }
  }, [user, i18n.language]);

  const handleLanguageChange = (selectedLang: string) => {
    setLanguage(selectedLang);
    i18n.changeLanguage(selectedLang);
    localStorage.setItem('sarthak_language', selectedLang);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    try {
      await userAPI.update(user._id, {
        fullName,
        age,
        primaryLanguage: language,
        allergies,
        emergencyContacts: contacts,
      });

      await userAPI.updateSensitivity(user._id, {
        fallDetectionThreshold: fallThreshold,
        graceWindowSeconds: graceWindow,
      });

      // Also persist chosen language
      i18n.changeLanguage(language);
      localStorage.setItem('sarthak_language', language);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setAllergies([...allergies, newAllergy.trim()]);
      setNewAllergy('');
    }
  };

  const addContact = () => {
    setContacts([
      ...contacts,
      {
        name: '',
        phone: '',
        priorityOrder: contacts.length + 1,
        callEscalationDelayMinutes: 5,
      },
    ]);
  };

  const removeContact = (idx: number) => {
    setContacts(contacts.filter((_, i) => i !== idx));
  };

  const updateContact = (idx: number, field: string, value: any) => {
    setContacts(
      contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'हिंदी (Hindi)' },
    { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  ];

  return (
    <div className="page-enter min-h-screen pb-28 gradient-warm text-surface-900">
      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-surface-200/80 px-4 sm:px-8 py-3.5 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center">
                <SettingsIcon size={18} />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-surface-900">
                {t('settings.title')}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-surface-700 mt-0.5">
              {t('settings.subtitle')}
            </p>
          </div>
          <LanguageSwitcher variant="pill" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Profile Details */}
        <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-base font-bold text-surface-900">
            <User size={18} className="text-sarthak-700" />
            <span>{isCaregiver ? 'Caregiver Profile' : t('settings.profile')}</span>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-surface-800 mb-1.5 block">
              {t('settings.fullName')}
            </label>
            <input
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {!isCaregiver && (
            <div>
              <label className="text-xs font-bold uppercase text-surface-800 mb-1.5 block">
                {t('settings.age')}
              </label>
              <input
                className="input-field"
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        {!isCaregiver && (
          <>
            {/* Allergies */}
            <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center gap-2 text-base font-bold text-surface-900 mb-3">
                <Heart size={18} className="text-rose-600 fill-rose-600" />
                <span>{t('settings.allergies')}</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {allergies.map((a, i) => (
                  <span
                    key={i}
                    className="badge-danger cursor-pointer hover:bg-rose-200 text-xs sm:text-sm font-semibold flex items-center gap-1.5 py-1 px-3"
                    onClick={() => setAllergies(allergies.filter((_, j) => j !== i))}
                    title="Tap to remove"
                  >
                    {a} ✕
                  </span>
                ))}
                {allergies.length === 0 && (
                  <span className="text-xs text-surface-700">No known allergies registered</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Type an allergy and press enter..."
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAllergy()}
                />
                <button onClick={addAllergy} className="btn-secondary px-5 shrink-0 bg-white">
                  <Plus size={18} />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base font-bold text-surface-900">
                  <Phone size={18} className="text-sarthak-700" />
                  <span>{t('settings.emergencyContacts')}</span>
                </div>
                <button
                  onClick={addContact}
                  className="btn-secondary text-xs py-1.5 px-3 bg-surface-50 font-bold"
                >
                  <Plus size={14} />
                  <span>{t('settings.addContact')}</span>
                </button>
              </div>

              <div className="space-y-3">
                {contacts.map((contact, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-surface-50 border border-surface-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-sarthak-800">
                        Priority #{contact.priorityOrder}
                      </span>
                      <button
                        onClick={() => removeContact(i)}
                        className="p-1 hover:bg-rose-100 rounded-lg text-surface-700 hover:text-rose-700 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        className="input-field"
                        placeholder="Contact Name & Relation"
                        value={contact.name}
                        onChange={(e) => updateContact(i, 'name', e.target.value)}
                      />
                      <input
                        className="input-field"
                        placeholder="Phone number (+91...)"
                        value={contact.phone}
                        onChange={(e) => updateContact(i, 'phone', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detection Sensitivity */}
            <div className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-base font-bold text-surface-900 mb-1">
                <Sliders size={18} className="text-sarthak-700" />
                <span>{t('settings.sensitivity')}</span>
              </div>

              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold text-surface-900 mb-1.5">
                  <span>{t('settings.fallThreshold')}</span>
                  <span className="text-sarthak-800 font-mono">{Math.round(fallThreshold * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={fallThreshold}
                  onChange={(e) => setFallThreshold(Number(e.target.value))}
                  className="w-full accent-sarthak-600 h-2 bg-surface-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-surface-700 mt-1">
                  <span>Less sensitive</span>
                  <span>More sensitive</span>
                </div>
              </div>

              <div className="pt-2 border-t border-surface-200">
                <div className="flex justify-between text-xs sm:text-sm font-bold text-surface-900 mb-1.5">
                  <span>{t('settings.graceDuration')}</span>
                  <span className="text-sarthak-800 font-mono">{graceWindow} seconds</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="90"
                  step="15"
                  value={graceWindow}
                  onChange={(e) => setGraceWindow(Number(e.target.value))}
                  className="w-full accent-sarthak-600 h-2 bg-surface-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-surface-700 mt-1">
                  <span>15 seconds</span>
                  <span>90 seconds</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Save Actions */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-4 text-base font-bold shadow-sm"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin mx-auto" />
          ) : saved ? (
            <span className="flex items-center justify-center gap-2">
              <Check size={18} /> {t('settings.saved')}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Save size={18} /> {t('settings.save')}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="btn-secondary w-full py-3.5 text-rose-800 border-rose-200 bg-rose-50 hover:bg-rose-100 font-bold text-sm flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          <span>{t('settings.logout')}</span>
        </button>
      </div>
    </div>
  );
}

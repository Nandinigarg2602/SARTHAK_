import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Pill,
  Plus,
  AlertTriangle,
  Check,
  Trash2,
  Clock,
  Loader2,
  Camera,
  HeartHandshake,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MedicationScanner } from '../components/MedicationScanner';
import { MedicationIntakeModal } from '../components/MedicationIntakeModal';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { medicationAPI } from '../services/api';
import type { Medication, ScannedMedication, InteractionResult } from '../types';

export function MedicationPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannedMeds, setScannedMeds] = useState<ScannedMedication[] | null>(null);
  const [interactions, setInteractions] = useState<InteractionResult | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-open scanner if coming from "Scan Pill Box" button (?scan=true)
  useEffect(() => {
    if (location.search.includes('scan=true')) {
      setShowScanner(true);
    }
  }, [location.search]);

  // Manual add form state
  const [formData, setFormData] = useState({
    drugName: '',
    dosage: '',
    frequency: '',
    scheduledTimes: '',
    instructions: '',
  });

  // Fetch medications
  useEffect(() => {
    if (!user) return;
    medicationAPI
      .list(user._id)
      .then((res) => {
        if (res.data.success) setMedications(res.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // Scan handler
  const handleScan = useCallback(async (imageBase64: string) => {
    const res = await medicationAPI.scan(imageBase64);
    return res.data.data;
  }, []);

  // Save scanned medication
  const saveMedication = useCallback(
    async (med: ScannedMedication) => {
      setSaving(true);
      try {
        const res = await medicationAPI.create({
          drugName: med.drugName,
          dosage: med.dosage,
          frequency: med.frequency || 'Once daily',
          scheduledTimes: ['08:00'],
          instructions: med.instructions || '',
        });
        if (res.data.success) {
          setMedications((prev) => [res.data.data, ...prev]);
          setScannedMeds(null);
          setInteractions(null);
          setShowScanner(false);
        }
      } catch (err) {
        console.error('Failed to save medication:', err);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  // Manual add
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await medicationAPI.create({
        ...formData,
        scheduledTimes: formData.scheduledTimes
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (res.data.success) {
        setMedications((prev) => [res.data.data, ...prev]);
        setShowAddForm(false);
        setFormData({ drugName: '', dosage: '', frequency: '', scheduledTimes: '', instructions: '' });
      }
    } catch (err) {
      console.error('Failed to add medication:', err);
    } finally {
      setSaving(false);
    }
  };

  // Delete medication
  const deleteMedication = async (id: string) => {
    try {
      await medicationAPI.delete(id);
      setMedications((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      console.error('Failed to delete medication:', err);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'Low': return 'text-sarthak-800 bg-sarthak-100 border-sarthak-300';
      case 'Moderate': return 'text-amber-900 bg-amber-100 border-amber-300';
      case 'High': return 'text-orange-900 bg-orange-100 border-orange-300';
      case 'Severe': return 'text-rose-900 bg-rose-100 border-rose-300';
      default: return 'text-surface-700 bg-surface-100 border-surface-200';
    }
  };

  return (
    <div className="page-enter min-h-screen pb-28 gradient-warm text-surface-900">
      {/* ── Top Bar with Language Switcher ── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-surface-200/80 px-4 sm:px-8 py-3.5 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Pill size={18} />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-surface-900">
                {t('medications.title')}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-surface-700 mt-0.5 hidden sm:block">
              {t('medications.subtitle')}
            </p>
          </div>

          <LanguageSwitcher variant="pill" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setShowIntakeModal(true)}
            className="py-3.5 px-4 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-sm transition-transform active:scale-95"
          >
            <ShieldCheck size={20} />
            <span>Verify Intake (Vision AI)</span>
          </button>
          <button
            onClick={() => { setShowScanner(!showScanner); setShowAddForm(false); }}
            className="btn-primary py-3.5 flex items-center justify-center gap-2 font-bold text-sm sm:text-base"
          >
            <Camera size={20} />
            <span>{showScanner ? t('medications.closeScanner') : t('medications.scanButton')}</span>
          </button>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowScanner(false); }}
            className="btn-secondary py-3.5 flex items-center justify-center gap-2 font-bold text-sm sm:text-base bg-white border border-surface-300"
          >
            <Plus size={20} />
            <span>{showAddForm ? t('medications.cancelManual') : t('medications.addManual')}</span>
          </button>
        </div>

        {/* Scanner */}
        {showScanner && (
          <div className="bg-white border-2 border-surface-200 rounded-3xl p-4 sm:p-6 shadow-sm">
            <MedicationScanner
              onScan={handleScan}
              onScanComplete={(meds, ints) => {
                setScannedMeds(meds);
                setInteractions(ints);
              }}
            />
          </div>
        )}

        {/* Scanned Results */}
        {scannedMeds && (
          <div className="space-y-3 bg-white border-2 border-sarthak-300 rounded-3xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-sarthak-900 flex items-center gap-2">
              <Check size={18} className="text-sarthak-700" />
              <span>Scanned Results from Package</span>
            </h3>
            {scannedMeds.map((med, i) => (
              <div key={i} className="p-4 rounded-2xl bg-surface-50 border border-surface-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-bold text-surface-900">
                    {med.drugName}
                  </h4>
                  <button
                    onClick={() => saveMedication(med)}
                    disabled={saving}
                    className="btn-primary text-xs py-2 px-3.5"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : 'Confirm & Add'}
                  </button>
                </div>
                <p className="text-xs text-surface-700">
                  {med.dosage} • {med.frequency}
                </p>
                {med.instructions && (
                  <p className="text-xs text-surface-800 mt-1 font-medium">
                    {med.instructions}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Interactions Warning */}
        {interactions && interactions.interactions && interactions.interactions.length > 0 && (
          <div className="p-5 rounded-3xl bg-amber-50 border-2 border-amber-300 shadow-2xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold mb-3">
              <AlertTriangle size={20} />
              <span>Potential Interactions Detected (Risk: {interactions.overallRisk})</span>
            </div>
            {interactions.interactions.map((int, i) => (
              <div key={i} className="mb-2 last:mb-0 p-3 bg-white rounded-xl border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-surface-900">{int.drug1} ↔ {int.drug2}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${severityColor(int.severity)}`}>
                    {int.severity}
                  </span>
                </div>
                <p className="text-xs text-surface-700 mt-1">{int.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* Manual Add Form */}
        {showAddForm && (
          <form onSubmit={handleManualAdd} className="bg-white border-2 border-surface-200 rounded-3xl p-5 sm:p-6 space-y-3.5 shadow-sm">
            <h3 className="text-base font-bold text-surface-900 mb-2">Add New Medication</h3>
            <div>
              <label className="block text-xs font-bold uppercase text-surface-800 mb-1">Medication Name</label>
              <input
                className="input-field"
                placeholder="e.g. Amlodipine"
                value={formData.drugName}
                onChange={(e) => setFormData({ ...formData, drugName: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-surface-800 mb-1">Dosage</label>
                <input
                  className="input-field"
                  placeholder="e.g. 5mg"
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-surface-800 mb-1">Frequency</label>
                <input
                  className="input-field"
                  placeholder="e.g. Once daily"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-surface-800 mb-1">Scheduled Times (comma-separated 24h)</label>
              <input
                className="input-field"
                placeholder="e.g. 08:00, 20:00"
                value={formData.scheduledTimes}
                onChange={(e) => setFormData({ ...formData, scheduledTimes: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-surface-800 mb-1">Instructions (Optional)</label>
              <input
                className="input-field"
                placeholder="e.g. Take with warm water after meals"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full py-3.5 font-bold mt-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save Medication'}
            </button>
          </form>
        )}

        {/* Medication List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-base font-bold text-surface-900">Current Prescriptions ({medications.length})</h2>
            <span className="text-xs text-surface-700">Daily checklist</span>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <Loader2 size={24} className="text-sarthak-700 animate-spin mx-auto mb-2" />
              <p className="text-xs text-surface-700">Loading your schedule...</p>
            </div>
          ) : medications.length === 0 ? (
            <div className="bg-white border-2 border-surface-200 rounded-3xl p-8 text-center">
              <Pill size={36} className="text-surface-300 mx-auto mb-3" />
              <p className="font-bold text-surface-800">No medications added yet</p>
              <p className="text-xs text-surface-700 mt-1">Tap "Scan Pill Package" or "Add Manual" above to get started.</p>
            </div>
          ) : (
            medications.map((med) => (
              <div
                key={med._id}
                className="bg-white border border-surface-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Pill size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-surface-900">{med.drugName}</h3>
                    <p className="text-xs sm:text-sm text-surface-700">
                      {med.dosage} • {med.frequency}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-sarthak-800 font-semibold mt-1">
                      <Clock size={13} />
                      <span>{med.scheduledTimes.join(', ')}</span>
                    </div>
                    {med.instructions && (
                      <p className="text-xs text-surface-700 mt-1.5 italic">
                        "{med.instructions}"
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteMedication(med._id)}
                  className="w-10 h-10 rounded-xl bg-surface-100 hover:bg-rose-100 text-surface-700 hover:text-rose-700 flex items-center justify-center transition-colors shrink-0"
                  title="Remove medication"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Vision Intake Verification Modal */}
      <MedicationIntakeModal
        isOpen={showIntakeModal}
        onClose={() => setShowIntakeModal(false)}
        medications={medications}
        onVerified={() => {
          // Re-fetch medications or adherence if needed
        }}
      />
    </div>
  );
}

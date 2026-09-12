import { Camera, Upload, Loader2, Check, X } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import type { ScannedMedication, InteractionResult } from '../types';

interface MedicationScannerProps {
  onScanComplete: (
    medications: ScannedMedication[],
    interactions: InteractionResult
  ) => void;
  onScan: (imageBase64: string) => Promise<{
    scannedMedications: ScannedMedication[];
    interactions: InteractionResult;
  }>;
}

export function MedicationScanner({ onScanComplete, onScan }: MedicationScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      // Generate preview
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        setPreview(dataUrl);

        // Extract base64
        const base64 = dataUrl.split(',')[1];

        // Scan
        setScanning(true);
        try {
          const result = await onScan(base64);
          onScanComplete(result.scannedMedications, result.interactions);
        } catch (err: any) {
          setError(err.response?.data?.error || 'Failed to scan medication');
        } finally {
          setScanning(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [onScan, onScanComplete]
  );

  const reset = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="glass-card p-5">
      <h3 className="text-senior-lg font-bold text-white mb-4 flex items-center gap-2">
        <Camera size={22} className="text-sarthak-400" />
        Scan Medicine Strip
      </h3>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />

      {!preview ? (
        /* Capture button */
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-white/20 hover:border-sarthak-400/50 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-3 transition-all duration-300 group"
        >
          <div className="w-16 h-16 rounded-2xl bg-sarthak-500/20 group-hover:bg-sarthak-500/30 flex items-center justify-center transition-colors">
            <Camera size={32} className="text-sarthak-400" />
          </div>
          <div className="text-center">
            <p className="text-senior-base font-semibold text-white/80">
              Take a photo
            </p>
            <p className="text-sm text-white/40 mt-1">
              Point camera at medicine strip or prescription
            </p>
          </div>
        </button>
      ) : (
        /* Preview */
        <div className="relative">
          <img
            src={preview}
            alt="Medicine preview"
            className="w-full rounded-2xl object-cover max-h-[300px]"
          />

          {/* Scanning overlay */}
          {scanning && (
            <div className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center gap-3">
              <Loader2 size={40} className="text-sarthak-400 animate-spin" />
              <p className="text-senior-base font-semibold text-white">
                Analyzing medication...
              </p>
            </div>
          )}

          {/* Reset button */}
          {!scanning && (
            <button
              onClick={reset}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

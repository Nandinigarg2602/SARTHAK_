import React, { createContext, useContext, useState, useCallback } from 'react';

export type MonitoringMode = 'idle' | 'pose' | 'hand' | 'both';
export type AlertState = 'none' | 'grace_period' | 'escalating' | 'resolved';

interface MonitoringContextType {
  // Camera state
  cameraActive: boolean;
  setCameraActive: (active: boolean) => void;

  // Detection mode
  detectionMode: MonitoringMode;
  setDetectionMode: (mode: MonitoringMode) => void;

  // Alert state
  alertState: AlertState;
  setAlertState: (state: AlertState) => void;

  // Connection
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;

  // Grace window
  graceSecondsRemaining: number;
  setGraceSecondsRemaining: (seconds: number) => void;

  // Medication window
  isMedicationWindow: boolean;
  setIsMedicationWindow: (active: boolean) => void;

  // Status
  lastActivity: Date | null;
  setLastActivity: (date: Date) => void;
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined);

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [detectionMode, setDetectionMode] = useState<MonitoringMode>('idle');
  const [alertState, setAlertState] = useState<AlertState>('none');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [graceSecondsRemaining, setGraceSecondsRemaining] = useState(0);
  const [isMedicationWindow, setIsMedicationWindow] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  // Listen for online/offline
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <MonitoringContext.Provider
      value={{
        cameraActive,
        setCameraActive,
        detectionMode,
        setDetectionMode,
        alertState,
        setAlertState,
        isOnline,
        setIsOnline,
        graceSecondsRemaining,
        setGraceSecondsRemaining,
        isMedicationWindow,
        setIsMedicationWindow,
        lastActivity,
        setLastActivity: useCallback((date: Date) => setLastActivity(date), []),
      }}
    >
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring(): MonitoringContextType {
  const context = useContext(MonitoringContext);
  if (!context) throw new Error('useMonitoring must be used within MonitoringProvider');
  return context;
}

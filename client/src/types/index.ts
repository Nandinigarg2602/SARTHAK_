// Shared types for the Sarthak client

export interface User {
  _id: string;
  fullName: string;
  email: string;
  age: number;
  role: 'patient' | 'caregiver' | 'senior';
  linkedPatientId?: string;
  linkedSeniorId?: string;
  phone?: string;
  primaryLanguage: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr';
  allergies: string[];
  emergencyContacts: EmergencyContact[];
  sensitivitySettings: SensitivitySettings;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  priorityOrder: number;
  callEscalationDelayMinutes: number;
}

export interface SensitivitySettings {
  fallDetectionThreshold: number;
  graceWindowSeconds: number;
}

export interface Medication {
  _id: string;
  userId: string;
  drugName: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  instructions: string;
  isActive: boolean;
  knownInteractions: DrugInteraction[];
  createdAt: string;
  updatedAt: string;
}

export interface DrugInteraction {
  interactingDrug: string;
  severity: 'Low' | 'Moderate' | 'High' | 'Severe';
  note: string;
}

export interface AdherenceLog {
  _id: string;
  userId: string;
  medicationId: string | Medication;
  scheduledTime: string;
  takenTime?: string;
  status: 'TAKEN' | 'MISSED' | 'FLAGGED_WRONG_MED';
  verifiedByVision: boolean;
  visionConfidence?: number;
  pillDescription?: string;
  createdAt: string;
}

export type EventType = 'FALL_TRIGGER' | 'MISSED_MEDICATION' | 'DISTRESS_VOICE';
export type EscalationStatus = 'GRACE_PERIOD' | 'VERIFIED_SAFE' | 'ESCALATED' | 'RESOLVED';

export interface SafetyEvent {
  _id: string;
  userId: string;
  eventType: EventType;
  escalationStatus: EscalationStatus;
  currentContactNotifiedIndex: number;
  isFalseAlarm: boolean;
  contextSummary: string;
  emergencyLinkToken: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScannedMedication {
  drugName: string;
  dosage: string;
  frequency: string;
  instructions: string;
}

export interface InteractionResult {
  interactions: {
    drug1: string;
    drug2: string;
    severity: 'Low' | 'Moderate' | 'High' | 'Severe';
    note: string;
  }[];
  overallRisk: string;
}

export interface AdherenceVerification {
  isTakingMedication: boolean;
  confidence: number;
  pillDescription: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

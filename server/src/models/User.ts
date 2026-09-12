import mongoose, { Schema, Document, Types } from 'mongoose';

// ----- Subdocument Interfaces -----
export interface IEmergencyContact {
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
  priorityOrder: number;
  callEscalationDelayMinutes: number;
}

export interface ISensitivitySettings {
  fallDetectionThreshold: number;
  graceWindowSeconds: number;
}

// ----- Main Document Interface -----
export interface IUser extends Document {
  _id: Types.ObjectId;
  fullName: string;
  age: number;
  email: string;
  phone?: string;
  password?: string;
  role: 'patient' | 'caregiver' | 'senior';
  linkedPatientId?: Types.ObjectId;
  linkedSeniorId?: Types.ObjectId;
  primaryLanguage: 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr';
  allergies: string[];
  emergencyContacts: IEmergencyContact[];
  sensitivitySettings: ISensitivitySettings;
  inviteToken?: string;
  inviteExpires?: Date;
  isInviteAccepted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    relationship: { type: String },
    priorityOrder: { type: Number, default: 1 },
    callEscalationDelayMinutes: { type: Number, default: 3 },
  },
  { _id: false }
);

const SensitivitySettingsSchema = new Schema<ISensitivitySettings>(
  {
    fallDetectionThreshold: { type: Number, default: 0.8 },
    graceWindowSeconds: { type: Number, default: 60 },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },
    age: { type: Number, required: true, default: 70 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String },
    password: { type: String },
    role: {
      type: String,
      enum: ['patient', 'caregiver', 'senior'],
      default: 'patient',
    },
    linkedPatientId: { type: Schema.Types.ObjectId, ref: 'User' },
    linkedSeniorId: { type: Schema.Types.ObjectId, ref: 'User' },
    primaryLanguage: {
      type: String,
      enum: ['en', 'hi', 'kn', 'ta', 'te', 'mr'],
      default: 'en',
    },
    allergies: [{ type: String }],
    emergencyContacts: [EmergencyContactSchema],
    sensitivitySettings: {
      type: SensitivitySettingsSchema,
      default: () => ({}),
    },
    inviteToken: { type: String },
    inviteExpires: { type: Date },
    isInviteAccepted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

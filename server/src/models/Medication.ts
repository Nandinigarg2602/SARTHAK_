import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IKnownInteraction {
  interactingDrug: string;
  severity: 'Low' | 'Moderate' | 'High' | 'Severe';
  note: string;
}

export interface IMedication extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  drugName: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  instructions: string;
  isActive: boolean;
  knownInteractions: IKnownInteraction[];
  createdAt: Date;
  updatedAt: Date;
}

const KnownInteractionSchema = new Schema<IKnownInteraction>(
  {
    interactingDrug: { type: String },
    severity: {
      type: String,
      enum: ['Low', 'Moderate', 'High', 'Severe'],
    },
    note: { type: String },
  },
  { _id: false }
);

const MedicationSchema = new Schema<IMedication>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    drugName: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    scheduledTimes: [{ type: String }],
    instructions: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    knownInteractions: [KnownInteractionSchema],
  },
  { timestamps: true }
);

export const Medication = mongoose.model<IMedication>('Medication', MedicationSchema);

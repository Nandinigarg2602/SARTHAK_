import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAdherenceLog extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  medicationId: Types.ObjectId;
  scheduledTime: Date;
  takenTime?: Date;
  status: 'TAKEN' | 'MISSED' | 'FLAGGED_WRONG_MED';
  verifiedByVision: boolean;
  visionConfidence?: number;
  pillDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdherenceLogSchema = new Schema<IAdherenceLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    medicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Medication',
      required: true,
    },
    scheduledTime: { type: Date, required: true },
    takenTime: { type: Date },
    status: {
      type: String,
      enum: ['TAKEN', 'MISSED', 'FLAGGED_WRONG_MED'],
      required: true,
    },
    verifiedByVision: { type: Boolean, default: false },
    visionConfidence: { type: Number },
    pillDescription: { type: String },
  },
  { timestamps: true }
);

export const AdherenceLog = mongoose.model<IAdherenceLog>(
  'AdherenceLog',
  AdherenceLogSchema
);

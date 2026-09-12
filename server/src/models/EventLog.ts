import mongoose, { Schema, Document, Types } from 'mongoose';

export type EventType = 'FALL_TRIGGER' | 'MISSED_MEDICATION' | 'DISTRESS_VOICE';
export type EscalationStatus =
  | 'GRACE_PERIOD'
  | 'VERIFIED_SAFE'
  | 'ESCALATED'
  | 'RESOLVED';

export interface IEventLog extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  eventType: EventType;
  escalationStatus: EscalationStatus;
  currentContactNotifiedIndex: number;
  isFalseAlarm: boolean;
  contextSummary: string;
  emergencyLinkToken: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const EventLogSchema = new Schema<IEventLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['FALL_TRIGGER', 'MISSED_MEDICATION', 'DISTRESS_VOICE'],
      required: true,
    },
    escalationStatus: {
      type: String,
      enum: ['GRACE_PERIOD', 'VERIFIED_SAFE', 'ESCALATED', 'RESOLVED'],
      default: 'GRACE_PERIOD',
    },
    currentContactNotifiedIndex: { type: Number, default: 0 },
    isFalseAlarm: { type: Boolean, default: false },
    contextSummary: { type: String, default: '' },
    emergencyLinkToken: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const EventLog = mongoose.model<IEventLog>('EventLog', EventLogSchema);

import { AlertTriangle, Pill, Volume2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { SafetyEvent } from '../types';

interface EventCardProps {
  event: SafetyEvent;
  onFalseAlarm?: (id: string) => void;
  onResolve?: (id: string) => void;
}

const EVENT_CONFIG = {
  FALL_TRIGGER: {
    icon: AlertTriangle,
    label: 'Fall Detected',
    color: 'text-rose-700',
    bg: 'bg-rose-100',
    border: 'border-rose-200',
  },
  MISSED_MEDICATION: {
    icon: Pill,
    label: 'Missed Medication',
    color: 'text-amber-800',
    bg: 'bg-amber-100',
    border: 'border-amber-200',
  },
  DISTRESS_VOICE: {
    icon: Volume2,
    label: 'Distress Call',
    color: 'text-orange-800',
    bg: 'bg-orange-100',
    border: 'border-orange-200',
  },
};

const STATUS_CONFIG = {
  GRACE_PERIOD: { label: 'Grace Period', class: 'badge-warning' },
  VERIFIED_SAFE: { label: 'Safe', class: 'badge-safe' },
  ESCALATED: { label: 'Escalated', class: 'badge-danger' },
  RESOLVED: { label: 'Resolved', class: 'badge-info' },
};

export function EventCard({ event, onFalseAlarm, onResolve }: EventCardProps) {
  const eventCfg = EVENT_CONFIG[event.eventType] || EVENT_CONFIG.FALL_TRIGGER;
  const statusCfg = STATUS_CONFIG[event.escalationStatus] || STATUS_CONFIG.RESOLVED;
  const Icon = eventCfg.icon;
  const timestamp = new Date(event.createdAt);

  return (
    <div
      className={`bg-white border ${eventCfg.border} rounded-2xl p-4 shadow-2xs animate-slide-up`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`shrink-0 w-10 h-10 rounded-xl ${eventCfg.bg} flex items-center justify-center`}
        >
          <Icon size={20} className={eventCfg.color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm sm:text-base font-bold text-surface-900">
              {eventCfg.label}
            </h3>
            <span className={statusCfg.class}>{statusCfg.label}</span>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 text-xs text-surface-700 mb-2">
            <Clock size={13} />
            <time>
              {timestamp.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}{' '}
              {timestamp.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>

          {/* Context summary */}
          {event.contextSummary && (
            <p className="text-xs sm:text-sm text-surface-700 mb-3 leading-relaxed">
              {event.contextSummary}
            </p>
          )}

          {/* False alarm indicator */}
          {event.isFalseAlarm && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-2">
              <XCircle size={14} />
              <span>Marked as false alarm</span>
            </div>
          )}

          {/* Actions */}
          {(event.escalationStatus === 'ESCALATED' || event.escalationStatus === 'GRACE_PERIOD') && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-200">
              {onFalseAlarm && !event.isFalseAlarm && (
                <button
                  onClick={() => onFalseAlarm(event._id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-colors"
                >
                  <XCircle size={14} />
                  Mark False Alarm
                </button>
              )}
              {onResolve && (
                <button
                  onClick={() => onResolve(event._id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sarthak-100 hover:bg-sarthak-200 text-sarthak-900 border border-sarthak-300 text-xs font-bold transition-colors"
                >
                  <CheckCircle size={14} />
                  Resolve Event
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

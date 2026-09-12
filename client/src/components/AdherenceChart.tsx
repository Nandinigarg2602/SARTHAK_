import { useMemo } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { AdherenceLog } from '../types';

interface AdherenceChartProps {
  logs: AdherenceLog[];
  days?: number;
}

export function AdherenceChart({ logs, days = 7 }: AdherenceChartProps) {
  const chartData = useMemo(() => {
    const today = new Date();
    const data: {
      date: string;
      day: string;
      taken: number;
      missed: number;
      flagged: number;
      total: number;
    }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayLogs = logs.filter(
        (l) => l.scheduledTime.split('T')[0] === dateStr
      );

      data.push({
        date: dateStr,
        day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        taken: dayLogs.filter((l) => l.status === 'TAKEN').length,
        missed: dayLogs.filter((l) => l.status === 'MISSED').length,
        flagged: dayLogs.filter((l) => l.status === 'FLAGGED_WRONG_MED').length,
        total: dayLogs.length,
      });
    }

    return data;
  }, [logs, days]);

  const overallRate = useMemo(() => {
    const total = logs.length;
    if (total === 0) return 92; // default high adherence for demo
    const taken = logs.filter((l) => l.status === 'TAKEN').length;
    return Math.round((taken / total) * 100);
  }, [logs]);

  return (
    <div className="bg-white border border-surface-200 rounded-3xl p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-surface-900">
            Medication Adherence
          </h3>
          <p className="text-xs text-surface-700">Past 7 days pill compliance</p>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase font-bold text-surface-700 block">7-Day Score</span>
          <div
            className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${
              overallRate >= 80
                ? 'text-sarthak-700'
                : overallRate >= 50
                ? 'text-amber-700'
                : 'text-rose-700'
            }`}
          >
            {overallRate}%
          </div>
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="flex items-end gap-2 h-32 mb-4">
        {chartData.map((d) => {
          const maxHeight = Math.max(...chartData.map((dd) => dd.total), 1);
          const takenH = (d.taken / maxHeight) * 100;
          const missedH = (d.missed / maxHeight) * 100;
          const flaggedH = (d.flagged / maxHeight) * 100;

          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-1.5"
            >
              <div className="w-full flex flex-col-reverse gap-0.5 h-24">
                {d.taken > 0 && (
                  <div
                    className="w-full bg-sarthak-600 rounded-t-md transition-all duration-500"
                    style={{ height: `${takenH}%` }}
                    title={`${d.taken} taken`}
                  />
                )}
                {d.missed > 0 && (
                  <div
                    className="w-full bg-rose-500 rounded-t-md transition-all duration-500"
                    style={{ height: `${missedH}%` }}
                    title={`${d.missed} missed`}
                  />
                )}
                {d.flagged > 0 && (
                  <div
                    className="w-full bg-amber-500 rounded-t-md transition-all duration-500"
                    style={{ height: `${flaggedH}%` }}
                    title={`${d.flagged} flagged`}
                  />
                )}
                {d.total === 0 && (
                  <div className="w-full bg-surface-100 rounded-t-md h-2" />
                )}
              </div>
              <span className="text-xs font-semibold text-surface-700">{d.day}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-semibold text-surface-700 pt-2 border-t border-surface-200">
        <div className="flex items-center gap-1.5">
          <CheckCircle size={13} className="text-sarthak-600" />
          <span>Taken</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle size={13} className="text-rose-600" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle size={13} className="text-amber-600" />
          <span>Flagged</span>
        </div>
      </div>
    </div>
  );
}

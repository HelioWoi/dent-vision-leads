import React, { useMemo, useState } from 'react';
import { AvailabilitySlot, groupSlotsByDate } from '../../services/bodyshopAvailabilityService';

interface CustomerAvailabilityPickerProps {
  slots: AvailabilitySlot[];
  loading?: boolean;
  shopName?: string;
  selectedDate: string;
  selectedTime: string;
  onSelect: (date: string, timeLabel: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CustomerAvailabilityPicker: React.FC<CustomerAvailabilityPickerProps> = ({
  slots,
  loading,
  shopName,
  selectedDate,
  selectedTime,
  onSelect,
}) => {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDate = useMemo(() => groupSlotsByDate(slots), [slots]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = cursor.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ date, day });
  }

  const selectedDaySlots = selectedDate ? byDate.get(selectedDate) || [] : [];

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#dbe4fa] bg-[#f8faff] p-4 text-sm text-[#64748b]">
        Loading {shopName || 'bodyshop'} availability…
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No open appointment slots right now. The shop will contact you to arrange a time.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold tracking-[0.12em] uppercase text-[#4f46e5]">Choose from shop availability</p>
        <p className="mt-1 text-xs text-[#64748b]">
          Pick an open day and time from {shopName || 'the bodyshop'} agenda. Your booking updates their dashboard instantly.
        </p>
      </div>

      <div className="rounded-2xl border border-[#dbe4fa] bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-[#111827]">{monthLabel}</p>
          <div className="flex gap-1">
            <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-lg border border-[#d7dff5] px-2 py-1 text-sm">←</button>
            <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-lg border border-[#d7dff5] px-2 py-1 text-sm">→</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#64748b]">
          {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell.date || !cell.day) {
              return <div key={`e-${index}`} className="min-h-[52px] rounded-lg bg-[#f8fafc]" />;
            }
            const daySlots = byDate.get(cell.date) || [];
            const hasOpen = daySlots.length > 0;
            const selected = selectedDate === cell.date;
            return (
              <button
                key={cell.date}
                type="button"
                disabled={!hasOpen}
                onClick={() => {
                  if (!hasOpen) return;
                  const first = daySlots[0];
                  onSelect(cell.date, first.timeLabel);
                }}
                className={`min-h-[52px] rounded-lg border p-1 text-left transition ${
                  selected
                    ? 'border-[#4f46e5] bg-[#eef2ff] ring-2 ring-[#4f46e5]/30'
                    : hasOpen
                      ? 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-400'
                      : 'border-[#e5eaf8] bg-[#f8fafc] opacity-50 cursor-not-allowed'
                }`}
              >
                <p className="text-xs font-bold text-[#111827]">{cell.day}</p>
                {hasOpen ? (
                  <p className="text-[9px] font-semibold text-emerald-700">{daySlots.length} open</p>
                ) : (
                  <p className="text-[9px] text-[#94a3b8]">—</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate ? (
        <div className="rounded-2xl border border-[#dbe4fa] bg-[#f8faff] p-3">
          <p className="text-xs font-semibold text-[#475569]">
            Available times on {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedDaySlots.map((slot) => {
              const active = selectedTime === slot.timeLabel;
              return (
                <button
                  key={`${slot.slotDate}-${slot.timePeriod}`}
                  type="button"
                  onClick={() => onSelect(slot.slotDate, slot.timeLabel)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-[#4f46e5] bg-[#4f46e5] text-white'
                      : 'border-[#cfd9ff] bg-white text-[#273548] hover:border-[#4f46e5]'
                  }`}
                >
                  {slot.timeLabel}
                  <span className="ml-1 opacity-75">({slot.spotsLeft} left)</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

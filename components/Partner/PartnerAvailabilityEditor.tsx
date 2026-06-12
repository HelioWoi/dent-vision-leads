import React, { useMemo, useState } from 'react';
import { PartnerAvailabilitySlot } from '../../services/bodyshopAvailabilityService';

interface PartnerAvailabilityEditorProps {
  slots: PartnerAvailabilitySlot[];
  loading?: boolean;
  saving?: boolean;
  onToggle: (slotDate: string, timePeriod: 'morning' | 'afternoon', nextOpen: boolean) => void;
  onRefresh?: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const PartnerAvailabilityEditor: React.FC<PartnerAvailabilityEditorProps> = ({
  slots,
  loading,
  saving,
  onToggle,
  onRefresh,
}) => {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const slotMap = useMemo(() => {
    const map = new Map<string, PartnerAvailabilitySlot>();
    for (const slot of slots) {
      map.set(`${slot.slotDate}:${slot.timePeriod}`, slot);
    }
    return map;
  }, [slots]);

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

  const getSlot = (date: string, period: 'morning' | 'afternoon') =>
    slotMap.get(`${date}:${period}`);

  return (
    <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold text-[#111827]">Booking agenda</h3>
          <p className="text-sm text-[#64748b]">Open days appear to customers when they book. Booked slots fill automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh ? (
            <button type="button" onClick={onRefresh} className="rounded-lg border border-[#cfd9ff] px-3 py-1.5 text-xs font-semibold text-[#273548]">
              Refresh
            </button>
          ) : null}
          <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-lg border border-[#d7dff5] px-2 py-1 text-sm">←</button>
          <span className="min-w-[140px] text-center text-sm font-semibold">{monthLabel}</span>
          <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-lg border border-[#d7dff5] px-2 py-1 text-sm">→</button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#64748b]">Loading availability…</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-[#64748b]">
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-300" /> Open</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#eef2ff] border border-[#4f46e5]" /> Booked</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#f1f5f9] border border-[#cbd5e1]" /> Closed</span>
            {saving ? <span className="text-[#4f46e5] font-semibold">Saving…</span> : null}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#64748b]">
            {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              if (!cell.date || !cell.day) {
                return <div key={`empty-${index}`} className="min-h-[92px] rounded-lg bg-[#f8fafc]" />;
              }

              const morning = getSlot(cell.date, 'morning');
              const afternoon = getSlot(cell.date, 'afternoon');

              const renderPeriod = (slot: PartnerAvailabilitySlot | undefined, period: 'morning' | 'afternoon', label: string) => {
                if (!slot) {
                  return (
                    <button
                      type="button"
                      onClick={() => onToggle(cell.date!, period, true)}
                      className="w-full rounded-md border border-dashed border-[#cbd5e1] bg-white px-1 py-1 text-[9px] text-[#64748b] hover:border-[#4f46e5]"
                    >
                      + {label}
                    </button>
                  );
                }

                const booked = slot.bookedCount > 0;
                const open = slot.isOpen && slot.spotsLeft > 0;
                return (
                  <button
                    type="button"
                    onClick={() => onToggle(cell.date!, period, !slot.isOpen)}
                    className={`w-full rounded-md border px-1 py-1 text-[9px] font-semibold leading-tight ${
                      booked
                        ? 'border-[#4f46e5] bg-[#eef2ff] text-[#4338ca]'
                        : open
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-[#cbd5e1] bg-[#f1f5f9] text-[#64748b]'
                    }`}
                  >
                    {label}
                    {booked ? ` · ${slot.bookedCount} booked` : open ? ' · open' : ' · off'}
                  </button>
                );
              };

              return (
                <div key={cell.date} className="min-h-[92px] rounded-lg border border-[#e5eaf8] bg-white p-1">
                  <p className="mb-1 text-[10px] font-bold text-[#111827]">{cell.day}</p>
                  <div className="space-y-1">
                    {renderPeriod(morning, 'morning', 'AM')}
                    {renderPeriod(afternoon, 'afternoon', 'PM')}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

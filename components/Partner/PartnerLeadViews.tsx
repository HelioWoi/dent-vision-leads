import React, { useMemo, useState } from 'react';
import { PartnerLead, PartnerLeadStatus } from '../../services/partnerPlatformService';
import { exportLeadsToCsv, exportLeadsToPdf } from '../../services/partnerLeadExportService';
import { formatClock, formatRelativeTime, formatInvoiceDueDate, getLeadTimeLeft } from './partnerUi';

export const PartnerAssignmentBadge: React.FC<{
  lead: PartnerLead;
  shopName?: string;
  compact?: boolean;
}> = ({ lead, shopName, compact }) => {
  const name = lead.assignedBodyshopName || shopName || 'Your shop';
  const matchRef = lead.matchId ? lead.matchId.slice(0, 8) : lead.id.slice(0, 8);

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${compact ? '' : 'mb-2'}`}>
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-800">
        Assigned · {name}
      </span>
      <span className="rounded-full border border-[#dbe4ff] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold text-[#475569]">
        Match {matchRef}
      </span>
    </div>
  );
};

const STATUS_LABEL: Record<PartnerLeadStatus, string> = {
  new: 'New',
  quoted: 'Quoted',
  inspection: 'Inspection',
  booked: 'Booked',
  completed: 'Completed',
  declined: 'Declined',
  expired: 'Expired',
  removed: 'Removed',
};

const statusBadgeClass = (status: PartnerLeadStatus) => {
  if (status === 'completed') return 'bg-violet-50 text-violet-800 border-violet-200';
  if (status === 'booked') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'quoted') return 'bg-indigo-50 text-indigo-800 border-indigo-200';
  if (status === 'inspection') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'declined') return 'bg-rose-50 text-rose-800 border-rose-200';
  if (status === 'expired') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (status === 'removed') return 'bg-slate-100 text-slate-500 border-slate-200';
  return 'bg-blue-50 text-blue-800 border-blue-200';
};

export const PartnerLeadPhotoGrid: React.FC<{
  lead: PartnerLead;
  onPreview?: (url: string, alt: string) => void;
  compact?: boolean;
}> = ({ lead, onPreview, compact }) => {
  const slots = Array.from({ length: 4 }, (_, i) => lead.photoUrls[i] || null);
  const cellClass = compact ? 'h-14' : 'h-20';

  return (
    <div className={`grid grid-cols-2 gap-2 ${compact ? 'max-w-[140px]' : ''}`}>
      {slots.map((photo, index) => (
        <button
          key={`${lead.id}-photo-${index}`}
          type="button"
          disabled={!photo}
          onClick={() => photo && onPreview?.(photo, `${lead.damageType} photo ${index + 1}`)}
          className={`relative overflow-hidden rounded-lg border ${photo ? 'border-[#c9d7ff] bg-white cursor-zoom-in' : 'border-dashed border-[#d8e1f7] bg-[#f3f6fd] cursor-not-allowed'} ${cellClass} w-full`}
        >
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-[#94a3b8]">—</span>
          )}
        </button>
      ))}
    </div>
  );
};

export const PartnerLeadHistory: React.FC<{ lead: PartnerLead }> = ({ lead }) => (
  <div className="space-y-2">
    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Request history</p>
    {lead.history.length === 0 ? (
      <p className="text-sm text-[#64748b]">No events recorded yet.</p>
    ) : (
      lead.history.map((event) => (
        <div key={event.id} className="flex gap-3 rounded-lg border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2">
          <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#4f46e5]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#111827]">{event.message}</p>
            <p className="text-xs text-[#64748b]">{formatRelativeTime(event.at)} · {event.type.replace(/_/g, ' ')}</p>
          </div>
        </div>
      ))
    )}
  </div>
);

export const PartnerLeadDetailPanel: React.FC<{
  lead: PartnerLead;
  onPreview?: (url: string, alt: string) => void;
}> = ({ lead, onPreview }) => (
  <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
    <PartnerLeadPhotoGrid lead={lead} onPreview={onPreview} />
    <div className="space-y-3">
      <div className="rounded-lg border border-[#e5eaf8] bg-white px-3 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#64748b]">Customer details</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
          <div><p className="text-xs text-[#64748b]">Name</p><p className="font-semibold text-[#111827]">{lead.customerName}</p></div>
          <div><p className="text-xs text-[#64748b]">Postcode</p><p className="font-semibold text-[#111827]">{lead.customerPostalCode || '—'}</p></div>
          <div><p className="text-xs text-[#64748b]">Email</p><p className="font-semibold text-[#111827] break-all">{lead.customerEmail || '—'}</p></div>
          <div><p className="text-xs text-[#64748b]">Phone</p><p className="font-semibold text-[#111827]">{lead.customerPhone || '—'}</p></div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <div><p className="text-xs text-[#64748b]">Damage</p><p className="font-semibold text-[#111827]">{lead.damageType}</p></div>
        <div><p className="text-xs text-[#64748b]">Panel</p><p className="font-semibold text-[#111827]">{lead.panelLocation}</p></div>
        <div><p className="text-xs text-[#64748b]">Dents</p><p className="font-semibold text-[#111827]">{lead.dentCount}</p></div>
        <div><p className="text-xs text-[#64748b]">AI estimate</p><p className="font-semibold text-[#4f46e5]">${lead.aiEstimateMin}–${lead.aiEstimateMax}</p></div>
        {lead.quoteMin ? (
          <div><p className="text-xs text-[#64748b]">Your quote</p><p className="font-semibold text-[#111827]">${lead.quoteMin}{lead.quoteMax && lead.quoteMax !== lead.quoteMin ? `–$${lead.quoteMax}` : ''}</p></div>
        ) : null}
        {lead.preferredDate ? (
          <div><p className="text-xs text-[#64748b]">Preferred slot</p><p className="font-semibold text-[#111827]">{lead.preferredDate}{lead.preferredTime ? ` · ${lead.preferredTime}` : ''}</p></div>
        ) : null}
        {lead.vehicleRego ? (
          <div><p className="text-xs text-[#64748b]">Rego</p><p className="font-semibold text-[#111827]">{lead.vehicleRego}</p></div>
        ) : null}
      </div>
      {lead.customerComment ? (
        <p className="rounded-lg border border-[#e5eaf8] bg-white px-3 py-2 text-sm text-[#475569]">
          <span className="font-semibold text-[#111827]">Customer note: </span>{lead.customerComment}
        </p>
      ) : null}
      <PartnerLeadHistory lead={lead} />
    </div>
  </div>
);

type PartnerLeadTableProps = {
  leads: PartnerLead[];
  mode: 'leads' | 'quoted' | 'booked' | 'all';
  shopName?: string;
  onPreview?: (url: string, alt: string) => void;
  onSelectLead?: (lead: PartnerLead) => void;
  selectedLeadId?: string | null;
  onDeleteLead?: (lead: PartnerLead) => void;
  renderActions?: (lead: PartnerLead) => React.ReactNode;
  onCompleteJob?: (lead: PartnerLead) => void;
  showCommission?: boolean;
  enableExport?: boolean;
};

export const PartnerLeadExportBar: React.FC<{
  leads: PartnerLead[];
  shopName: string;
  label?: string;
}> = ({ leads, shopName, label = 'Export leads' }) => {
  if (!leads.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2">
      <p className="text-xs font-semibold text-[#475569]">{label} · {leads.length} record{leads.length === 1 ? '' : 's'}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => exportLeadsToCsv(leads, `${shopName.replace(/\s+/g, '-').toLowerCase()}-leads.csv`)}
          className="rounded-lg border border-[#cfd9ff] bg-white px-3 py-1.5 text-xs font-semibold text-[#273548] hover:bg-[#f3f6ff]"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={() => exportLeadsToPdf(leads, shopName)}
          className="rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#273548]"
        >
          Export PDF
        </button>
      </div>
    </div>
  );
};

export const PartnerLeadTable: React.FC<PartnerLeadTableProps> = ({
  leads,
  mode,
  shopName,
  onPreview,
  onSelectLead,
  selectedLeadId,
  onDeleteLead,
  renderActions,
  onCompleteJob,
  showCommission,
  enableExport,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PartnerLeadStatus>('all');

  const filtered = useMemo(() => {
    return leads
      .filter((lead) => (statusFilter === 'all' ? true : lead.status === statusFilter))
      .filter((lead) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          lead.customerRef.toLowerCase().includes(q)
          || lead.customerName.toLowerCase().includes(q)
          || (lead.customerEmail || '').toLowerCase().includes(q)
          || (lead.customerPhone || '').toLowerCase().includes(q)
          || lead.damageType.toLowerCase().includes(q)
          || lead.panelLocation.toLowerCase().includes(q)
          || lead.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [leads, search, statusFilter]);

  return (
    <div className="space-y-3">
      {enableExport && shopName ? <PartnerLeadExportBar leads={filtered} shopName={shopName} /> : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm outline-none focus:border-[#4f46e5]"
          placeholder="Search customer, damage, panel, lead id"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | PartnerLeadStatus)}
          className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm outline-none focus:border-[#4f46e5]"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="flex items-center rounded-xl border border-[#d7dff5] px-3 py-2 text-sm text-[#64748b]">
          {filtered.length} record{filtered.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#d9e2ff] bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.8)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#f3f6ff] text-xs uppercase tracking-[0.08em] text-[#475569]">
              <tr>
                <th className="px-4 py-3">Photo</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Damage / Panel</th>
                <th className="px-4 py-3">AI estimate</th>
                {mode !== 'leads' ? <th className="px-4 py-3">Your quote</th> : null}
                {mode === 'booked' ? <th className="px-4 py-3">Booking</th> : null}
                {showCommission ? <th className="px-4 py-3">Commission</th> : null}
                {showCommission ? <th className="px-4 py-3">Customer review</th> : null}
                <th className="px-4 py-3">Status</th>
                {mode === 'leads' ? <th className="px-4 py-3">SLA</th> : null}
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const timer = getLeadTimeLeft(lead.responseDeadlineAt);
                const selected = selectedLeadId === lead.id;
                return (
                  <React.Fragment key={lead.id}>
                    <tr className={`border-t border-[#eef2ff] align-top ${selected ? 'bg-[#f8fbff]' : ''}`}>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => lead.photoUrl && onPreview?.(lead.photoUrl, lead.damageType)}
                          className="h-14 w-14 overflow-hidden rounded-lg border border-[#dbe4ff] bg-[#f8fbff]"
                        >
                          <img src={lead.photoUrl} alt="" className="h-full w-full object-cover" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <PartnerAssignmentBadge lead={lead} shopName={shopName} compact />
                        <p className="font-semibold text-[#111827] mt-1">{lead.customerName}</p>
                        <p className="text-xs text-[#64748b]">{lead.customerRef} · {lead.id.slice(0, 8)}…</p>
                        {lead.customerContact ? (
                          <p className="mt-1 text-xs text-[#475569] leading-relaxed">{lead.customerContact}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#111827]">{lead.damageType}</p>
                        <p className="text-xs text-[#64748b]">{lead.panelLocation} · {lead.dentCount} dent{lead.dentCount !== 1 ? 's' : ''}</p>
                        {lead.paintRepairNeeded ? <p className="text-xs font-semibold text-amber-700">Paint repair flagged</p> : null}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#4f46e5]">${lead.aiEstimateMin}–${lead.aiEstimateMax}</td>
                      {mode !== 'leads' ? (
                        <td className="px-4 py-3 font-semibold text-[#111827]">
                          {lead.quoteMin ? `$${lead.quoteMin}${lead.quoteMax && lead.quoteMax !== lead.quoteMin ? `–$${lead.quoteMax}` : ''}` : '—'}
                        </td>
                      ) : null}
                      {mode === 'booked' ? (
                        <td className="px-4 py-3 text-[#334155]">
                          {lead.preferredDate ? (
                            <>
                              <p className="font-medium">{lead.preferredDate}</p>
                              <p className="text-xs text-[#64748b]">{lead.preferredTime || 'Time TBC'}</p>
                              {lead.vehicleRego ? <p className="text-xs text-[#64748b]">Rego {lead.vehicleRego}</p> : null}
                            </>
                          ) : (
                            <span className="text-[#64748b]">Pending schedule</span>
                          )}
                        </td>
                      ) : null}
                      {showCommission ? (
                        <td className="px-4 py-3 font-semibold text-[#92400e]">
                          {lead.commissionAmount ? `$${lead.commissionAmount}` : '—'}
                          {lead.commissionStatus ? (
                            <p className="text-[10px] font-normal capitalize text-[#64748b]">{lead.commissionStatus}</p>
                          ) : null}
                        </td>
                      ) : null}
                      {showCommission ? (
                        <td className="px-4 py-3 text-sm text-[#475569]">
                          {lead.serviceReviewSubmitted
                            ? `${lead.serviceReviewRating || '—'}★ confirmed`
                            : lead.status === 'completed'
                              ? 'Awaiting customer'
                              : '—'}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${statusBadgeClass(lead.status)}`}>
                          {STATUS_LABEL[lead.status]}
                        </span>
                      </td>
                      {mode === 'leads' ? (
                        <td className="px-4 py-3 text-sm font-semibold text-[#fb923c]">{lead.status === 'new' ? timer.label : '—'}</td>
                      ) : null}
                      <td className="px-4 py-3 text-xs text-[#64748b]">{formatRelativeTime(lead.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {lead.status === 'booked' && onCompleteJob ? (
                            <button
                              type="button"
                              onClick={() => onCompleteJob(lead)}
                              className="rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#273548]"
                            >
                              Mark complete
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onSelectLead?.(lead)}
                            className="rounded-lg border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548] hover:bg-[#f3f6ff]"
                          >
                            {selected ? 'Hide detail' : 'View history'}
                          </button>
                          {onDeleteLead ? (
                            <button
                              type="button"
                              onClick={() => onDeleteLead(lead)}
                              className="rounded-lg border border-[#fecaca] px-2 py-1 text-xs font-semibold text-[#be123c] hover:bg-[#fff1f2]"
                            >
                              Remove
                            </button>
                          ) : null}
                          {renderActions?.(lead)}
                        </div>
                      </td>
                    </tr>
                    {selected ? (
                      <tr className="border-t border-[#eef2ff] bg-[#fbfcff]">
                        <td colSpan={mode === 'booked' ? (showCommission ? 11 : 9) : mode === 'leads' ? 8 : 7} className="px-4 py-4">
                          <PartnerLeadDetailPanel lead={lead} onPreview={onPreview} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#64748b]">No leads match your filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const PartnerBookingCalendar: React.FC<{
  leads: PartnerLead[];
  selectedLeadId?: string | null;
  onSelectLead?: (lead: PartnerLead) => void;
  onPreview?: (url: string, alt: string) => void;
}> = ({ leads, selectedLeadId, onSelectLead, onPreview }) => {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const bookedByDate = useMemo(() => {
    const map = new Map<string, PartnerLead[]>();
    for (const lead of leads) {
      if (!lead.preferredDate) continue;
      const key = lead.preferredDate.slice(0, 10);
      const list = map.get(key) || [];
      list.push(lead);
      map.set(key, list);
    }
    return map;
  }, [leads]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ date, day });
  }

  const monthLabel = cursor.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-[#111827]">Booking calendar</h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-lg border border-[#d7dff5] px-2 py-1 text-sm">←</button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-[#111827]">{monthLabel}</span>
          <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-lg border border-[#d7dff5] px-2 py-1 text-sm">→</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#64748b]">
        {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell.date || !cell.day) {
            return <div key={`empty-${index}`} className="min-h-[88px] rounded-lg bg-[#f8fafc]" />;
          }
          const dayLeads = bookedByDate.get(cell.date) || [];
          return (
            <div key={cell.date} className={`min-h-[88px] rounded-lg border p-1.5 text-left ${dayLeads.length ? 'border-emerald-200 bg-emerald-50/60' : 'border-[#e5eaf8] bg-white'}`}>
              <p className="text-xs font-bold text-[#111827]">{cell.day}</p>
              <div className="mt-1 space-y-1">
                {dayLeads.slice(0, 2).map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => onSelectLead?.(lead)}
                    className={`w-full rounded-md px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm transition hover:ring-2 hover:ring-[#4f46e5]/40 ${
                      selectedLeadId === lead.id
                        ? 'bg-[#eef2ff] text-[#4338ca] ring-2 ring-[#4f46e5]'
                        : 'bg-white/90 text-[#166534]'
                    }`}
                  >
                    <p className="font-semibold truncate">{lead.customerRef}</p>
                    <p className="truncate">{lead.preferredTime || formatClock(lead.bookedAt || lead.createdAt)}</p>
                  </button>
                ))}
                {dayLeads.length > 2 ? (
                  <p className="text-[10px] font-semibold text-[#64748b]">+{dayLeads.length - 2} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Open repair tasks — complete action sits inline next to each lead row */
export const PartnerJobTaskList: React.FC<{
  leads: PartnerLead[];
  onComplete: (lead: PartnerLead) => void;
  onPreview?: (url: string, alt: string) => void;
  onSelectLead?: (lead: PartnerLead) => void;
  selectedLeadId?: string | null;
  emptyMessage?: string;
}> = ({ leads, onComplete, onPreview, onSelectLead, selectedLeadId, emptyMessage }) => {
  if (!leads.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d7dff5] bg-[#f8fbff] px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[#475569]">{emptyMessage || 'No open tasks right now.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {leads.map((lead) => {
        const jobValue = lead.quoteMin ?? lead.aiEstimateMin ?? 0;
        const fee = Math.round(jobValue * 0.1);
        return (
          <div
            key={lead.id}
            className={`group flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm transition hover:shadow-md ${
              selectedLeadId === lead.id ? 'border-[#4f46e5] ring-2 ring-[#4f46e5]/20' : 'border-[#e5eaf8] hover:border-[#c7d2fe]'
            }`}
          >
            <button
              type="button"
              onClick={() => lead.photoUrl && onPreview?.(lead.photoUrl, lead.damageType)}
              className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-[#dbe4ff] bg-[#f8fbff]"
            >
              {lead.photoUrl ? <img src={lead.photoUrl} alt="" className="h-full w-full object-cover" /> : null}
            </button>
            <button
              type="button"
              onClick={() => onSelectLead?.(lead)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#111827]">{lead.customerRef}</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Booked</span>
              </div>
              <p className="text-sm text-[#64748b]">
                {lead.damageType} · {lead.panelLocation}
                {lead.preferredDate ? ` · ${lead.preferredDate}` : ''}
              </p>
              <p className="mt-0.5 text-xs text-[#94a3b8]">
                Job ${jobValue} · platform fee ${fee} (10%) after you confirm completion
              </p>
              <p className="mt-1 text-xs font-semibold text-[#4f46e5]">View full job →</p>
            </button>
            <button
              type="button"
              onClick={() => onComplete(lead)}
              className="flex-shrink-0 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#273548]"
            >
              Mark complete
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const PartnerCommissionReport: React.FC<{
  completedJobs: PartnerLead[];
  commissionEntries: Array<{
    id: string;
    customerRef?: string;
    leadId: string;
    jobValue: number;
    commissionAmount: number;
    status: string;
    completedAt?: string;
    serviceReviewSubmitted?: boolean;
    serviceReviewRating?: number;
  }>;
  totalDue: number;
  paidTotal: number;
  nextInvoiceDate: string;
}> = ({ completedJobs, commissionEntries, totalDue, paidTotal, nextInvoiceDate }) => (
  <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#e5eaf8] bg-white p-4">
        <p className="text-xs font-medium text-[#64748b]">Jobs completed</p>
        <p className="mt-1 text-2xl font-extrabold text-[#111827]">{completedJobs.length}</p>
      </div>
      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4">
        <p className="text-xs font-medium text-[#92400e]">Your balance due (10%)</p>
        <p className="mt-1 text-2xl font-extrabold text-[#92400e]">${totalDue}</p>
        <p className="mt-1 text-xs text-[#92400e]">Next invoice · {nextInvoiceDate}</p>
      </div>
      <div className="rounded-xl border border-[#bbf7d0] bg-[#ecfdf3] p-4">
        <p className="text-xs font-medium text-[#166534]">Already paid</p>
        <p className="mt-1 text-2xl font-extrabold text-[#166534]">${paidTotal}</p>
      </div>
    </div>

    {commissionEntries.length ? (
      <div className="overflow-hidden rounded-2xl border border-[#e5eaf8] bg-white">
        <div className="border-b border-[#eef2ff] px-4 py-3">
          <h4 className="text-sm font-extrabold text-[#111827]">Fee statement</h4>
          <p className="text-xs text-[#64748b]">Platform fee on completed jobs — billed monthly to your shop</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#f8fbff] text-xs uppercase tracking-[0.08em] text-[#64748b]">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Job value</th>
                <th className="px-4 py-3">Platform fee</th>
                <th className="px-4 py-3">Customer confirmed</th>
                <th className="px-4 py-3">Invoice due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissionEntries.map((entry) => (
                <tr key={entry.id} className="border-t border-[#eef2ff]">
                  <td className="px-4 py-3 font-medium text-[#111827]">{entry.customerRef || entry.leadId.slice(0, 8)}</td>
                  <td className="px-4 py-3">${entry.jobValue}</td>
                  <td className="px-4 py-3 font-semibold text-[#92400e]">${entry.commissionAmount}</td>
                  <td className="px-4 py-3 text-[#475569]">
                    {entry.serviceReviewSubmitted
                      ? `${entry.serviceReviewRating ?? '—'}★ Yes`
                      : 'Pending email'}
                  </td>
                  <td className="px-4 py-3 text-[#475569]">{formatInvoiceDueDate(entry.completedAt)}</td>
                  <td className="px-4 py-3 capitalize text-[#475569]">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : null}
  </div>
);

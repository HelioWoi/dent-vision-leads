import React, { useEffect, useMemo, useState } from 'react';
import {
  formatEstimateRange,
  getPartnerLeadByToken,
  respondPartnerLeadByToken,
  resolveLeadPhotoUrls,
} from '../../services/partnerQuickRespondService';
import { LEAD_RESPONSE_SLA_MINUTES } from '../../services/leadSla';
import { getLeadTimeLeft } from './partnerUi';

const parseToken = () => {
  const hash = window.location.hash.includes('%')
    ? `#${decodeURIComponent(window.location.hash.slice(1))}`
    : window.location.hash;
  const hashQuery = hash.split('?')[1] || '';
  const params = new URLSearchParams(hashQuery);
  return params.get('token') || '';
};

const PartnerQuickRespondPage: React.FC = () => {
  const [token] = useState(parseToken);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<Awaited<ReturnType<typeof getPartnerLeadByToken>> | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [draft, setDraft] = useState({ pdr: '', paint: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resultStatus, setResultStatus] = useState('');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const loadContext = async () => {
    const result = await getPartnerLeadByToken(token);
    setContext(result);
    const lead = result.lead;
    const existing = result.existingQuote;
    setDraft({
      pdr: String(existing?.quote_pdr ?? lead?.ai_pdr_estimate_max ?? lead?.ai_estimate_max ?? ''),
      paint: String(existing?.quote_paint ?? ''),
      note: existing?.shop_note ?? '',
    });
    setLoading(false);
  };

  useEffect(() => {
    void loadContext();
  }, [token]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const lead = context?.lead;
  const photos = useMemo(() => resolveLeadPhotoUrls(lead), [lead]);
  const paintNeeded = !!lead?.paint_repair_needed;
  const pdrMin = lead?.ai_pdr_estimate_min ?? lead?.ai_estimate_min;
  const pdrMax = lead?.ai_pdr_estimate_max ?? lead?.ai_estimate_max;
  const pdrLabel = formatEstimateRange(pdrMin, pdrMax);
  const expired = context?.matchStatus === 'expired';
  const timer = useMemo(
    () => (context?.responseDeadline ? getLeadTimeLeft(context.responseDeadline) : null),
    [context?.responseDeadline, tick],
  );
  const draftPdr = Number(draft.pdr || 0);
  const draftPaint = Number(draft.paint || 0);
  const draftTotal = draftPdr + draftPaint;
  const canRespond = !!context?.canRespond && !expired;

  const finish = (status: string) => {
    setResultStatus(status);
    setDone(true);
  };

  const handleAcceptAI = async () => {
    setSubmitting(true);
    setError('');
    const result = await respondPartnerLeadByToken(token, 'accept_ai');
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not save your response.');
      return;
    }
    finish(result.status || 'quoted');
  };

  const handleAdjustQuote = async () => {
    if (!draftPdr && !draftPaint) {
      setError('Enter PDR and/or paint amounts.');
      return;
    }
    setSubmitting(true);
    setError('');
    const breakdownNote =
      draftPaint > 0
        ? `PDR $${draftPdr} + Paint $${draftPaint} = $${draftTotal}${draft.note ? ` — ${draft.note}` : ''}`
        : draft.note || '';
    const result = await respondPartnerLeadByToken(token, 'quote', {
      quoteMin: draftTotal,
      quoteMax: draftTotal,
      quotePdr: draftPdr,
      quotePaint: draftPaint || undefined,
      note: breakdownNote,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not save your quote.');
      return;
    }
    setAdjustOpen(false);
    finish(result.status || 'quoted');
  };

  const handleInspection = async () => {
    setSubmitting(true);
    setError('');
    const result = await respondPartnerLeadByToken(token, 'inspection', {
      note: draft.note.trim() || 'In-person inspection requested by bodyshop',
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not save.');
      return;
    }
    finish(result.status || 'inspection');
  };

  const handleDecline = async () => {
    setSubmitting(true);
    setError('');
    const result = await respondPartnerLeadByToken(token, 'decline', {
      note: draft.note.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not save.');
      return;
    }
    finish(result.status || 'declined');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f6fd] flex items-center justify-center p-6">
        <p className="text-sm text-[#64748b]">Loading lead…</p>
      </div>
    );
  }

  if (!context?.valid) {
    return (
      <div className="min-h-screen bg-[#f3f6fd] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-[#e4e9f8] bg-white p-6 text-center shadow-lg">
          <h1 className="text-xl font-extrabold text-[#111827]">Invalid link</h1>
          <p className="mt-2 text-sm text-[#64748b]">
            {context?.expired
              ? 'This quick-quote link has expired. Log in to your partner dashboard to view active leads.'
              : 'This link may be incorrect or no longer available.'}
          </p>
        </div>
      </div>
    );
  }

  if (done || context.alreadyResponded) {
    const isDeclined = resultStatus === 'declined' || context.matchStatus === 'declined';
    return (
      <div className="min-h-screen bg-[#f3f6fd] flex items-center justify-center p-6">
        <div className={`max-w-md rounded-2xl border p-6 text-center shadow-lg ${isDeclined ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-[#bbf7d0] bg-[#ecfdf3]'}`}>
          <h1 className={`text-xl font-extrabold ${isDeclined ? 'text-[#991b1b]' : 'text-[#166534]'}`}>
            {isDeclined ? 'Lead declined' : 'Response saved'}
          </h1>
          <p className={`mt-2 text-sm ${isDeclined ? 'text-[#991b1b]' : 'text-[#166534]'}`}>
            {isDeclined
              ? 'You passed on this lead. The customer may be routed to another shop.'
              : 'Your quote is live — the customer can book once they accept it.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6fd] p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl border border-[#e4e9f8] bg-white p-5 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.25)]">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#4f46e5]">Dent Vision · Quick quote</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#111827]">{context.bodyshopName}</h1>
          <p className="text-sm text-[#64748b]">{context.bodyshopRegion}</p>
          {context.matchStatus === 'quoted' || context.matchStatus === 'inspection' ? (
            <p className="mt-3 inline-flex rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
              Update your {context.matchStatus === 'inspection' ? 'inspection request' : 'quote'} below
            </p>
          ) : null}
        </header>

        <article className="relative rounded-2xl border border-[#e4e9f8] bg-white p-4 shadow-[0_15px_35px_-28px_rgba(15,23,42,0.8)]">
          {expired ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/72">
              <p className="-rotate-12 text-lg font-extrabold tracking-[0.2em] text-[#94a3b8]">EXPIRED LEAD</p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto] lg:items-start">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#dbe4ff] bg-[#f8fbff] p-2">
              {Array.from({ length: 4 }, (_, index) => photos[index] || null).map((photo, slotIndex) => (
                <div
                  key={`photo-${slotIndex}`}
                  className={`relative overflow-hidden rounded-lg border h-20 w-full ${photo ? 'border-[#c9d7ff] bg-white' : 'border-dashed border-[#d8e1f7] bg-[#f3f6fd]'}`}
                >
                  {photo ? (
                    <img src={photo} alt={`Damage photo ${slotIndex + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] font-semibold text-[#94a3b8]">Empty slot</span>
                  )}
                </div>
              ))}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#5a4fff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">New</span>
                {paintNeeded ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800">
                    Paint repair
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-800">
                    PDR only
                  </span>
                )}
                <p className="text-lg font-extrabold text-[#111827]">{lead?.damage_category || 'Dent repair'}</p>
              </div>
              <p className="text-sm text-[#475569]">
                {lead?.damage_location || 'Vehicle panel'} · {lead?.dent_count || 1} dent{(lead?.dent_count || 1) !== 1 ? 's' : ''}
              </p>
              {lead?.customer_name && <p className="mt-1 text-sm text-[#64748b]">{lead.customer_name}{lead.postal_code ? ` · ${lead.postal_code}` : ''}</p>}
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                {paintNeeded ? 'AI estimate · PDR (dent removal)' : 'AI estimate · PDR'}
              </p>
              <p className="text-2xl font-extrabold text-[#4f46e5]">{pdrLabel}</p>
              {paintNeeded ? (
                <p className="mt-1 text-xs font-medium text-amber-800">
                  Chipped paint detected — quote PDR and paint separately below.
                </p>
              ) : null}
              {lead?.customer_comment ? (
                <p className="mt-3 rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2 text-sm text-[#475569]">“{lead.customer_comment}”</p>
              ) : null}
            </div>

            {timer ? (
              <div className="flex flex-row items-center gap-3 lg:flex-col lg:gap-0">
                <div
                  className="relative h-20 w-20 rounded-full"
                  style={{ background: `conic-gradient(#fb923c ${Math.round(timer.ratio * 360)}deg, #e2e8f0 0deg)` }}
                >
                  <div className="absolute inset-[5px] rounded-full bg-white flex items-center justify-center text-base font-extrabold text-[#111827]">
                    {timer.label}
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-[#475569] text-left lg:mt-2 lg:text-center">
                  Respond within<br /><span className="text-[#fb923c]">{LEAD_RESPONSE_SLA_MINUTES} minutes</span>
                </p>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#991b1b]">{error}</p>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => void handleAcceptAI()}
              disabled={!canRespond || submitting}
              className="rounded-xl border border-[#bbf7d0] bg-[#ecfdf3] px-3 py-2 text-sm font-semibold text-[#166534] disabled:opacity-60"
            >
              Accept AI Estimate
            </button>
            <button
              type="button"
              onClick={() => setAdjustOpen((open) => !open)}
              disabled={!canRespond || submitting}
              className="rounded-xl border border-[#cfd9ff] bg-[#eef2ff] px-3 py-2 text-sm font-semibold text-[#4338ca] disabled:opacity-60"
            >
              Adjust Price
            </button>
            <button
              type="button"
              onClick={() => void handleInspection()}
              disabled={!canRespond || submitting}
              className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-sm font-semibold text-[#92400e] disabled:opacity-60"
            >
              Need Inspection
            </button>
            <button
              type="button"
              onClick={() => void handleDecline()}
              disabled={!canRespond || submitting}
              className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-[#991b1b] disabled:opacity-60"
            >
              Decline
            </button>
          </div>

          {adjustOpen ? (
            <div className="mt-4 rounded-xl border border-[#dbe4ff] bg-[#f8fbff] p-4">
              <p className="text-sm font-semibold text-[#111827]">Custom quote</p>
              <div className={`mt-3 grid gap-3 ${paintNeeded ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="text-xs font-semibold text-[#64748b]">PDR ($)</label>
                  <input
                    type="number"
                    value={draft.pdr}
                    onChange={(e) => setDraft((prev) => ({ ...prev, pdr: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                  />
                </div>
                {paintNeeded ? (
                  <div>
                    <label className="text-xs font-semibold text-[#64748b]">Paint touch-up ($)</label>
                    <input
                      type="number"
                      value={draft.paint}
                      onChange={(e) => setDraft((prev) => ({ ...prev, paint: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
              </div>
              {paintNeeded && draftTotal > 0 ? (
                <p className="mt-2 text-sm font-semibold text-[#4338ca]">
                  Total: ${draftPdr}{draftPaint > 0 ? ` + $${draftPaint} paint` : ''} = ${draftTotal}
                </p>
              ) : null}
              <textarea
                value={draft.note}
                onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional note for the customer"
                className="mt-3 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                rows={2}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAdjustQuote()}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#273548] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : 'Send quote'}
                </button>
                <button type="button" onClick={() => setAdjustOpen(false)} className="rounded-xl border border-[#e5eaf8] px-4 py-2.5 text-sm font-semibold text-[#64748b]">
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
};

export default PartnerQuickRespondPage;

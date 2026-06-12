import React, { useEffect, useMemo, useState } from 'react';
import {
  formatEstimateRange,
  getPartnerLeadByToken,
  respondPartnerLeadByToken,
  resolveLeadPhotoUrls,
} from '../../services/partnerQuickRespondService';

const parseToken = () => {
  const hashQuery = window.location.hash.split('?')[1] || '';
  const params = new URLSearchParams(hashQuery);
  return params.get('token') || '';
};

const formatCountdown = (deadline?: string) => {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Response window closed';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, '0')} left to respond`;
};

const PartnerQuickRespondPage: React.FC = () => {
  const [token] = useState(parseToken);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<Awaited<ReturnType<typeof getPartnerLeadByToken>> | null>(null);
  const [mode, setMode] = useState<'accept' | 'quote' | 'decline' | 'inspection' | null>(null);
  const [quoteMin, setQuoteMin] = useState('');
  const [quoteMax, setQuoteMax] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [resultStatus, setResultStatus] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getPartnerLeadByToken(token);
      if (!active) return;
      setContext(result);
      const lead = result.lead;
      if (lead?.ai_estimate_min) {
        setQuoteMin(String(lead.ai_estimate_min));
        setQuoteMax(String(lead.ai_estimate_max || lead.ai_estimate_min));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!context?.responseDeadline) return undefined;
    const tick = () => setCountdown(formatCountdown(context.responseDeadline));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [context?.responseDeadline]);

  const photos = useMemo(() => resolveLeadPhotoUrls(context?.lead), [context?.lead]);
  const estimateLabel = useMemo(
    () => formatEstimateRange(context?.lead?.ai_estimate_min, context?.lead?.ai_estimate_max),
    [context?.lead],
  );

  const handleSubmit = async (action: 'accept_ai' | 'quote' | 'decline' | 'inspection') => {
    setSubmitting(true);
    setError('');

    const min = quoteMin ? Number(quoteMin) : undefined;
    const max = quoteMax ? Number(quoteMax) : min;

    if (action === 'quote' && (!min || min <= 0)) {
      setError('Enter a valid quote amount.');
      setSubmitting(false);
      return;
    }

    const result = await respondPartnerLeadByToken(token, action, {
      quoteMin: action === 'accept_ai' ? undefined : min,
      quoteMax: action === 'accept_ai' ? undefined : max,
      note: note.trim() || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not save your response.');
      return;
    }

    setResultStatus(result.status || action);
    setDone(true);
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
          {!isDeclined && (
            <p className="mt-3 text-xs text-[#64748b]">
              You can also manage this lead in your partner dashboard when logged in.
            </p>
          )}
        </div>
      </div>
    );
  }

  const lead = context.lead;

  return (
    <div className="min-h-screen bg-[#f3f6fd] p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="rounded-2xl border border-[#e4e9f8] bg-white p-5 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.25)]">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#4f46e5]">Dent Vision · Quick quote</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#111827]">New lead for {context.bodyshopName}</h1>
          <p className="mt-1 text-sm text-[#64748b]">{context.bodyshopRegion}</p>
          {countdown && (
            <p className="mt-3 inline-flex rounded-full border border-[#fde68a] bg-[#fffbeb] px-3 py-1 text-xs font-semibold text-[#92400e]">
              {countdown}
            </p>
          )}
        </header>

        <section className="rounded-2xl border border-[#e4e9f8] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Customer</p>
              <p className="text-lg font-extrabold text-[#111827]">{lead?.customer_name || 'Customer'}</p>
              {lead?.postal_code && <p className="text-sm text-[#64748b]">Postcode {lead.postal_code}</p>}
            </div>
            <div className="rounded-xl border border-[#d3dcff] bg-[#f4f7ff] px-4 py-2 text-right">
              <p className="text-xs font-semibold text-[#64748b]">AI estimate</p>
              <p className="text-xl font-extrabold text-[#4338ca]">{estimateLabel}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
              <p className="text-xs text-[#64748b]">Damage</p>
              <p className="text-sm font-semibold text-[#111827]">{lead?.damage_category || 'Dent repair'}</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
              <p className="text-xs text-[#64748b]">Panel / location</p>
              <p className="text-sm font-semibold text-[#111827]">{lead?.damage_location || 'Vehicle panel'}</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
              <p className="text-xs text-[#64748b]">Dents</p>
              <p className="text-sm font-semibold text-[#111827]">{lead?.dent_count || 1}</p>
            </div>
            <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
              <p className="text-xs text-[#64748b]">Paint repair</p>
              <p className="text-sm font-semibold text-[#111827]">{lead?.paint_repair_needed ? 'Likely needed' : 'Not flagged'}</p>
            </div>
          </div>

          {lead?.customer_comment && (
            <p className="mt-4 rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2 text-sm text-[#475569]">
              “{lead.customer_comment}”
            </p>
          )}

          {photos.length > 0 && (
            <div className={`mt-4 grid gap-2 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {photos.slice(0, 4).map((url, index) => (
                <div key={url + index} className="aspect-[4/3] overflow-hidden rounded-xl border border-[#e5eaf8] bg-[#f1f5f9]">
                  <img src={url} alt={`Damage photo ${index + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#e4e9f8] bg-white p-5">
          <h2 className="text-lg font-extrabold text-[#111827]">Your response</h2>
          <p className="mt-1 text-sm text-[#64748b]">No login required — this secure link updates your shop dashboard.</p>

          {error && (
            <p className="mt-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#991b1b]">{error}</p>
          )}

          {!mode && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleSubmit('accept_ai')}
                disabled={submitting}
                className="rounded-xl bg-[#4f46e5] px-4 py-3 text-sm font-bold text-white hover:bg-[#4338ca] disabled:opacity-60"
              >
                Accept AI price ({estimateLabel})
              </button>
              <button
                type="button"
                onClick={() => setMode('quote')}
                className="rounded-xl border border-[#cfd9ff] bg-[#f4f7ff] px-4 py-3 text-sm font-bold text-[#4338ca]"
              >
                Send custom quote
              </button>
              <button
                type="button"
                onClick={() => setMode('inspection')}
                className="rounded-xl border border-[#e5eaf8] bg-white px-4 py-3 text-sm font-semibold text-[#475569]"
              >
                Request inspection
              </button>
              <button
                type="button"
                onClick={() => setMode('decline')}
                className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#991b1b]"
              >
                Decline lead
              </button>
            </div>
          )}

          {mode === 'quote' && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-[#64748b]">Quote from ($)</label>
                  <input
                    type="number"
                    value={quoteMin}
                    onChange={(e) => setQuoteMin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#64748b]">Quote to ($)</label>
                  <input
                    type="number"
                    value={quoteMax}
                    onChange={(e) => setQuoteMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note for the customer"
                className="w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSubmit('quote')}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#273548] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Send quote'}
                </button>
                <button type="button" onClick={() => setMode(null)} className="rounded-xl border border-[#e5eaf8] px-4 py-2.5 text-sm font-semibold text-[#64748b]">
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === 'inspection' && (
            <div className="mt-4 space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell the customer what you need to inspect (optional)"
                className="w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSubmit('inspection')}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#273548] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Request inspection'}
                </button>
                <button type="button" onClick={() => setMode(null)} className="rounded-xl border border-[#e5eaf8] px-4 py-2.5 text-sm font-semibold text-[#64748b]">
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === 'decline' && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-[#64748b]">The customer may be offered to another shop in your network.</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional reason (internal)"
                className="w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSubmit('decline')}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#991b1b] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : 'Confirm decline'}
                </button>
                <button type="button" onClick={() => setMode(null)} className="rounded-xl border border-[#e5eaf8] px-4 py-2.5 text-sm font-semibold text-[#64748b]">
                  Back
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PartnerQuickRespondPage;

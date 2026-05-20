import React, { useEffect, useMemo, useState } from 'react';
import EstimateHeader from './EstimateHeader';
import DarkFooter from '../DarkFooter';
import { submitBookingRequest } from '../../services/bookingService';

interface StoredEstimateData {
  estimateMin?: number;
  estimateMax?: number;
  dents?: number;
  damageCategory?: string;
  location?: string;
  zip?: string;
  customer?: {
    name?: string;
    email?: string;
  };
}

interface StoredShopTarget {
  name?: string;
  price?: number;
}

const BookingForm: React.FC = () => {
  const [estimate, setEstimate] = useState<StoredEstimateData | null>(null);
  const [targetShop, setTargetShop] = useState<StoredShopTarget | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [rego, setRego] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('Morning (08:00-12:00)');
  const [note, setNote] = useState('');
  const [agreeLiability, setAgreeLiability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [secondsToHome, setSecondsToHome] = useState(6);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    const rawEstimate = sessionStorage.getItem('estimateData');
    const rawTarget = sessionStorage.getItem('bookingTargetShop');

    if (rawEstimate) {
      try {
        const parsed: StoredEstimateData = JSON.parse(rawEstimate);
        setEstimate(parsed);
        setCustomerName(parsed.customer?.name || '');
        setCustomerEmail(parsed.customer?.email || '');
        setPostalCode(parsed.zip || '');
      } catch {
        setEstimate(null);
      }
    }

    if (rawTarget) {
      try {
        const parsed: StoredShopTarget = JSON.parse(rawTarget);
        setTargetShop(parsed);
      } catch {
        setTargetShop(null);
      }
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPreferredDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const files = (window as any).__leadUploadFiles as File[] | undefined;
    if (!files?.length) return;

    const urls = files.slice(0, 4).map((file) => URL.createObjectURL(file));
    setPhotoUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    if (secondsToHome <= 0) {
      window.location.hash = '#/';
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsToHome((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [success, secondsToHome]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
  const isPhoneValid = customerPhone.trim().length >= 8;
  const canSubmit = customerName.trim().length >= 2 && isEmailValid && isPhoneValid && rego.trim().length >= 2 && postalCode.trim().length >= 3 && preferredDate && agreeLiability;

  const estimateLabel = useMemo(() => {
    const min = Number(estimate?.estimateMin || 0);
    const max = Number(estimate?.estimateMax || 0);
    if (!min && !max) return 'To be confirmed after review';
    if (min && max && min !== max) return `$${min} - $${max}`;
    return `$${min || max}`;
  }, [estimate]);

  const shopInitials = useMemo(() => {
    const source = String(targetShop?.name || 'Bodyshop Partner').trim();
    const words = source.split(/\s+/).filter(Boolean);
    if (!words.length) return 'BS';
    return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() || '')
      .join('');
  }, [targetShop?.name]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await submitBookingRequest({
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      rego: rego.trim(),
      postalCode: postalCode.trim(),
      preferredDate,
      preferredTime,
      note,
      zip: estimate?.zip,
      damageCategory: estimate?.damageCategory,
      location: estimate?.location,
      dents: Number(estimate?.dents || 1),
      estimateMin: Number(estimate?.estimateMin || 0),
      estimateMax: Number(estimate?.estimateMax || 0),
      targetShopName: targetShop?.name,
      targetShopPrice: targetShop?.price,
    });

    setSubmitting(false);

    if (!result.ok) {
      const backendNotReady = /lead_requests|shop_lead_matches|schema cache|does not exist|relation|not configured/i.test(String(result.error || ''));
      if (backendNotReady) {
        setPreviewMode(true);
        setSuccess(true);
        return;
      }

      setError('We could not submit your booking right now. Please try again shortly.');
      return;
    }

    setPreviewMode(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#eef2f8]">
        <EstimateHeader currentStep={4} />
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="rounded-3xl border border-[#dbe4fa] bg-white p-6 sm:p-8 text-center shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)]">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#ecfdf3] text-[#16a34a] flex items-center justify-center text-3xl">✓</div>
            <p className="mt-4 text-xs font-bold tracking-[0.12em] uppercase text-[#4f46e5]">Booking request sent</p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#111827]">Thank you. Your booking request is on its way.</h1>
            <p className="mt-3 text-sm text-[#5f6b7b]">
              The selected bodyshop will contact you by email or phone to confirm the day and time.
            </p>
            {previewMode ? (
              <p className="mt-3 text-xs font-semibold text-[#b45309]">
                Preview mode: backend booking is not configured yet, so this request was not sent to the owner panel.
              </p>
            ) : null}
            <p className="mt-6 text-sm text-[#475569]">Returning to the homepage in <span className="font-bold text-[#111827]">{secondsToHome}s</span>...</p>
            <button
              type="button"
              onClick={() => (window.location.hash = '#/')}
              className="mt-4 inline-flex items-center justify-center px-5 py-2.5 rounded-full font-semibold text-sm text-white"
              style={{ background: 'linear-gradient(90deg, #5b5dfd 0%, #b667d4 48%, #f19a48 100%)' }}
            >
              Return now
            </button>
          </div>
        </main>
        <DarkFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef2f8] overflow-x-hidden">
      <EstimateHeader currentStep={4} />

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">Almost there! Confirm your booking</h1>
            <p className="mt-1 text-sm text-[#5f6b7b]">Review the selected bodyshop and complete your details to submit your request.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#bdeccc] bg-[#ecfdf3] px-3 py-1.5 text-xs font-semibold text-[#15803d]">
            <span>✓</span>
            <span>Your quote is held for 24 hours</span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <aside className="rounded-3xl border border-[#dbe4fa] bg-white p-5 sm:p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)] h-fit">
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-[#4f46e5]">Selected bodyshop</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl border border-[#dbe4fa] bg-[#4f46e5] text-white text-xl font-extrabold flex items-center justify-center">
                  {shopInitials}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[#111827]">{targetShop?.name || 'Best Match Bodyshop'} ✓</h2>
                  <p className="text-sm text-[#64748b]">⭐ 4.9 (328) · 0.4 mi away</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#dce4ff] bg-[#f6f8ff] px-4 py-3 min-w-[170px]">
                <p className="text-xs font-semibold text-[#64748b]">Your quote</p>
                <p className="mt-1 text-3xl font-extrabold text-[#4f46e5]">${targetShop?.price || estimate?.estimateMin || 0}</p>
                <p className="text-xs text-[#6b7280]">AI range: {estimateLabel}</p>
              </div>
            </div>

            <div className="mt-5 border-t border-[#e8eefc] pt-4">
              <p className="text-sm font-bold text-[#111827]">Damage summary</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#dbe4fa] bg-[#f8faff]">
                <div className="aspect-[16/9] w-full bg-[#e9eefb]">
                  {photoUrls[0] ? (
                    <img src={photoUrls[0]} alt="Vehicle damage" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm font-semibold text-[#64748b]">Photo preview not available</div>
                  )}
                </div>
                {photoUrls.length > 1 ? (
                  <div className="grid grid-cols-4 gap-2 p-2">
                    {photoUrls.slice(0, 4).map((photo, idx) => (
                      <div key={photo} className="aspect-video overflow-hidden rounded-lg border border-[#d7e0f7] bg-white">
                        <img src={photo} alt={`Damage angle ${idx + 1}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-xl border border-[#e5eaf8] bg-[#f8faff] px-3 py-2"><p className="text-[#64748b] text-xs">Damage type</p><p className="font-semibold text-[#111827]">{estimate?.damageCategory || 'Minor Dent'}</p></div>
                <div className="rounded-xl border border-[#e5eaf8] bg-[#f8faff] px-3 py-2"><p className="text-[#64748b] text-xs">Panel location</p><p className="font-semibold text-[#111827]">{estimate?.location || 'Door panel'}</p></div>
                <div className="rounded-xl border border-[#e5eaf8] bg-[#f8faff] px-3 py-2"><p className="text-[#64748b] text-xs">Estimated dents</p><p className="font-semibold text-[#111827]">{estimate?.dents || 1}</p></div>
                <div className="rounded-xl border border-[#e5eaf8] bg-[#f8faff] px-3 py-2"><p className="text-[#64748b] text-xs">Estimated value</p><p className="font-semibold text-[#111827]">{estimateLabel}</p></div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-xl border border-[#dbe4fa] bg-[#f7f9ff] px-3 py-2.5 text-xs text-[#475569]">All bodyshops on Dent Vision AI are pre-screened for PDR quality and service standards.</div>
              <div className="rounded-xl border border-[#dbe4fa] bg-[#f7f9ff] px-3 py-2.5 text-xs text-[#475569]">The bodyshop will contact you to confirm a suitable appointment window.</div>
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-[#dbe4fa] bg-white p-5 sm:p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)]">
            <h2 className="text-[25px] leading-tight font-extrabold text-[#111827]">Complete your booking</h2>

            <p className="mt-5 text-xs font-bold tracking-[0.12em] uppercase text-[#4f46e5]">Your details</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-[#475569]">Full name</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  type="text"
                  className="mt-1.5 w-full rounded-xl border border-[#d6deef] px-3 py-2.5 text-sm outline-none focus:border-[#5b5dfd]"
                  placeholder="e.g. James Carter"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#475569]">Email</span>
                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  type="email"
                  className="mt-1.5 w-full rounded-xl border border-[#d6deef] px-3 py-2.5 text-sm outline-none focus:border-[#5b5dfd]"
                  placeholder="e.g. james@email.com"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#475569]">Phone</span>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  type="tel"
                  className="mt-1.5 w-full rounded-xl border border-[#d6deef] px-3 py-2.5 text-sm outline-none focus:border-[#5b5dfd]"
                  placeholder="e.g. 0412 345 678"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#475569]">REGO</span>
                <input
                  value={rego}
                  onChange={(e) => setRego(e.target.value.toUpperCase())}
                  type="text"
                  className="mt-1.5 w-full rounded-xl border border-[#d6deef] px-3 py-2.5 text-sm outline-none focus:border-[#5b5dfd]"
                  placeholder="e.g. 123ABC"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#475569]">Postal Code</span>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  type="text"
                  className="mt-1.5 w-full rounded-xl border border-[#d6deef] px-3 py-2.5 text-sm outline-none focus:border-[#5b5dfd]"
                  placeholder="e.g. 4000"
                />
              </label>
            </div>

            <p className="mt-5 text-xs font-bold tracking-[0.12em] uppercase text-[#4f46e5]">Booking preference</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-[#475569]">Preferred date</span>
                <input
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  type="date"
                  className="mt-1.5 w-full rounded-xl border border-[#d6deef] px-3 py-2.5 text-sm outline-none focus:border-[#5b5dfd]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#475569]">Preferred period</span>
                <select
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#d6deef] px-3 py-2.5 text-sm outline-none focus:border-[#5b5dfd]"
                >
                  <option>Morning (08:00-12:00)</option>
                  <option>Afternoon (12:00-17:00)</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-[#475569]">Additional message (optional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="mt-1.5 w-full rounded-xl border border-[#d6deef] px-3 py-2.5 text-sm outline-none resize-none focus:border-[#5b5dfd]"
                  placeholder="e.g. I can only attend after 3pm, please call before arrival."
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-[#fde68a] bg-[#fff7d6] px-4 py-3 text-[12px] sm:text-[13px] leading-relaxed text-[#713f12]">
              Once submitted, the bodyshop will receive your request and contact you to confirm timing and final details.
            </div>

            <div className="mt-4 rounded-2xl border border-[#fcd9d9] bg-[#fff5f5] px-4 py-3">
              <p className="text-[12px] sm:text-[13px] leading-relaxed text-[#7f1d1d]">
                Dent Vision AI is a connection platform only and is not responsible for final pricing, workmanship, scheduling, or any negotiation terms.
                All agreements and negotiation are directly between you and the selected bodyshop.
              </p>
            </div>

            <label className="mt-4 flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={agreeLiability}
                onChange={(e) => setAgreeLiability(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] text-[#4f46e5]"
              />
              <span className="text-xs sm:text-sm text-[#334155]">
                I understand and agree that Dent Vision AI is not responsible, and the booking negotiation will be directly between me and the bodyshop.
              </span>
            </label>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="mt-5 w-full rounded-full py-3 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(90deg, #5b5dfd 0%, #b667d4 48%, #f19a48 100%)' }}
            >
              {submitting ? 'Submitting booking...' : 'Submit booking request'}
            </button>

            <p className="mt-3 text-center text-[11px] text-[#9ca3af]">Your details are secured and shared only with the selected bodyshop.</p>
          </form>
        </div>
      </main>

      <DarkFooter />
    </div>
  );
};

export default BookingForm;

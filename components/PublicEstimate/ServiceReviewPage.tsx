import React, { useEffect, useMemo, useState } from 'react';
import { getServiceReviewByToken, submitServiceReview } from '../../services/serviceReviewService';

const parseToken = () => {
  const hashQuery = window.location.hash.split('?')[1] || '';
  const params = new URLSearchParams(hashQuery);
  return params.get('token') || '';
};

const ServiceReviewPage: React.FC = () => {
  const [token] = useState(parseToken);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<Awaited<ReturnType<typeof getServiceReviewByToken>> | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getServiceReviewByToken(token);
      if (!active) return;
      setContext(result);
      if (result.rating) setRating(result.rating);
      if (result.reviewComment) setComment(result.reviewComment);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const greeting = useMemo(() => context?.customerFirstName || 'there', [context]);

  const handleSubmit = async () => {
    if (rating < 1) {
      setError('Please select a star rating.');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await submitServiceReview(token, rating, comment);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || 'Could not submit review.');
      return;
    }
    setDone(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f6fd] flex items-center justify-center p-6">
        <p className="text-sm text-[#64748b]">Loading review…</p>
      </div>
    );
  }

  if (!context?.valid) {
    return (
      <div className="min-h-screen bg-[#f3f6fd] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-[#e4e9f8] bg-white p-6 text-center shadow-lg">
          <h1 className="text-xl font-extrabold text-[#111827]">Invalid review link</h1>
          <p className="mt-2 text-sm text-[#64748b]">This link may be incorrect or no longer available.</p>
        </div>
      </div>
    );
  }

  if (context.expired) {
    return (
      <div className="min-h-screen bg-[#f3f6fd] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-6 text-center shadow-lg">
          <h1 className="text-xl font-extrabold text-[#92400e]">Link expired</h1>
          <p className="mt-2 text-sm text-[#92400e]">This review request is over 30 days old. Contact the bodyshop if you still need support.</p>
        </div>
      </div>
    );
  }

  if (done || context.alreadySubmitted) {
    return (
      <div className="min-h-screen bg-[#f3f6fd] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-[#bbf7d0] bg-[#ecfdf3] p-6 text-center shadow-lg">
          <h1 className="text-xl font-extrabold text-[#166534]">Thank you!</h1>
          <p className="mt-2 text-sm text-[#166534]">
            Your {context.rating || rating}-star review for <strong>{context.bodyshopName}</strong> has been recorded.
          </p>
          <p className="mt-3 text-xs text-[#64748b]">This confirms the repair was completed — Dent Vision uses this for partner quality control.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6fd] flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-[#e4e9f8] bg-white p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#4f46e5]">Dent Vision · Service review</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#111827]">Hi {greeting}, how was your repair?</h1>
        <p className="mt-2 text-sm text-[#64748b]">
          <strong>{context.bodyshopName}</strong> marked your PDR service as completed. Please confirm the job was done and rate your experience.
        </p>

        <div className="mt-6 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-3xl transition-transform hover:scale-110 ${star <= rating ? 'opacity-100' : 'opacity-30'}`}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>

        <label className="mt-6 block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Optional comment</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-xl border border-[#d7dff5] px-3 py-2 text-sm outline-none focus:border-[#4f46e5]"
            placeholder="Tell us about the quality, communication, or timing…"
          />
        </label>

        {error ? <p className="mt-3 text-sm font-semibold text-[#be123c]">{error}</p> : null}

        <button
          type="button"
          disabled={submitting || rating < 1}
          onClick={handleSubmit}
          className="mt-5 w-full rounded-xl bg-[#4f46e5] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
      </div>
    </div>
  );
};

export default ServiceReviewPage;

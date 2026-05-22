import React, { useEffect, useState } from 'react';
import EstimateHeader from './EstimateHeader';
import FlowLegalFooter from './FlowLegalFooter';
import EstimateConsentModal from './EstimateConsentModal';
import DarkFooter from '../DarkFooter';

interface EstimateData {
  damageType: string;
  estimateMin: number;
  estimateMax: number;
  confidence: number;
  dents: number;
  scratches: number;
  damageCategory: string;
  location: string;
  repairTime: string;
  zip: string;
  hasPaintDamage?: boolean;
  isDemo?: boolean;
  fallbackScenario?: FallbackScenario;
  responsesCount?: number;
  shopsNotified?: number;
  shopsViewed?: number;
  shopsReviewing?: number;
  pdrSuitable?: boolean;
  inspectionRequired?: boolean;
  panelBreakdownData?: Array<{
    panelLabel: string;
    dentCount: number;
    damageType: string;
    sizePretty: string;
    depth: string;
    severity: string;
    repairTime: string;
    minCost: number;
    maxCost: number;
  }>;
  analysis?: {
    panels?: Array<{
      panel_name?: string;
      dent_count?: number;
      estimated_panel_cost_AUD?: {
        min?: number;
        max?: number;
      };
    }>;
  };
}

type FallbackScenario = 'no-responses' | 'not-suitable-pdr' | 'inspection-required';

interface ShopOffer {
  name: string;
  initials: string;
  rating: number;
  reviews: number;
  distance: string;
  price: number;
  priceRange: string;
  time: string;
  isBest?: boolean;
}

const buildShops = (min: number, max: number): ShopOffer[] => {
  const mid = Math.round((min + max) / 2) || 275;
  return [
    { name: 'PDR Pro Studio',       initials: 'PDR', rating: 4.9, reviews: 328, distance: '0.4 mi', price: mid,      priceRange: `$${mid - 25}–$${mid + 25}`,  time: '1–2 hours', isBest: true },
    { name: 'Dent Masters LA',      initials: 'DM',  rating: 4.8, reviews: 210, distance: '1.2 mi', price: mid + 20, priceRange: `$${mid - 5}–$${mid + 45}`,   time: '1–3 hours' },
    { name: 'Quick Dent Repair',    initials: 'QD',  rating: 4.6, reviews: 154, distance: '1.8 mi', price: mid + 35, priceRange: `$${mid + 10}–$${mid + 60}`,  time: '1–3 hours' },
    { name: 'Elite PDR',            initials: 'EP',  rating: 4.7, reviews: 98,  distance: '2.1 mi', price: mid + 45, priceRange: `$${mid + 20}–$${mid + 70}`,  time: '2–3 hours' },
    { name: 'Prime Dent Solutions', initials: 'PS',  rating: 4.7, reviews: 122, distance: '2.7 mi', price: mid + 50, priceRange: `$${mid + 25}–$${mid + 75}`,  time: '1–3 hours' },
  ];
};

const buildFallbackData = (): EstimateData => ({
  damageType: 'pdr',
  estimateMin: 250,
  estimateMax: 395,
  confidence: 88,
  dents: 1,
  scratches: 0,
  damageCategory: 'Minor Dent',
  location: 'Front Right Door',
  repairTime: '1–2 hours',
  zip: '',
});

const TOTAL_SHOPS = 24;
const RESPONDED = 5;

const prettyPanelName = (value?: string): string => {
  if (!value) return 'Panel';
  const key = value.toLowerCase();
  if (key === 'doors') return 'Doors (All)';
  if (key === 'guard') return 'Guard (Front/Rear)';
  if (key === 'boot') return 'Boot';
  if (key === 'bonnet') return 'Bonnet';
  if (key === 'roof') return 'Roof';
  if (key === 'bumper') return 'Bumper';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const isFallbackScenario = (value: string | null): value is FallbackScenario =>
  value === 'no-responses' || value === 'not-suitable-pdr' || value === 'inspection-required';

const readScenarioFromHash = (): FallbackScenario | null => {
  const hash = window.location.hash || '';
  const [, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);
  const candidate = params.get('fallback') ?? params.get('scenario');
  return isFallbackScenario(candidate) ? candidate : null;
};

const AnimatedCounter: React.FC<{ to: number; className?: string; duration?: number }> = ({
  to,
  className,
  duration = 1200,
}) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start: number | null = null;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min(1, (ts - start) / duration);
      setValue(Math.round(to * progress));
      if (progress < 1) raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [to, duration]);

  return <span className={className}>{value}</span>;
};

const EstimateResults: React.FC = () => {
  const [data, setData] = useState<EstimateData | null>(null);
  const [shops, setShops] = useState<ShopOffer[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [fallbackScenario, setFallbackScenario] = useState<FallbackScenario | null>(null);

  useEffect(() => {
    const forcedByHash = readScenarioFromHash();
    const forcedBySession = sessionStorage.getItem('estimateFallbackScenario');
    const forcedScenario = forcedByHash
      ? forcedByHash
      : isFallbackScenario(forcedBySession)
        ? forcedBySession
        : null;

    const raw = sessionStorage.getItem('estimateData');
    if (raw) {
      const parsed: EstimateData = JSON.parse(raw);
      setData(parsed);
      setShops(buildShops(parsed.estimateMin || 250, parsed.estimateMax || 395));
      const resolvedScenario: FallbackScenario | null = forcedByHash
        ? forcedByHash
        : isFallbackScenario(forcedBySession)
          ? forcedBySession
        : parsed.fallbackScenario
          ? parsed.fallbackScenario
          : parsed.responsesCount === 0
            ? 'no-responses'
            : parsed.pdrSuitable === false
              ? 'not-suitable-pdr'
              : parsed.inspectionRequired === true
                ? 'inspection-required'
                : null;

      setFallbackScenario(resolvedScenario);
      return;
    }

    if (forcedScenario) {
      const fallbackData = buildFallbackData();
      setData(fallbackData);
      setShops(buildShops(fallbackData.estimateMin, fallbackData.estimateMax));
      setFallbackScenario(forcedScenario);
    }
  }, []);

  useEffect(() => {
    const files = (window as any).__leadUploadFiles as File[] | undefined;
    if (files?.length) {
      const urls = files.slice(0, 4).map((f) => URL.createObjectURL(f));
      setPhotoUrls(urls);
      return () => {
        urls.forEach((u) => URL.revokeObjectURL(u));
      };
    }
  }, []);

  if (!data) return (
    <div className="min-h-screen" style={{ background: '#eef2f8' }}>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[#5f6b7b] mb-3">No estimate data found.</p>
          <a href="#/" className="text-[#4f46e5] font-semibold text-sm">← Start a new estimate</a>
        </div>
      </div>
      <DarkFooter />
    </div>
  );

  const best = shops[0];
  const lowestPrice  = shops[0]?.price ?? 0;
  const highestPrice = shops[shops.length - 1]?.price ?? 0;
  const aiMid = Math.round((data.estimateMin + data.estimateMax) / 2) || 275;

  // panelBreakdownData (saved from analysis step) is the authoritative source.
  // Fall back to analysis.panels if not present (single-panel flow).
  const panelPricing: { panelLabel: string; dents: number; min: number; max: number }[] =
    data.panelBreakdownData && data.panelBreakdownData.length > 0
      ? data.panelBreakdownData.map((p) => ({
          panelLabel: p.panelLabel,
          dents: p.dentCount,
          min: p.minCost,
          max: p.maxCost,
        }))
      : (data.analysis?.panels || [])
          .map((p) => {
            const min = p.estimated_panel_cost_AUD?.min ?? 0;
            const max = p.estimated_panel_cost_AUD?.max ?? 0;
            if (min <= 0 && max <= 0) return null;
            return { panelLabel: prettyPanelName(p.panel_name), dents: p.dent_count ?? 0, min, max };
          })
          .filter((p): p is { panelLabel: string; dents: number; min: number; max: number } => !!p);

  const breakdownMin = panelPricing.reduce((sum, p) => sum + p.min, 0);
  const breakdownMax = panelPricing.reduce((sum, p) => sum + p.max, 0);
  const hasPanelBreakdown = panelPricing.length > 0;
  const finalMin = hasPanelBreakdown ? breakdownMin : data.estimateMin;
  const finalMax = hasPanelBreakdown ? breakdownMax : data.estimateMax;
  const finalMid = Math.round((finalMin + finalMax) / 2);
  const barPct = highestPrice > lowestPrice
    ? ((aiMid - lowestPrice) / (highestPrice - lowestPrice)) * 100
    : 50;

  const handleBookNow = () => {
    setShowConsentModal(true);
  };

  const handleAcceptConsent = () => {
    sessionStorage.setItem('estimateConsentAccepted', 'true');
    sessionStorage.setItem(
      'bookingTargetShop',
      JSON.stringify({
        name: best?.name || 'Best Match Bodyshop',
        price: best?.price || aiMid,
      })
    );
    setShowConsentModal(false);
    window.location.hash = '#/booking-form';
  };

  const handleCloseConsent = () => {
    setShowConsentModal(false);
  };

  const handleFallbackAction = (intent: string) => {
    sessionStorage.setItem('estimateFallbackIntent', intent);
    window.location.hash = '#/lead-flow';
  };

  const fallbackAnimationCss = `
    .dv-fade-in {
      animation: dvFadeIn .5s ease-out both;
    }
    @keyframes dvFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .dv-icon-glow {
      box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.28);
      animation: dvGlow 2s ease-in-out infinite;
    }
    @keyframes dvGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.18); }
      50% { box-shadow: 0 0 0 12px rgba(79, 70, 229, 0.02); }
    }
    .dv-soft-pulse {
      animation: dvPulse 1.8s ease-in-out infinite;
    }
    @keyframes dvPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.04); opacity: .9; }
    }
  `;

  if (fallbackScenario) {
    const shopsNotified = data.shopsNotified ?? 18;
    const shopsViewed = data.shopsViewed ?? 6;
    const shopsReviewing = data.shopsReviewing ?? Math.max(0, shopsNotified - shopsViewed);

    return (
      <div className="min-h-screen pb-10" style={{ background: '#eef2f8' }}>
        <EstimateHeader currentStep={4} />

        <div className="max-w-4xl mx-auto px-4 py-8">
          {fallbackScenario === 'no-responses' && (
            <div className="bg-white rounded-3xl border border-[#e5e7eb] p-5 md:p-6 shadow-sm dv-fade-in">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-14 h-14 rounded-full bg-[#fff7ed] border border-[#fed7aa] mx-auto flex items-center justify-center mb-3 dv-icon-glow">
                  <svg className="w-7 h-7 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z" />
                  </svg>
                </div>

                <p className="text-[11px] font-bold tracking-[0.12em] text-[#f59e0b] uppercase mb-1">Still searching</p>
                <h1 className="text-3xl font-extrabold text-[#111827] leading-tight">We’re still searching for the best repair specialist for you</h1>
                <p className="text-sm text-[#6b7280] mt-2">
                  Some bodyshops may take longer to review complex damage requests. We’ve saved your request and will continue notifying nearby repair shops.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2.5 bg-[#f8faff] border border-[#e5eaf6] rounded-2xl p-3">
                <div className="text-center">
                  <p className="text-[11px] text-[#7c87a0]">Shops Notified</p>
                  <AnimatedCounter to={shopsNotified} className="text-3xl font-extrabold text-[#4f46e5]" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-[#7c87a0]">Viewed Your Request</p>
                  <AnimatedCounter to={shopsViewed} className="text-3xl font-extrabold text-[#4f46e5]" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-[#7c87a0]">Still Reviewing</p>
                  <AnimatedCounter to={shopsReviewing} className="text-3xl font-extrabold text-[#4f46e5]" />
                </div>
              </div>

              <div className="mt-4 bg-[#f8f9ff] border border-[#d7dcff] rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#111827]">Notify Me When a Shop Responds</p>
                  <p className="text-xs text-[#6b7280] mt-0.5">We’ll send you an SMS or email as soon as we receive new quotes.</p>
                </div>
                <button
                  onClick={() => handleFallbackAction('notify-when-shop-responds')}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-[#4f46e5] hover:brightness-110 transition-all dv-soft-pulse"
                >
                  Notify Me
                </button>
              </div>

              <div className="my-4 flex items-center gap-2 text-[#9ca3af]">
                <div className="flex-1 h-px bg-[#e5e7eb]" />
                <span className="text-[10px] font-bold">OR</span>
                <div className="flex-1 h-px bg-[#e5e7eb]" />
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#111827]">Request Assistance</p>
                  <p className="text-xs text-[#6b7280] mt-0.5">Our team can personally reach out to repair shops in your area for you.</p>
                </div>
                <button
                  onClick={() => handleFallbackAction('request-assistance')}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-[#111827] bg-[#f3f4f6] border border-[#e5e7eb] hover:bg-[#eef2ff] transition-colors"
                >
                  Request Assistance
                </button>
              </div>

              <div className="mt-4 bg-[#f0fdf4] border border-[#d1fae5] rounded-xl py-2.5 px-3 text-center text-[12px] text-[#166534] font-medium">
                Your request is saved and secure. We’ll keep working for you.
              </div>
            </div>
          )}

          {fallbackScenario === 'not-suitable-pdr' && (
            <div className="bg-white rounded-3xl border border-[#e5e7eb] p-5 md:p-6 shadow-sm dv-fade-in">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-14 h-14 rounded-full bg-[#fff1f2] border border-[#fecdd3] mx-auto flex items-center justify-center mb-3 dv-icon-glow">
                  <svg className="w-7 h-7 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-[11px] font-bold tracking-[0.12em] text-[#ef4444] uppercase mb-1">PDR not recommended</p>
                <h1 className="text-3xl font-extrabold text-[#111827] leading-tight">Your damage may require bodywork or paint repair</h1>
                <p className="text-sm text-[#6b7280] mt-2">
                  Our AI detected signs that this repair may require traditional bodyshop repair instead of Paintless Dent Repair (PDR).
                </p>
              </div>

              <div className="mt-5 bg-[#f8faff] border border-[#e5eaf6] rounded-2xl p-3.5 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3.5">
                <div className="rounded-xl overflow-hidden border border-[#e5e7eb] bg-[#f3f4f6]" style={{ aspectRatio: '16/10' }}>
                  {photoUrls[0] ? (
                    <img src={photoUrls[0]} alt="Damage" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[#9ca3af]">Uploaded damage photo</div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#111827] mb-2">AI Analysis</p>
                  {[
                    'Paint damage detected',
                    'Deep crease identified',
                    'Panel tension may be high',
                    'PDR may not be effective',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                      <span className="text-xs text-[#374151]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl p-4">
                <p className="text-sm font-bold text-[#111827]">Why PDR may not be the best option</p>
                <p className="text-xs text-[#6b7280] mt-1">
                  PDR works best on minor dents where the paint is not damaged. This damage appears to require repainting and traditional repair.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4">
                  <p className="text-sm font-bold text-[#111827]">Find Body Repair Specialists</p>
                  <p className="text-xs text-[#6b7280] mt-1">We’ll connect you with trusted bodyshops that handle paint and panel repair.</p>
                  <button
                    onClick={() => handleFallbackAction('find-body-repair-specialists')}
                    className="w-full mt-3 py-2.5 rounded-lg text-xs font-bold text-white bg-[#4f46e5] hover:brightness-110 transition-all"
                  >
                    Find Bodyshops
                  </button>
                </div>
                <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4">
                  <p className="text-sm font-bold text-[#111827]">Request Manual Review</p>
                  <p className="text-xs text-[#6b7280] mt-1">Our experts will review your photos and recommend the best solution.</p>
                  <button
                    onClick={() => handleFallbackAction('request-manual-review')}
                    className="w-full mt-3 py-2.5 rounded-lg text-xs font-bold text-[#111827] bg-[#f3f4f6] border border-[#e5e7eb] hover:bg-[#eef2ff] transition-colors"
                  >
                    Request Review
                  </button>
                </div>
              </div>

              <div className="mt-4 bg-[#f0fdf4] border border-[#d1fae5] rounded-xl py-2.5 px-3 text-center text-[12px] text-[#166534] font-medium">
                Your request is saved and we’ll continue helping you find the best solution.
              </div>
            </div>
          )}

          {fallbackScenario === 'inspection-required' && (
            <div className="bg-white rounded-3xl border border-[#e5e7eb] p-5 md:p-6 shadow-sm dv-fade-in">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-14 h-14 rounded-full bg-[#fff7ed] border border-[#fed7aa] mx-auto flex items-center justify-center mb-3 dv-icon-glow">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-7 h-7 text-[#f59e0b]"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 20l-4.2-4.2" />
                  </svg>
                </div>
                <p className="text-[11px] font-bold tracking-[0.12em] text-[#f59e0b] uppercase mb-1">Inspection recommended</p>
                <h1 className="text-3xl font-extrabold text-[#111827] leading-tight">A physical inspection may be required</h1>
                <p className="text-sm text-[#6b7280] mt-2">
                  Some damage types cannot be fully estimated from photos alone. A repair specialist may need to inspect the vehicle in person for accurate pricing.
                </p>
              </div>

              <div className="mt-5 bg-[#fffaf0] border border-[#fde7c2] rounded-2xl p-4">
                <p className="text-sm font-bold text-[#111827] mb-2">Why we need an inspection</p>
                {[
                  'Damage depth needs assessment',
                  'Hidden damage may exist',
                  'Metal tension needs inspection',
                  'Accurate pricing requires in-person review',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                    <span className="text-xs text-[#374151]">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4">
                  <p className="text-sm font-bold text-[#111827]">Book Inspection</p>
                  <p className="text-xs text-[#6b7280] mt-1">Schedule an inspection with nearby repair specialists.</p>
                  <button
                    onClick={() => handleFallbackAction('book-inspection')}
                    className="w-full mt-3 py-2.5 rounded-lg text-xs font-bold text-white bg-[#4f46e5] hover:brightness-110 transition-all"
                  >
                    Book Now
                  </button>
                </div>
                <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4">
                  <p className="text-sm font-bold text-[#111827]">Speak With an Expert</p>
                  <p className="text-xs text-[#6b7280] mt-1">Our team can help you understand the next best steps.</p>
                  <button
                    onClick={() => handleFallbackAction('speak-with-expert')}
                    className="w-full mt-3 py-2.5 rounded-lg text-xs font-bold text-[#111827] bg-[#f3f4f6] border border-[#e5e7eb] hover:bg-[#eef2ff] transition-colors"
                  >
                    Talk to Expert
                  </button>
                </div>
              </div>

              <div className="mt-4 bg-[#f0fdf4] border border-[#d1fae5] rounded-xl py-2.5 px-3 text-center text-[12px] text-[#166534] font-medium">
                Your request is saved and we’ll continue looking for the best solution.
              </div>
            </div>
          )}
        </div>

        <FlowLegalFooter className="pb-8" />
        <DarkFooter />

        <style>{fallbackAnimationCss}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: '#eef2f8' }}>
      <EstimateHeader currentStep={4} />

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-[#111827]">Your Best Estimate is Ready! 🎉</h1>
          <p className="text-[#5f6b7b] mt-1 text-sm">
            We analyzed <strong className="text-[#111827]">{TOTAL_SHOPS}</strong> quotes and found you the best value.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          {/* ──── LEFT ──── */}
          <div className="space-y-5">

            {/* AI Estimate card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <p className="text-sm font-bold text-[#111827] mb-5 flex items-center gap-1.5">
                <span className="text-[#4f46e5]">✦</span> AI Best Estimate <span className="text-[#4f46e5]">✦</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-[auto_280px_1fr] gap-4 items-start">
                <div>
                  <p className="text-5xl font-extrabold text-[#111827] leading-none">${finalMid}</p>
                  <p className="text-xs text-[#9ca3af] mt-1">
                    {hasPanelBreakdown ? `${panelPricing.length} panel${panelPricing.length !== 1 ? 's' : ''} · $${finalMin}–$${finalMax}` : `Range $${data.estimateMin}–$${data.estimateMax}`}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] bg-[#f0fdf4] text-green-700 font-semibold px-2 py-1 rounded-full">
                    You save up to ${highestPrice - lowestPrice}
                  </div>
                </div>
                <div>
                  {photoUrls.length > 0 ? (
                    <>
                      <div className="rounded-lg overflow-hidden bg-[#f3f4f6] border border-[#e5e7eb]" style={{ aspectRatio: '16/9' }}>
                        <img src={photoUrls[0]} alt="Analyzed main" className="w-full h-full object-cover" />
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {photoUrls.map((url, i) => (
                          <div key={i} className="rounded-md overflow-hidden border border-[#e5e7eb] bg-[#f3f4f6]" style={{ aspectRatio: '16/10' }}>
                            <img src={url} alt={`Analyzed ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-full min-h-[120px] rounded-lg border border-dashed border-[#d1d5db] bg-[#f9fafb] flex items-center justify-center text-[11px] text-[#9ca3af]">
                      Analyzed photos unavailable
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 items-start">
                  <div className="text-center">
                    <svg className="w-5 h-5 text-[#9ca3af] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9h18"/>
                    </svg>
                    <p className="text-[11px] text-[#9ca3af]">Damage Type</p>
                    <p className="text-sm font-bold text-[#111827]">{data.damageCategory}</p>
                    <p className="text-[11px] text-[#9ca3af]">{data.hasPaintDamage ? 'Paint repair likely required' : 'No paint required'}</p>
                  </div>
                  <div className="text-center">
                    <svg className="w-5 h-5 text-[#9ca3af] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <p className="text-[11px] text-[#9ca3af]">Damage Location</p>
                    <p className="text-sm font-bold text-[#111827]">{data.location}</p>
                    <p className="text-[11px] text-[#9ca3af]">Exterior Panel</p>
                  </div>
                  <div className="text-center">
                    <svg className="w-5 h-5 text-[#9ca3af] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3"/>
                      <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    </svg>
                    <p className="text-[11px] text-[#9ca3af]">Est. Repair Time</p>
                    <p className="text-sm font-bold text-[#111827]">{data.repairTime}</p>
                    <p className="text-[11px] text-[#9ca3af]">AI-based timing</p>
                  </div>
                  <div className="text-center">
                    <svg className="w-5 h-5 text-[#9ca3af] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M9 12h6M9 17h6"/>
                      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} />
                    </svg>
                    <p className="text-[11px] text-[#9ca3af]">Dent Count</p>
                    <p className="text-sm font-bold text-[#111827]">{data.dents}</p>
                    <p className="text-[11px] text-[#9ca3af]">Detected by AI</p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                All shops are pre-screened and PDR certified.
              </p>
            </div>

            {/* Quote comparison bar */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-[#111827] text-sm">Quote Comparison ({TOTAL_SHOPS} Shops)</p>
                <button className="text-xs text-[#4f46e5] font-semibold">View full list</button>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <div><p className="text-[11px] text-[#9ca3af]">Lowest Price</p><p className="font-bold text-[#111827]">${lowestPrice}</p></div>
                <div className="text-center"><p className="text-[11px] text-[#4f46e5] font-semibold">AI Recommended</p><p className="font-bold text-[#4f46e5]">${aiMid}</p></div>
                <div className="text-right"><p className="text-[11px] text-[#9ca3af]">Highest Price</p><p className="font-bold text-red-500">${highestPrice}</p></div>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden bg-[#f3f4f6]">
                <div className="absolute inset-0 flex gap-px">
                  {Array.from({ length: 48 }).map((_, i) => {
                    const pct = i / 47;
                    const color = pct < 0.28 ? '#22c55e' : pct < 0.62 ? '#4f46e5' : '#ef4444';
                    return <div key={i} className="flex-1 rounded-sm" style={{ background: color, opacity: 0.25 + pct * 0.75 }} />;
                  })}
                </div>
                <div className="absolute top-0 bottom-0 w-0.5 bg-[#4f46e5]" style={{ left: `${barPct}%` }}>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#4f46e5] border-2 border-white" />
                </div>
              </div>
              <p className="text-center text-[11px] text-[#5f6b7b] mt-2">
                Most quotes clustered between{' '}
                <span className="font-semibold text-[#4f46e5]">${lowestPrice} – ${lowestPrice + 75}</span>
              </p>
            </div>

            {/* Final calculated pricing */}
            {(hasPanelBreakdown || data.estimateMin > 0) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e5e7eb]">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-[#111827] text-sm">Final Price Calculation</p>
                  <span className="text-xs text-[#6b7280]">Based on AI panel analysis</span>
                </div>

                {hasPanelBreakdown && (
                  <div className="space-y-2.5 mb-4">
                    {panelPricing.map((row, idx) => (
                      <div key={`${row.panelLabel}-${idx}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#eef1f6] bg-[#f8faff] px-3 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{row.panelLabel}</p>
                          <p className="text-[11px] text-[#9ca3af]">{row.dents} dent{row.dents !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-sm font-bold text-[#111827]">${row.min} – ${row.max}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-[#e5e7eb] pt-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide">Final Price</p>
                      <p className="text-3xl font-extrabold text-[#111827]">${finalMid}</p>
                      <p className="text-[11px] text-[#9ca3af]">Range: ${finalMin} – ${finalMax}</p>
                    </div>
                    <p className="text-[11px] text-[#6b7280] text-right max-w-[220px]">
                      Final quote remains subject to bodyshop review and on-site inspection.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Paint damage notice */}
            {data.hasPaintDamage && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🎨</span>
                <div>
                  <p className="text-sm font-bold text-orange-800">Paint Repair May Be Required</p>
                  <p className="text-xs text-orange-700 mt-1">
                    The estimate above (<strong>${aiMid}</strong>) covers the <strong>dent repair (PDR) only.</strong>{' '}
                    Paint damage was detected — your bodyshop will assess on-site and provide a <strong>separate paint quote</strong> after physical inspection.
                    Final total will be higher.
                  </p>
                </div>
              </div>
            )}

            {/* Demo notice */}
            {data.isDemo && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-2">
                <span className="text-lg">🔧</span>
                <p className="text-xs text-blue-800">
                  <strong>Demo Mode:</strong> AI analysis is running in demo mode because the Supabase API key is not yet configured.
                  Add your real <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to <code className="bg-blue-100 px-1 rounded">.env.local</code> to enable live AI analysis.
                </p>
              </div>
            )}

        {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-800">
                <strong>AI-Generated Estimate:</strong> This is an AI estimate based on your submitted photo and regional pricing rules.
                Final repair cost may change after bodyshop review and physical inspection. No obligation estimate.
              </p>
            </div>

            {/* Bottom feature strip */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🔒', title: 'Secure & Private',        desc: 'Your data is encrypted and never shared.' },
                { icon: '⚡', title: 'Real-Time Quotes',        desc: 'Live quotes from verified PDR shops near you.' },
                { icon: '🎯', title: 'Best Price Guarantee',    desc: 'We find you the best value, not just any price.' },
              ].map((b) => (
                <div key={b.title} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-xl mb-1">{b.icon}</div>
                  <p className="text-xs font-semibold text-[#111827]">{b.title}</p>
                  <p className="text-[11px] text-[#9ca3af] mt-0.5">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ──── RIGHT ──── */}
          <div className="space-y-4">

            {/* Top pick */}
            {best && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-[#111827] text-sm">Top Pick for You</p>
                  <span className="text-xs font-bold text-[#4f46e5]">Best Value</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#4f46e5] flex items-center justify-center text-white text-xs font-bold">
                      {best.initials}
                    </div>
                    <div>
                      <p className="font-bold text-[#111827] text-sm">{best.name} ✓</p>
                      <p className="text-[11px] text-[#9ca3af]">⭐ {best.rating} ({best.reviews}) · {best.distance} away</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-[#111827]">${best.price}</p>
                    <p className="text-[11px] text-[#9ca3af]">{best.priceRange}</p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-[#111827] mb-2">Why this is your best pick</p>
                {[
                  'Best price for the work needed',
                  'Highest customer rating',
                  'Fastest estimated repair time',
                  'PDR certified & verified',
                ].map((r) => (
                  <div key={r} className="flex items-center gap-2 mb-1.5">
                    <svg className="w-3.5 h-3.5 text-[#4f46e5] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    <span className="text-xs text-[#374151]">{r}</span>
                  </div>
                ))}
                <button
                  onClick={handleBookNow}
                  className="w-full mt-4 py-3 rounded-full font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(90deg, #5b5dfd 0%, #f19a48 100%)' }}
                >
                  📅 Book This Shop
                </button>
                <button className="w-full mt-2 py-2.5 rounded-full font-semibold text-[#111827] text-sm border-2 border-gray-200 hover:border-[#4f46e5] transition-colors">
                  📋 View All {TOTAL_SHOPS} Quotes
                </button>
                <p className="text-center text-[10px] text-[#9ca3af] mt-2">🔒 Secure booking. No payment required now.</p>
              </div>
            )}

            {/* Shop list */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-[#111827] text-sm">Best Offers for You</p>
                <select className="text-xs text-[#4f46e5] border-none bg-transparent font-semibold cursor-pointer">
                  <option>Best Value</option>
                  <option>Lowest Price</option>
                  <option>Distance</option>
                </select>
              </div>
              <p className="text-[11px] text-[#9ca3af] mb-3">
                {RESPONDED} of {TOTAL_SHOPS} bodyshops responded to your request
              </p>
              <div className="space-y-2">
                {shops.map((shop, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer hover:border-[#4f46e5]/30 ${
                      i === 0 ? 'border-[#4f46e5]/30 bg-[#f8f9ff]' : 'border-[#f3f4f6]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] text-[10px] font-bold flex-shrink-0">
                        {shop.initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-[#111827]">{shop.name}</p>
                          {i === 0 && <span className="text-[9px] bg-[#4f46e5] text-white rounded-full px-1.5 py-0.5 font-bold">Best Value</span>}
                        </div>
                        <p className="text-[10px] text-[#9ca3af]">⭐ {shop.rating} ({shop.reviews}) · {shop.distance}</p>
                        <p className="text-[10px] text-[#9ca3af]">{shop.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-[#111827]">${shop.price}</p>
                      <p className="text-[10px] text-[#9ca3af]">{shop.priceRange}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-3 text-xs text-[#4f46e5] font-semibold py-2 flex items-center justify-center gap-1">
                {TOTAL_SHOPS - RESPONDED} more offers available ▾
              </button>
            </div>

            {/* What happens next */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="font-bold text-[#111827] text-sm mb-3">What happens next?</p>
              {[
                { n: 1, title: 'You choose a shop',      desc: 'Select the best offer and book online.' },
                { n: 2, title: 'Shop confirms',          desc: 'The shop will confirm your appointment.' },
                { n: 3, title: 'Get your dent fixed',    desc: 'Fast, professional, and hassle-free.' },
                { n: 4, title: 'Book now to secure spot', desc: 'Complete booking now to lock your preferred time.' },
              ].map((step) => (
                <div key={step.n} className="flex gap-3 mb-3 last:mb-0">
                  <div className="w-6 h-6 rounded-full bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] text-xs font-bold flex-shrink-0">
                    {step.n}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">{step.title}</p>
                    <p className="text-[11px] text-[#9ca3af]">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Need help */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#111827] text-sm">Need help?</p>
                <p className="text-[11px] text-[#9ca3af]">Chat with our support team</p>
              </div>
              <button className="w-10 h-10 rounded-full bg-[#4f46e5] flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <FlowLegalFooter className="pb-8" />

      <EstimateConsentModal
        open={showConsentModal}
        onAccept={handleAcceptConsent}
        onClose={handleCloseConsent}
      />

      <DarkFooter />
    </div>
  );
};

export default EstimateResults;

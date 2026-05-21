import React, { useEffect, useRef, useState } from 'react';
import EstimateHeader from './EstimateHeader';
import DarkFooter from '../DarkFooter';
import { analyzeDents, verifyIsCarImage, identifyPanelsFromImages } from '../../services/geminiServiceAdapter';
import { VehicleType, MaterialType, LightingType, PanelType } from '../../types';
import { detectHailDamage } from '../../services/hailAnalysisService';

type Stage = 1 | 2 | 3 | 4;

interface ShopRow {
  name: string;
  initials: string;
  distance: string;
  status: 'reviewing' | 'analyzing' | 'responded' | 'waiting';
  price?: string;
  ago: string;
}

const BASE_SHOPS: ShopRow[] = [
  { name: 'PDR Pro Studio',       initials: 'PDR', distance: '0.4 mi', status: 'reviewing', ago: '1 min ago' },
  { name: 'Dent Masters LA',      initials: 'DM',  distance: '1.2 mi', status: 'reviewing', ago: '2 min ago' },
  { name: 'Quick Dent Repair',    initials: 'QD',  distance: '1.8 mi', status: 'analyzing', ago: '2 min ago' },
  { name: 'Elite PDR',            initials: 'EP',  distance: '2.1 mi', status: 'waiting',   ago: '3 min ago' },
  { name: 'Prime Dent Solutions', initials: 'PS',  distance: '2.7 mi', status: 'waiting',   ago: '3 min ago' },
];

const DOT_POSITIONS = [
  { top: '8%',  left: '12%' }, { top: '8%',  right: '12%' },
  { top: '42%', left: '3%'  }, { top: '42%', right: '3%'  },
  { bottom: '10%', left: '18%' }, { bottom: '10%', right: '18%' },
];

const statusDot = (s: ShopRow['status']) =>
  s === 'responded' ? 'bg-green-400' : s === 'analyzing' ? 'bg-[#4f46e5] animate-pulse' : s === 'reviewing' ? 'bg-blue-400' : 'bg-amber-400';

const statusLabel = (s: ShopRow['status'], _price?: string, pulse = 0) => {
  if (s === 'responded' || s === 'analyzing') return `Preparing quote${'.'.repeat((pulse % 3) + 1)}`;
  if (s === 'reviewing') return 'Preparing quote...';
  return 'Preparing quote...';
};

interface AnalysisInfo {
  panelName: string;
  damageType: string;
  dentCount: number;
  level: 'Shallow' | 'Medium' | 'Deep';
}

interface LiveScanDispatchMode {
  panelName?: string;
  damageType?: string;
  dentCount?: number;
  level?: AnalysisInfo['level'];
  zip?: string;
}

interface InvalidImageFallbackState {
  source: 'upload' | 'live-scan';
  reason?: string;
}

const LEVEL_META = {
  Shallow: { color: '#22c55e', desc: 'Light surface dent · PDR easy' },
  Medium:  { color: '#f59e0b', desc: 'Moderate depth · PDR possible' },
  Deep:    { color: '#ef4444', desc: 'Significant depth · May need filler' },
} as const;

const PANEL_OPTIONS = ['Bonnet', 'Guard (Front/Rear)', 'Door/s', 'Roof', 'Boot'] as const;
const TYPE_OPTIONS = ['PDR Dent', 'Hail Damage'] as const;
const DISPATCH_TOTAL_SECONDS = 180;
const INVALID_IMAGE_FALLBACK_KEY = 'invalidImageValidationFallback';
const normalizePanel = (value: string): string => {
  const lower = value.toLowerCase();
  if (lower.includes('bonnet') || lower.includes('hood')) return 'Bonnet';
  if (lower.includes('guard') || lower.includes('fender') || lower.includes('front') || lower.includes('rear')) return 'Guard (Front/Rear)';
  if (lower.includes('door')) return 'Door/s';
  if (lower.includes('roof')) return 'Roof';
  if (lower.includes('boot') || lower.includes('trunk')) return 'Boot';
  return 'Door/s';
};

const EstimateAnalysis: React.FC = () => {
  const [stage, setStage] = useState<Stage>(1);
  const [shops, setShops] = useState<ShopRow[]>(BASE_SHOPS);
  const [error, setError] = useState<string | null>(null);
  const [bottomData, setBottomData] = useState<{ damageCategory: string; location: string; repairTime: string } | null>(null);
  const [zip, setZip] = useState('');
  const [statusPulse, setStatusPulse] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [analysisInfo, setAnalysisInfo] = useState<AnalysisInfo | null>(null);
  const [markers, setMarkers] = useState<{ id: number; top: number; left: number }[][]>([]);
  const [dragging, setDragging] = useState<{ photoIdx: number; markerIdx: number } | null>(null);
  const [dispatchSecondsLeft, setDispatchSecondsLeft] = useState(DISPATCH_TOTAL_SECONDS);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [invalidImageFallback, setInvalidImageFallback] = useState<InvalidImageFallbackState | null>(null);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nextId = useRef(0);
  const suppressNextAdd = useRef(false);
  const started = useRef(false);
  const isContactValid = customerName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());

  useEffect(() => {
    const files = (window as any).__leadUploadFiles as File[] | undefined;
    if (files?.length) {
      const urls = files.slice(0, 4).map((f) => URL.createObjectURL(f));
      setPhotoUrls(urls);
      setMarkers(urls.map(() => [{ id: nextId.current++, top: 42, left: 55 }]));
      return () => { urls.forEach((u) => URL.revokeObjectURL(u)); };
    }
  }, []);

  const showInvalidImageFallback = (source: 'upload' | 'live-scan') => {
    sessionStorage.removeItem('estimateData');
    sessionStorage.removeItem('liveScanDispatchMode');
    sessionStorage.removeItem('liveScanFullAnalysis');
    setInvalidImageFallback({ source, reason: 'no_vehicle_detected' });
    console.info('[estimate-image-validation]', {
      validation_status: 'invalid_image',
      validation_reason: 'no_vehicle_detected',
      source,
      flow: 'public-estimate',
    });
  };

  useEffect(() => {
    if (!analysisInfo || !photoUrls.length) return;
    const count = Math.min(Math.max(0, analysisInfo.dentCount), 5);
    const spread = [
      { top: 38, left: 62 }, { top: 55, left: 38 }, { top: 28, left: 55 },
      { top: 63, left: 72 }, { top: 45, left: 25 },
    ];
    setMarkers(photoUrls.map(() =>
      Array.from({ length: count }, (_, i) => ({ id: nextId.current++, ...spread[i] }))
    ));
  }, [analysisInfo]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const invalidFallbackRaw = sessionStorage.getItem(INVALID_IMAGE_FALLBACK_KEY);
    if (invalidFallbackRaw) {
      try {
        const invalidFallback = JSON.parse(invalidFallbackRaw) as InvalidImageFallbackState;
        setInvalidImageFallback({
          source: invalidFallback.source || 'upload',
          reason: invalidFallback.reason || 'no_vehicle_detected',
        });
      } catch {
        setInvalidImageFallback({ source: 'upload', reason: 'no_vehicle_detected' });
      } finally {
        sessionStorage.removeItem(INVALID_IMAGE_FALLBACK_KEY);
      }
      setZip((window as any).__leadZipCode || '');
      return;
    }

    const dispatchModeRaw = sessionStorage.getItem('liveScanDispatchMode');
    if (dispatchModeRaw) {
      try {
        const dispatchMode: LiveScanDispatchMode = JSON.parse(dispatchModeRaw);
        const initialZip = dispatchMode.zip || (window as any).__leadZipCode || '';
        const estimateRaw = sessionStorage.getItem('estimateData');

        if (estimateRaw) {
          const estimate = JSON.parse(estimateRaw) as {
            damageCategory?: string;
            location?: string;
            repairTime?: string;
          };
          setBottomData({
            damageCategory: estimate.damageCategory || 'Minor Dent',
            location: estimate.location || dispatchMode.panelName || 'Vehicle panel',
            repairTime: estimate.repairTime || '1–2 hours',
          });
        }

        setZip(initialZip);
        setAnalysisInfo({
          panelName: normalizePanel(dispatchMode.panelName || 'Door/s'),
          damageType: dispatchMode.damageType || 'PDR Dent',
          dentCount: Math.max(1, Number(dispatchMode.dentCount || 1)),
          level: dispatchMode.level || 'Shallow',
        });
        setStage(3);
      } catch {
        setZip((window as any).__leadZipCode || '');
        setTimeout(runAnalysis, 900);
      } finally {
        sessionStorage.removeItem('liveScanDispatchMode');
      }
      return;
    }

    setZip((window as any).__leadZipCode || '');
    setTimeout(runAnalysis, 900);
  }, []);

  useEffect(() => {
    if (stage !== 2 && stage !== 3) return;

    const pulseInterval = window.setInterval(() => {
      setStatusPulse((prev) => prev + 1);
    }, 900);

    return () => {
      window.clearInterval(pulseInterval);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 4) return;
    setDispatchSecondsLeft(DISPATCH_TOTAL_SECONDS);
    const timer = window.setInterval(() => {
      setDispatchSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [stage]);

  useEffect(() => {
    if (stage === 4 && dispatchSecondsLeft === 0) {
      window.location.hash = '#/estimate-results';
    }
  }, [stage, dispatchSecondsLeft]);

  const buildDemoPayload = () => {
    const zip = (window as any).__leadZipCode || '';
    return {
      analysis: null,
      damageType: 'pdr',
      estimateMin: 250,
      estimateMax: 375,
      confidence: 88,
      dents: 1,
      scratches: 0,
      damageCategory: 'Minor Dent',
      location: 'Front Right Door',
      repairTime: '1–2 hours',
      zip,
      isDemo: true,
    };
  };

  const isAuthError = (msg: string) =>
    /auth|anonymous|authentication|401|unauthorized|jwt|token/i.test(msg);

  const runAnalysis = async () => {
    setStage(2);
    try {
      const files = (window as any).__leadUploadFiles as File[] | undefined;
      if (!files?.length) throw new Error('No images provided. Please go back and upload a photo.');

      const verified = (
        await Promise.all(files.map(async (f) => ({ f, ok: (await verifyIsCarImage(f)).is_car })))
      ).filter((v) => v.ok).map((v) => v.f);

      if (!verified.length) {
        showInvalidImageFallback('upload');
        return;
      }

      const panelResult = await identifyPanelsFromImages(verified);
      const panels = panelResult.panels.length ? panelResult.panels : [PanelType.Doors];

      const analysis = await analyzeDents(
        verified,
        VehicleType.Sedan,
        MaterialType.Steel,
        LightingType.Daylight,
        panels,
        'pdr',
      );

      const topPanel = [...analysis.panels].sort((a, b) => b.dent_count - a.dent_count)[0];
      const dentCount = analysis.summary.total_dents;
      const damageCategory = dentCount <= 2 ? 'Minor Dent' : dentCount <= 5 ? 'Moderate Dent' : 'Multiple Dents';
      const location = topPanel
        ? topPanel.panel_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Vehicle Panel';
      const repairTime = dentCount <= 2 ? '1–2 hours' : dentCount <= 5 ? '1–3 hours' : '3–5 hours';
      const isHail = detectHailDamage(analysis);
      const hasPaintDamage = !!(analysis.flags?.pdr_incompatible) || analysis.summary.total_scratches > 0;

      const estMin = analysis.summary.estimated_total_cost_AUD?.min ?? 225;
      const estMax = analysis.summary.estimated_total_cost_AUD?.max ?? 395;

      console.info('[estimate-ai-source]', {
        _source: (analysis as any)._source || 'unknown',
        _openai_error: (analysis as any)._openai_error || null,
        estimated_min: estMin,
        estimated_max: estMax,
        total_dents: dentCount,
        total_scratches: analysis.summary.total_scratches,
        pdr_incompatible: analysis.flags?.pdr_incompatible,
        hasPaintDamage,
      });

      const payload = {
        analysis,
        damageType: isHail ? 'hail' : hasPaintDamage ? 'paint' : 'pdr',
        estimateMin: estMin,
        estimateMax: estMax,
        confidence: analysis.summary.confidence_overall,
        dents: dentCount,
        scratches: analysis.summary.total_scratches,
        hasPaintDamage,
        damageCategory,
        location,
        repairTime,
        zip: (window as any).__leadZipCode || '',
      };

      sessionStorage.setItem('estimateData', JSON.stringify(payload));
      setBottomData({ damageCategory, location, repairTime });
      const cnt = topPanel?.dent_count ?? analysis.summary.total_dents;
      const lvl: AnalysisInfo['level'] = cnt <= 2 ? 'Shallow' : cnt <= 4 ? 'Medium' : 'Deep';
      const pNameRaw = topPanel?.panel_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Door';
      setAnalysisInfo({ panelName: normalizePanel(pNameRaw), damageType: isHail ? 'Hail Damage' : 'PDR Dent', dentCount: cnt, level: lvl });
      setStage(3);
      animateShops(estMin, estMax);
    } catch (err) {
      if ((err as any)?.code === 'INVALID_IMAGE') {
        showInvalidImageFallback('upload');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (isAuthError(msg)) {
        const payload = buildDemoPayload();
        sessionStorage.setItem('estimateData', JSON.stringify(payload));
        setBottomData({ damageCategory: payload.damageCategory, location: payload.location, repairTime: payload.repairTime });
        setAnalysisInfo({ panelName: 'Door/s', damageType: 'PDR Dent', dentCount: payload.dents, level: 'Shallow' });
        setStage(3);
        animateShops(payload.estimateMin, payload.estimateMax);
      } else {
        setError(msg || 'Analysis failed. Please try again.');
      }
    }
  };

  const animateShops = (min: number, max: number) => {
    const mid = Math.round((min + max) / 2);
    const prices = [`$${mid - 25}–$${mid + 25}`, `$${mid - 40}–$${mid + 10}`, `$${mid - 15}–$${mid + 45}`];

    setShops((prev) =>
      prev.map((shop, i) => ({
        ...shop,
        status: i === 0 ? 'analyzing' : 'waiting',
        price: undefined,
      }))
    );

    [0, 1, 2].forEach((idx) => {
      window.setTimeout(() => {
        setShops((prev) =>
          prev.map((shop, i) => {
            if (i === idx) {
              return { ...shop, status: 'responded', price: prices[idx], ago: 'just now' };
            }

            if (i === idx + 1 && i < prev.length) {
              return { ...shop, status: 'analyzing' };
            }

            return shop;
          })
        );
      }, 800 + idx * 1100);
    });

    window.setTimeout(() => {
      setShops((prev) => prev.map((shop, i) => (i >= 3 ? { ...shop, status: 'analyzing' } : shop)));
    }, 4300);
  };

  const handleMarkerDown = (photoIdx: number, markerIdx: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    suppressNextAdd.current = true;
    setDragging({ photoIdx, markerIdx });
  };

  const handleContainerMove = (photoIdx: number) => (e: React.PointerEvent) => {
    if (dragging?.photoIdx !== photoIdx) return;
    const rect = containerRefs.current[photoIdx]?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(5, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));
    setMarkers((prev) =>
      prev.map((arr, pi) =>
        pi !== photoIdx ? arr : arr.map((m, mi) => (mi === dragging!.markerIdx ? { ...m, top: y, left: x } : m))
      )
    );
  };

  const handleContainerUp = () => {
    setDragging(null);
    window.setTimeout(() => {
      suppressNextAdd.current = false;
    }, 0);
  };

  const handleDeleteMarker = (photoIdx: number, markerIdx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setMarkers((prev) =>
      prev.map((arr, pi) => (pi !== photoIdx ? arr : arr.filter((_, mi) => mi !== markerIdx)))
    );
  };

  const handleContainerClick = (photoIdx: number) => (e: React.MouseEvent) => {
    if (suppressNextAdd.current) return;
    if (dragging) return;
    const rect = containerRefs.current[photoIdx]?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(5, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));
    setMarkers((prev) =>
      prev.map((arr, pi) =>
        pi !== photoIdx ? arr : [...arr, { id: nextId.current++, top: y, left: x }]
      )
    );
  };

  const handleAdvance = () => {
    if (!isContactValid) return;
    const current = sessionStorage.getItem('estimateData');
    if (current && analysisInfo) {
      try {
        const parsed = JSON.parse(current);
        const markerCount = markers.reduce((sum, group) => sum + group.length, 0);
        const next = {
          ...parsed,
          location: analysisInfo.panelName,
          damageTypeLabel: analysisInfo.damageType,
          dents: markerCount,
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
          },
          userConfirmed: {
            panelName: analysisInfo.panelName,
            damageType: analysisInfo.damageType,
            dentCount: markerCount,
            damageLevel: analysisInfo.level,
            name: customerName.trim(),
            email: customerEmail.trim(),
          },
        };
        sessionStorage.setItem('estimateData', JSON.stringify(next));
      } catch {
      }
    }
    setStage(4);
  };

  const handleSkipDispatch = () => {
    window.location.hash = '#/estimate-results';
  };

  const handlePanelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const panelName = e.target.value;
    setAnalysisInfo((prev) => (prev ? { ...prev, panelName } : prev));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const damageType = e.target.value;
    setAnalysisInfo((prev) => (prev ? { ...prev, damageType } : prev));
  };

  const handleUploadAnotherPhoto = () => {
    window.location.hash = '#/';
  };

  const handleBackToStart = () => {
    window.location.hash = '#/';
  };

  if (invalidImageFallback) {
    return (
      <div className="min-h-screen" style={{ background: '#eef2f8' }}>
        <EstimateHeader currentStep={1} />

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border border-[#d8e0f3] rounded-[28px] overflow-hidden shadow-sm">
            <div className="bg-[#273548] px-6 py-5 text-white">
              <p className="text-[11px] font-black tracking-[0.15em] uppercase text-[#9ec2ff]">AI Image Validation</p>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">We couldn’t detect a vehicle in this photo</h1>
              <p className="text-sm text-[#d7e4ff] mt-2 max-w-2xl">
                Dent-Vision AI can only estimate automotive dent damage from clear vehicle photos. Please upload a photo showing the damaged car panel.
              </p>
            </div>

            <div className="p-5 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4 mb-4">
                <div className="rounded-2xl border border-[#e5e7f0] bg-[#f8faff] p-4">
                  <p className="text-xs font-black text-[#4f46e5] uppercase tracking-[0.14em] mb-2">How to fix this</p>
                  <div className="space-y-2.5">
                    {[
                      'Upload a clear photo of the dent',
                      'Show the full damaged vehicle panel',
                      'Avoid screenshots, people, documents, tools, or unrelated images',
                    ].map((item, index) => (
                      <div key={item} className="rounded-xl border border-[#dde4f7] bg-white p-3 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#4f46e5] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{index + 1}</span>
                        <p className="text-sm text-[#1f2937] leading-snug">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e5e7f0] bg-[#f8faff] p-4 flex flex-col">
                  <p className="text-xs font-black text-[#f97316] uppercase tracking-[0.14em] mb-2">Scan Status</p>
                  <div className="rounded-xl bg-[#0f172a] h-36 relative overflow-hidden border border-[#1f2937] mb-3">
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: 'linear-gradient(rgba(124,58,237,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.25) 1px, transparent 1px)',
                        backgroundSize: '22px 22px',
                      }}
                    />
                    <div className="invalid-scan-line" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-[#7c3aed]/20 border border-[#a78bfa] flex items-center justify-center">
                        <span className="text-2xl">🚘</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-[#4b5563] leading-relaxed">
                    No quote was created and no bodyshop has received this image.
                  </p>
                  <p className="text-xs text-[#6b7280] mt-2">
                    You can upload another photo now or go back to the start and contact a shop directly.
                  </p>
                  <p className="text-[11px] text-[#8b93a7] mt-2">
                    Source: {invalidImageFallback.source === 'live-scan' ? 'Live Scan' : 'Upload'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleUploadAnotherPhoto}
                  className="flex-1 rounded-xl py-3 px-4 text-white font-bold bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] hover:brightness-110 transition-all"
                >
                  Upload Another Photo
                </button>
                <button
                  type="button"
                  onClick={handleBackToStart}
                  className="flex-1 rounded-xl py-3 px-4 font-bold text-[#1f2937] bg-[#eef2ff] border border-[#d8def3] hover:bg-[#e4e9fb] transition-colors"
                >
                  Back to Start
                </button>
              </div>
            </div>
          </div>
        </div>

        <DarkFooter />
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen" style={{ background: '#eef2f8' }}>
      <EstimateHeader currentStep={2} />
      <div className="min-h-[70vh] px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-md">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-semibold text-[#111827] mb-1">Analysis could not be completed</p>
          <p className="text-sm text-[#5f6b7b] mb-5">{error}</p>
          <a href="#/" className="inline-block px-6 py-2.5 rounded-full bg-[#273548] text-white text-sm font-semibold">← Go Back</a>
        </div>
      </div>
    </div>
  );

  if (stage === 4) {
    const elapsed = DISPATCH_TOTAL_SECONDS - dispatchSecondsLeft;
    const progress = Math.min(100, (elapsed / DISPATCH_TOTAL_SECONDS) * 100);
    const minutes = Math.floor(dispatchSecondsLeft / 60);
    const seconds = String(dispatchSecondsLeft % 60).padStart(2, '0');
    const completion = Math.round(progress);
    const quotesReceived = Math.min(3, Math.floor(elapsed / 55));
    const currentlyReviewing = Math.max(3, 10 - quotesReceived);
    const summaryDamage = bottomData?.damageCategory ?? 'Minor Dent';
    const summaryLocation = bottomData?.location ?? 'Front Right Door';
    const summaryMethod = analysisInfo?.damageType?.includes('Hail') ? 'Hail Dent Repair' : 'PDR (Paintless Dent Repair)';
    const summarySize = analysisInfo?.level === 'Deep' ? '4 - 6 inches' : analysisInfo?.level === 'Medium' ? '3 - 5 inches' : '2 - 4 inches';
    const progressSteps = [
      { label: 'Photos uploaded securely', checkpoint: 15 },
      { label: 'Request shared with nearby shops', checkpoint: 55 },
      { label: 'Shops reviewing your damage', checkpoint: 100 },
      { label: 'Preparing your final estimate page', checkpoint: 150 },
    ];
    const liveFeed = [
      { initials: 'PDR', name: 'PDR Pro Studio', action: 'viewed your request', ago: '2s ago' },
      { initials: 'DM', name: 'Dent Masters LA', action: 'is reviewing your photos', ago: '12s ago' },
      { initials: 'QDR', name: 'Quick Dent Repair', action: 'requested estimate details', ago: '27s ago' },
      { initials: 'PD', name: 'Precision Dentistry', action: 'has started preparing a quote', ago: '35s ago' },
    ];
    const radialNodes = [
      { top: '14%', left: '23%', type: 'logo', label: 'PDR', tone: 'dark' },
      { top: '14%', left: '50%', type: 'shop' },
      { top: '14%', left: '77%', type: 'logo', label: 'DM', tone: 'light' },
      { top: '38%', left: '88%', type: 'logo', label: 'PD', tone: 'teal' },
      { top: '62%', left: '88%', type: 'shop' },
      { top: '86%', left: '67%', type: 'logo', label: 'RISE', tone: 'light' },
      { top: '86%', left: '33%', type: 'shop' },
      { top: '62%', left: '12%', type: 'logo', label: 'QDR', tone: 'dark' },
      { top: '38%', left: '12%', type: 'shop' },
    ] as const;
    const phase =
      elapsed < 45
        ? 'Uploading your photos to nearby bodyshops'
        : elapsed < 95
          ? 'Matching your request with verified PDR specialists'
          : elapsed < 145
            ? 'Collecting live responses from local shops'
            : 'Finalizing your best estimate options';

    return (
      <div className="min-h-screen" style={{ background: '#eef2f8' }}>
        <EstimateHeader currentStep={3} />

        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-white rounded-[26px] border border-[#e8ebf3] p-4 md:p-5 shadow-sm">
            <div className="text-center mb-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4f46e5] mb-1">Sending request to shops</p>
              <h1 className="text-2xl md:text-[42px] md:leading-[1.05] font-extrabold text-[#101828]">Nearby bodyshops are reviewing your damage</h1>
              <p className="text-sm text-[#6b7280] mt-1.5">This can take up to 3 minutes while we send your photos and receive live quotes.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.95fr_0.95fr] gap-3.5">
              <div className="bg-[#f7f8fc] border border-[#e9ecf4] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-bold text-[#111827]">{phase}</p>
                  <p className="text-lg font-black text-[#4f46e5]">{minutes}:{seconds}</p>
                </div>
                <div className="h-2 bg-[#e5e7ef] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#5146e5] to-[#7a5cff] transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
                <div className="relative pt-1 mb-2.5">
                  <div className="absolute left-0 right-0 top-[15px] h-[2px] bg-[#d7dbe7]" />
                  <div className="absolute left-0 top-[15px] h-[2px] bg-[#4f46e5] transition-all duration-700" style={{ width: `${progress}%` }} />
                  <div className="relative grid grid-cols-4 gap-1">
                    {progressSteps.map((step, idx) => {
                      const done = elapsed >= step.checkpoint;
                      return (
                        <div key={step.label} className="text-center">
                          <span
                            className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                              done ? 'bg-[#22c55e] border-[#22c55e]' : 'bg-[#b9bec9] border-[#b9bec9]'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <p className={`text-[10px] leading-tight mt-2 ${done || idx === 0 ? 'text-[#111827] font-semibold' : 'text-[#8b93a7]'}`}>
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[11px] text-[#8b93a7] mb-4">{completion}% complete</p>

                <div className="border-t border-[#e3e7f1] pt-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-bold text-[#111827]">Live activity</p>
                    <p className="text-[10px] text-[#6b7280] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Real-time updates
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {liveFeed.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full border border-[#d7dbe7] bg-white flex items-center justify-center text-[8px] font-black text-[#1f2937] flex-shrink-0">{item.initials}</div>
                          <p className="text-[12px] text-[#111827] truncate">
                            <span className="font-semibold">{item.name}</span>{' '}
                            <span className="text-[#636b7e]">{item.action}</span>
                          </p>
                        </div>
                        <span className="text-[10px] text-[#9aa2b4] flex-shrink-0">{item.ago}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] text-[#4f46e5] font-semibold mt-3">More updates coming in...</p>
                </div>
              </div>

              <div className="bg-[#f7f8fc] border border-[#e9ecf4] rounded-2xl p-4">
                <p className="text-[13px] font-bold text-[#111827] mb-3">Finding the best match for you</p>
                <div className="relative h-[250px] rounded-xl bg-[#f4f6ff] border border-[#e7e9f6] flex items-center justify-center overflow-hidden">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 260 260" fill="none">
                    {[
                      [130, 130, 130, 26], [130, 130, 202, 53], [130, 130, 233, 94], [130, 130, 233, 165],
                      [130, 130, 202, 207], [130, 130, 130, 234], [130, 130, 58, 207], [130, 130, 27, 165], [130, 130, 27, 94], [130, 130, 58, 53],
                    ].map((line, i) => (
                      <line key={i} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="#d7dcf4" strokeWidth="1.4" strokeDasharray="4 4" strokeLinecap="round" />
                    ))}
                    <circle cx="130" cy="130" r="76" fill="#eceeff" />
                    <circle cx="130" cy="130" r="50" fill="#e4e8ff" />
                  </svg>

                  {radialNodes.map((node, i) => {
                    return (
                      <div
                        key={`${node.type === 'logo' ? node.label : node.type}-${i}`}
                        className="absolute w-14 h-14 rounded-full bg-[#eef1f7] border border-[#e5e8f2] shadow-[inset_0_1px_0_#ffffff]"
                        style={{ top: node.top, left: node.left, transform: 'translate(-50%, -50%)' }}
                      >
                        <div className="relative w-full h-full flex items-center justify-center">
                          {node.type === 'shop' ? (
                            <span className="w-9 h-9 rounded-full bg-white border border-[#e1e5f2] shadow-sm flex items-center justify-center">
                              <svg className="w-4.5 h-4.5 text-[#635bff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9m-18 0h18m-1 0v8a2 2 0 01-2 2H6a2 2 0 01-2-2V9m5 5h6" />
                              </svg>
                            </span>
                          ) : (
                            <span
                              className={`relative w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black ${
                                node.tone === 'dark'
                                  ? 'bg-[#0f172a] text-white'
                                  : node.tone === 'teal'
                                    ? 'bg-[#0ea5b7] text-[#062f35]'
                                    : 'bg-white text-[#111827] border border-[#d8dbe8]'
                              }`}
                            >
                              {node.label}
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22c55e] border border-white" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="relative z-20 w-16 h-16 rounded-full bg-gradient-to-br from-[#5b5dfd] to-[#4f46e5] shadow-[0_0_30px_rgba(79,70,229,0.45)] flex items-center justify-center person-core">
                    <span className="absolute inset-0 rounded-full bg-[#5b5dfd]/30 animate-ping" style={{ animationDuration: '1.6s' }} />
                    <span className="absolute inset-1 rounded-full bg-[#5b5dfd]/35" />
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="relative z-10 w-7 h-7 text-white"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H5z" />
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div>
                    <p className="text-3xl leading-none font-extrabold text-[#4f46e5]">12</p>
                    <p className="text-[10px] text-[#8b93a7] mt-1">Bodyshops Connected</p>
                  </div>
                  <div>
                    <p className="text-3xl leading-none font-extrabold text-[#4f46e5]">{currentlyReviewing}</p>
                    <p className="text-[10px] text-[#8b93a7] mt-1">Currently Reviewing</p>
                  </div>
                  <div>
                    <p className="text-3xl leading-none font-extrabold text-[#4f46e5]">{quotesReceived}</p>
                    <p className="text-[10px] text-[#8b93a7] mt-1">Quotes Received</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="bg-[#f7f8fc] border border-[#e9ecf4] rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-[#111827] mb-3 flex items-center gap-1.5">
                    <span className="text-[#4f46e5]">✦</span> AI Analysis Summary
                  </p>
                  <div className="space-y-2.5 text-[12px]">
                    <div>
                      <p className="text-[#8b93a7]">Damage Type</p>
                      <p className="font-semibold text-[#111827]">{summaryDamage}</p>
                    </div>
                    <div>
                      <p className="text-[#8b93a7]">Size Estimate</p>
                      <p className="font-semibold text-[#111827]">{summarySize}</p>
                    </div>
                    <div>
                      <p className="text-[#8b93a7]">Best Repair Method</p>
                      <p className="font-semibold text-[#111827]">{summaryMethod}</p>
                    </div>
                    <div>
                      <p className="text-[#8b93a7]">Location</p>
                      <p className="font-semibold text-[#111827]">{summaryLocation}</p>
                    </div>
                    <div>
                      <p className="text-[#8b93a7]">Confidence Score</p>
                      <p className="font-extrabold text-green-600">92%</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#f7f8fc] border border-[#e9ecf4] rounded-2xl p-4">
                  <p className="text-[13px] font-bold text-[#111827] mb-1">Your data is secure</p>
                  <p className="text-[12px] text-[#6b7280] leading-relaxed">
                    Your photos and information are encrypted and shared only with verified repair shops.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 bg-[#f7f8fc] border border-[#e9ecf4] rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-[11px] text-[#6b7280]">ⓘ We contact real nearby repair shops to provide more accurate quote confirmations.</p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-[#4f46e5] border border-[#d9dded] hover:bg-[#eef0ff] transition-colors">
                  Need help?
                </button>
                <button
                  onClick={handleSkipDispatch}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-white bg-[#4f46e5] hover:brightness-110 transition-all"
                >
                  Skip for testing
                </button>
              </div>
            </div>
          </div>
        </div>

        <DarkFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#eef2f8' }}>
      <EstimateHeader currentStep={stage} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#111827]">
            {stage <= 2 ? 'AI Analysis in Progress…' : stage === 3 ? 'AI Analysis in Progress' : 'AI Analysis Complete!'}
          </h1>
          <p className="text-[#5f6b7b] mt-2 max-w-lg mx-auto text-sm">
            {stage <= 3 ? (
              <>
                We're connecting with trusted PDR shops near{' '}
                <span className="font-bold text-[#4f46e5]">{zip || 'your area'}</span> to get you the best estimate.
              </>
            ) : 'Nearby shops are reviewing your request.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          {/* ── Left ── */}
          <div className="flex flex-col">

            {/* ── Uploaded photos grid with draggable markers ── */}
            {photoUrls.length > 0 && (
              <div className="w-full mt-6">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-sm font-bold text-[#111827]">Your Submitted Photos</p>
                  <span className="text-[11px] bg-[#eef2ff] text-[#4f46e5] font-semibold px-2.5 py-0.5 rounded-full">
                    {photoUrls.length} / 4 slots
                  </span>
                </div>

                {analysisInfo && stage >= 3 && (
                  <p className="text-[11px] text-[#9ca3af] mb-2.5 leading-relaxed">
                    Drag the marker on your photo to position it over the dent. Confirm when ready.
                  </p>
                )}

                <div className={`grid gap-2.5 ${photoUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {photoUrls.map((url, i) => {
                    const photoMarkers = markers[i] ?? [];
                    const detected = stage >= 3;
                    return (
                      <div key={i} className="rounded-2xl border border-[#dbe4ff] bg-[#f8faff] p-1.5">
                        <div
                          ref={(el) => { containerRefs.current[i] = el; }}
                          className={`relative rounded-xl overflow-hidden bg-gray-100 select-none ${detected ? 'cursor-crosshair' : ''}`}
                          style={{ aspectRatio: '16/9', touchAction: 'none' }}
                          onPointerMove={handleContainerMove(i)}
                          onPointerUp={handleContainerUp}
                          onPointerLeave={handleContainerUp}
                          onClick={detected ? handleContainerClick(i) : undefined}
                        >
                          <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

                          {!detected && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                              <div className="photo-scan-line" />
                            </div>
                          )}

                        {/* Scanner corner reticles */}
                          {!detected && (
                            <div className="absolute inset-0 pointer-events-none">
                              <span className="scan-corner tl" />
                              <span className="scan-corner tr" />
                              <span className="scan-corner bl" />
                              <span className="scan-corner br" />
                            </div>
                          )}

                        {/* Numbered draggable markers */}
                          {photoMarkers.map((m, mi) => (
                            <div
                              key={m.id}
                              className="absolute z-20"
                              style={{ top: `${m.top}%`, left: `${m.left}%`, transform: 'translate(-50%,-50%)' }}
                            >
                              <div
                                className="relative cursor-grab active:cursor-grabbing"
                                onPointerDown={handleMarkerDown(i, mi)}
                              >
                                <span className="absolute w-8 h-8 rounded-full bg-amber-400/30 animate-ping" style={{ inset: '-4px' }} />
                                <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 ring-2 ring-white shadow-lg text-[10px] font-black text-white">
                                  {mi + 1}
                                </span>
                                <button
                                  className="absolute -top-2.5 -right-2.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md hover:bg-red-600 z-30 cursor-pointer"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={handleDeleteMarker(i, mi)}
                                  title="Remove marker"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}

                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                            {detected ? (
                              <>
                                <span className="inline-flex items-center gap-1 bg-amber-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                  ⚡ {photoMarkers.length} damage{photoMarkers.length !== 1 ? 's' : ''} marked
                                </span>
                                <span className="inline-flex items-center gap-1 bg-black/50 text-white/90 text-[9px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                                  + tap to add
                                </span>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-[#4f46e5]/85 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                                Scanning…
                              </span>
                            )}
                          </div>

                          <div className="absolute top-2 right-2">
                            <span className="bg-black/40 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                              {i + 1}/{photoUrls.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Damage Info Panel + Confirm ── */}
                {analysisInfo && stage >= 3 && (
                  <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-[#e5e7eb]">
                    <p className="text-xs font-bold text-[#111827] mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      Damage Summary
                    </p>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-[#f8faff] rounded-xl p-2.5">
                        <p className="text-[9px] text-[#9ca3af] uppercase tracking-wide mb-0.5">Panel</p>
                        <select
                          value={analysisInfo.panelName}
                          onChange={handlePanelChange}
                          className="w-full bg-white border border-[#dbe4ff] rounded-lg text-xs font-bold text-[#111827] px-2 py-1.5 outline-none focus:border-[#4f46e5]"
                        >
                          {PANEL_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="bg-[#f8faff] rounded-xl p-2.5">
                        <p className="text-[9px] text-[#9ca3af] uppercase tracking-wide mb-0.5">Type</p>
                        <select
                          value={analysisInfo.damageType}
                          onChange={handleTypeChange}
                          className="w-full bg-white border border-[#dbe4ff] rounded-lg text-xs font-bold text-[#111827] px-2 py-1.5 outline-none focus:border-[#4f46e5]"
                        >
                          {TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="bg-[#f8faff] rounded-xl p-2.5">
                        <p className="text-[9px] text-[#9ca3af] uppercase tracking-wide mb-0.5">Marked</p>
                        <p className="text-xs font-bold text-[#111827]">{markers.reduce((s, a) => s + a.length, 0)}</p>
                      </div>
                    </div>

                    <p className="text-[9px] text-[#9ca3af] uppercase tracking-wide mb-2">Damage Level</p>
                    <div className="flex gap-2 mb-4">
                      {(['Shallow', 'Medium', 'Deep'] as const).map((lvl) => {
                        const active = analysisInfo.level === lvl;
                        const { color, desc } = LEVEL_META[lvl];
                        return (
                          <div
                            key={lvl}
                            className={`flex-1 rounded-xl px-2 py-2.5 text-center border-2 transition-all ${
                              active ? 'shadow-sm' : 'opacity-35'
                            }`}
                            style={active ? { borderColor: color, background: color + '18' } : { borderColor: '#f3f4f6' }}
                          >
                            <p className="text-[11px] font-extrabold" style={{ color: active ? color : '#9ca3af' }}>{lvl}</p>
                            <p className="text-[9px] mt-0.5 leading-tight" style={{ color: active ? color : '#c4c9d4' }}>{desc}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mb-3 rounded-xl border border-[#e5e7eb] bg-[#f8faff] px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[#4f46e5]">✦</span>
                          <p className="text-xs font-medium text-[#111827]">
                            {bottomData
                              ? 'Our AI has already detected the dent and prepared your photo for analysis.'
                              : 'Analyzing your photo…'}
                          </p>
                        </div>
                        {bottomData && (
                          <div className="flex items-center gap-4">
                            <div><p className="text-[10px] text-[#9ca3af]">Damage Type</p><p className="text-xs font-bold text-[#111827]">{bottomData.damageCategory}</p></div>
                            <div><p className="text-[10px] text-[#9ca3af]">Location</p><p className="text-xs font-bold text-[#111827]">{bottomData.location}</p></div>
                            <div><p className="text-[10px] text-[#9ca3af]">Est. Repair Time</p><p className="text-xs font-bold text-[#111827]">{bottomData.repairTime}</p></div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
                      <label className="block">
                        <span className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-1 block">Name</span>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Your full name"
                          className="w-full rounded-xl border border-[#dbe4ff] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#4f46e5]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-[#9ca3af] uppercase tracking-wide mb-1 block">Email</span>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-xl border border-[#dbe4ff] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#4f46e5]"
                        />
                      </label>
                    </div>

                    {!isContactValid && (
                      <p className="text-[11px] text-[#9ca3af] mb-3">Fill in name and a valid email to continue.</p>
                    )}

                    <button
                      onClick={handleAdvance}
                      disabled={!isContactValid}
                      className={`w-full py-3.5 rounded-xl text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 ${
                        isContactValid
                          ? 'bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] hover:shadow-lg hover:brightness-105'
                          : 'bg-[#b8bed1] cursor-not-allowed'
                      }`}
                    >
                      ✓ Confirm & Get Estimate
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 mt-8 w-full">
              {[
                { icon: '🔒', title: 'Secure & Private', desc: 'Your data is encrypted and never shared.' },
                { icon: '⚡', title: 'Real-Time Network', desc: 'Connecting with verified PDR shops near you.' },
                { icon: '🎯', title: 'Best Price Guarantee', desc: 'We find the best value, not just any price.' },
              ].map((b) => (
                <div key={b.title} className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl mb-1.5">{b.icon}</div>
                  <p className="text-xs font-semibold text-[#111827]">{b.title}</p>
                  <p className="text-[11px] text-[#9ca3af] mt-0.5">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right ── */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-[#111827] text-sm">Connecting to Your Local Network</h3>
                <p className="text-[11px] text-[#9ca3af]">Shops are reviewing your photo in real-time</p>
              </div>
              <span className="flex items-center gap-1 text-green-500 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" /> Live
              </span>
            </div>

            {/* Radial network map */}
            <div className="relative bg-[#f8faff] rounded-xl h-36 mb-4 overflow-hidden flex items-center justify-center">
              <div className="absolute rounded-full border-2 border-[#4f46e5]/10 animate-ping" style={{ width: 100, height: 100, animationDuration: '2s' }} />
              <div className="absolute rounded-full border border-[#4f46e5]/15" style={{ width: 80, height: 80 }} />
              <div className="relative z-10 w-10 h-10 rounded-full bg-white border-2 border-[#4f46e5]/30 flex items-center justify-center shadow">
                <svg className="w-5 h-5 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              {DOT_POSITIONS.map((pos, i) => (
                <div key={i} className="absolute w-8 h-8 bg-white border border-[#e5e7eb] rounded-lg shadow-sm flex items-center justify-center" style={pos as React.CSSProperties}>
                  <svg className="w-4 h-4 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              ))}
            </div>

            {/* Live network activity banner */}
            <div className="flex items-center justify-between bg-[#f3f4ff] rounded-lg px-3 py-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-[#4f46e5] font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                Live network activity
              </div>
              <svg className="w-4 h-4 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Shop list */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#111827]">Shop Responses</p>
              <p className="text-xs text-[#4f46e5] font-semibold">{shops.length} Connected</p>
            </div>
            <div className="space-y-2.5">
              {shops.map((shop, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#4f46e5]/10 flex items-center justify-center text-[#4f46e5] text-[10px] font-bold">
                      {shop.initials}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#111827]">{shop.name}</p>
                      <p className="text-[10px] text-[#9ca3af]">{shop.distance} away</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(shop.status)}`} />
                    <span className="text-xs text-[#9ca3af]">
                      {statusLabel(shop.status, shop.price, statusPulse)}
                    </span>
                    <span className="text-[10px] text-[#c4c9d4]">{shop.ago}</span>
                  </div>
                </div>
              ))}
              <p className="text-center text-[11px] text-[#9ca3af] pt-1">
                {shops.filter((s) => s.status === 'responded').length} responding now • 7 more shops connected…
              </p>
            </div>

            {/* What happens next */}
            <div className="mt-4 pt-4 border-t border-[#f3f4f6]">
              <p className="text-xs font-bold text-[#111827] mb-2">What happens next?</p>
              {[
                { label: 'Shops review your photo', done: stage >= 2 },
                { label: 'They send us their best price', done: stage >= 3 },
                { label: 'You get the best estimate', done: stage >= 4 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-[#4f46e5]' : 'border-2 border-gray-200'}`}>
                    {item.done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs ${item.done ? 'text-[#111827] font-medium' : 'text-[#9ca3af]'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DarkFooter />

      <style>{`
        .scan-ring-outer {
          background: conic-gradient(from 0deg, #5b5dfd, #b667d4, #f19a48, #5b5dfd);
          animation: rotateGradient 3s linear infinite;
        }
        @keyframes rotateGradient {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .photo-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, #4f46e5 20%, #a855f7 50%, #4f46e5 80%, transparent 100%);
          box-shadow: 0 0 8px 2px #4f46e5aa, 0 0 18px 4px #a855f744;
          animation: photoScan 1.8s linear infinite;
          top: 0;
        }
        @keyframes photoScan {
          0%   { top: -2%;  opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { top: 102%; opacity: 0; }
        }
        .invalid-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #4f46e5 35%, #a855f7 65%, transparent 100%);
          box-shadow: 0 0 10px #7c3aed88;
          animation: invalidScan 2.1s linear infinite;
          top: -2%;
        }
        @keyframes invalidScan {
          0%   { top: -2%; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 102%; opacity: 0; }
        }
        .scan-corner {
          position: absolute;
          width: 16px;
          height: 16px;
          border-color: #4f46e5;
          border-style: solid;
          opacity: 0.9;
        }
        .scan-corner.tl { top: 8px;    left: 8px;    border-width: 2px 0 0 2px; }
        .scan-corner.tr { top: 8px;    right: 8px;   border-width: 2px 2px 0 0; }
        .scan-corner.bl { bottom: 8px; left: 8px;    border-width: 0 0 2px 2px; }
        .scan-corner.br { bottom: 8px; right: 8px;   border-width: 0 2px 2px 0; }
        .person-core {
          animation: personPulse 1.8s ease-in-out infinite;
        }
        @keyframes personPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
};

export default EstimateAnalysis;

import React, { useRef, useState, useEffect } from 'react';
import EstimateConsentModal from './PublicEstimate/EstimateConsentModal';
import FlowLegalFooter from './PublicEstimate/FlowLegalFooter';
import DarkFooter from './DarkFooter';
import LiveScanPanelSelector from './LiveScanPanelSelector';
import LiveScanView from './LiveScanView';
import LiveScanPauseView from './LiveScanPauseView';
import UploadMultiPanelModal from './UploadMultiPanelModal';
import { verifyIsCarImage } from '../services/geminiServiceAdapter';
import { PanelType, VehicleType } from '../types';
import { runLiveScanAnalysis } from '../features/live-scan/liveScanOrchestrator';

const CAR_IMAGE_URL = 'https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/imgcar3.png';
const LOGO_URL = 'https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/logo%20new%20wht.png';
const HERO_DESKTOP_IMAGE_URL = 'https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/imgcar6.jpg';
const UPLOAD_CARD_IMAGE_URL = 'https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/img1..png';
const ANALYSIS_CARD_IMAGE_URL = 'https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/img2.png';
const INVALID_IMAGE_FALLBACK_KEY = 'invalidImageValidationFallback';

type PendingConsentAction =
  | { type: 'open-file' }
  | { type: 'open-camera' }
  | { type: 'start-live-scan' }
  | { type: 'navigate' }
  | { type: 'process-files'; files: File[] };

const LeadsGenerator: React.FC = () => {
  const [zip, setZip] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [hasFiles, setHasFiles] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [pendingConsentAction, setPendingConsentAction] = useState<PendingConsentAction | null>(null);
  const [showLiveScanPermissionModal, setShowLiveScanPermissionModal] = useState(false);
  const [requestingLiveScanPermissions, setRequestingLiveScanPermissions] = useState(false);
  const [liveScanPermissionError, setLiveScanPermissionError] = useState<string | null>(null);
  const [showUploadPanelSelector, setShowUploadPanelSelector] = useState(false);
  const [showUploadMultiPanel, setShowUploadMultiPanel] = useState(false);
  const [uploadSelectedPanels, setUploadSelectedPanels] = useState<PanelType[]>([]);
  const [showLiveScanPanelSelector, setShowLiveScanPanelSelector] = useState(false);
  const [showLiveScanActivationModal, setShowLiveScanActivationModal] = useState(false);
  const [showLiveScanView, setShowLiveScanView] = useState(false);
  const [showLiveScanPauseView, setShowLiveScanPauseView] = useState(false);
  const [isProcessingLiveScan, setIsProcessingLiveScan] = useState(false);
  const [liveScanSelectedPanels, setLiveScanSelectedPanels] = useState<PanelType[]>([]);
  const [liveScanCurrentPanelIndex, setLiveScanCurrentPanelIndex] = useState(0);
  const [liveScanCapturedFrames, setLiveScanCapturedFrames] = useState<File[][]>([]);
  const [liveScanFrozenFrame, setLiveScanFrozenFrame] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    document.body.className = 'theme-light';
    const savedConsent = sessionStorage.getItem('estimateConsentAccepted') === 'true';
    setConsentAccepted(savedConsent);
  }, []);

  const navigateToFlow = () => {
    (window as any).__leadZipCode = zip;
    window.location.hash = '#/estimate-analysis';
  };

  const closeLiveScanFlow = () => {
    setShowLiveScanPermissionModal(false);
    setShowLiveScanPanelSelector(false);
    setShowLiveScanActivationModal(false);
    setShowLiveScanView(false);
    setShowLiveScanPauseView(false);
    setIsProcessingLiveScan(false);
  };

  const requestLocationPermission = () =>
    new Promise<void>((resolve) => {
      if (!navigator.geolocation) {
        resolve();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        () => resolve(),
        { timeout: 4000 }
      );
    });

  const handleAllowLiveScanPermissions = async () => {
    if (requestingLiveScanPermissions) return;

    setRequestingLiveScanPermissions(true);
    setLiveScanPermissionError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.getTracks().forEach((track) => track.stop());
      await requestLocationPermission();

      setShowLiveScanPermissionModal(false);
      setShowLiveScanPanelSelector(true);
    } catch {
      setLiveScanPermissionError('Camera access is required to run Live Scan. Please allow camera permission and try again.');
    } finally {
      setRequestingLiveScanPermissions(false);
    }
  };

  const processLiveScanAnalysis = async (capturedByPanel: File[][], selectedPanels: PanelType[]) => {
    const frames = capturedByPanel.flat();
    if (!frames.length) {
      setLiveScanPermissionError('No scan frames were captured. Please try again.');
      setShowLiveScanPanelSelector(true);
      return;
    }

    setIsProcessingLiveScan(true);
    setLiveScanPermissionError(null);

    try {
      const validationFrame = frames[Math.floor(frames.length / 2)] || frames[0];
      const validation = await verifyIsCarImage(validationFrame);

      if (!validation.is_car) {
        sessionStorage.removeItem('estimateData');
        sessionStorage.removeItem('liveScanDispatchMode');
        sessionStorage.removeItem('liveScanFullAnalysis');
        sessionStorage.setItem(
          INVALID_IMAGE_FALLBACK_KEY,
          JSON.stringify({
            source: 'live-scan',
            reason: 'no_vehicle_detected',
          })
        );
        console.info('[estimate-image-validation]', {
          validation_status: 'invalid_image',
          validation_reason: 'no_vehicle_detected',
          source: 'live-scan',
          flow: 'public-estimate',
        });
        closeLiveScanFlow();
        window.location.hash = '#/estimate-analysis';
        return;
      }

      const output = await runLiveScanAnalysis({
        frames,
        liveScanSelectedPanels: selectedPanels,
        vehicleType: VehicleType.Sedan,
      });

      (window as any).__leadUploadFiles = frames;
      (window as any).__leadSelectedPanels = selectedPanels;
      sessionStorage.setItem('liveScanFullAnalysis', JSON.stringify(output.fullAnalysis));
      const result = output.liveScanResult;
      const estimateMin = Number(result.price_range?.min || result.estimated_cost?.min || 0);
      const estimateMax = Number(result.price_range?.max || result.estimated_cost?.max || estimateMin);
      const dents = Number(result.dent_count_estimate || 1);
      const damageCategory = dents <= 2 ? 'Minor Dent' : dents <= 5 ? 'Moderate Dent' : 'Multiple Dents';
      const repairTime = dents <= 2 ? '1–2 hours' : dents <= 5 ? '1–3 hours' : '3–5 hours';
      const damageTypeLabel = result.damage_type === 'hail' ? 'Hail Damage' : 'PDR Dent';
      const damageLevel = dents <= 2 ? 'Shallow' : dents <= 5 ? 'Medium' : 'Deep';

      sessionStorage.setItem(
        'estimateData',
        JSON.stringify({
          damageType: result.damage_type,
          estimateMin,
          estimateMax,
          confidence: Math.round((result.confidence || 0.82) * 100),
          dents,
          scratches: result.needs_paint_repair ? 1 : 0,
          damageCategory,
          location: result.damage_location || 'Vehicle panel',
          repairTime,
          zip,
          source: 'live-scan',
        })
      );

      sessionStorage.setItem(
        'liveScanDispatchMode',
        JSON.stringify({
          panelName: result.damage_location || 'Door/s',
          damageType: damageTypeLabel,
          dentCount: dents,
          level: damageLevel,
          zip,
        })
      );

      closeLiveScanFlow();
      window.location.hash = '#/estimate-analysis';
    } catch (err: any) {
      if (err?.code === 'INVALID_IMAGE') {
        sessionStorage.removeItem('estimateData');
        sessionStorage.removeItem('liveScanDispatchMode');
        sessionStorage.removeItem('liveScanFullAnalysis');
        sessionStorage.setItem(
          INVALID_IMAGE_FALLBACK_KEY,
          JSON.stringify({ source: 'live-scan', reason: 'no_vehicle_detected' })
        );
        console.info('[estimate-image-validation]', {
          validation_status: 'invalid_image',
          validation_reason: 'no_vehicle_detected',
          source: 'live-scan',
          flow: 'public-estimate',
          via: 'analysis-function',
        });
        closeLiveScanFlow();
        window.location.hash = '#/estimate-analysis';
        return;
      }
      setLiveScanPermissionError('Live Scan analysis could not be completed. Please try again with clearer lighting and slower movement.');
      setShowLiveScanPanelSelector(true);
    } finally {
      setIsProcessingLiveScan(false);
    }
  };

  const handleLiveScanPanelComplete = async (frames: File[], frozenFrame: string) => {
    setShowLiveScanView(false);

    const nextCaptured = [...liveScanCapturedFrames];
    nextCaptured[liveScanCurrentPanelIndex] = frames;
    setLiveScanCapturedFrames(nextCaptured);
    setLiveScanFrozenFrame(frozenFrame);

    const isLastPanel = liveScanCurrentPanelIndex >= liveScanSelectedPanels.length - 1;
    if (isLastPanel) {
      await processLiveScanAnalysis(nextCaptured, liveScanSelectedPanels);
      return;
    }

    setShowLiveScanPauseView(true);
  };

  const executeAction = (action: PendingConsentAction) => {
    if (action.type === 'open-file' || action.type === 'open-camera') {
      setShowUploadPanelSelector(true);
      return;
    }

    if (action.type === 'start-live-scan') {
      setLiveScanPermissionError(null);
      setShowLiveScanPermissionModal(true);
      return;
    }

    if (action.type === 'navigate') {
      if (hasFiles) navigateToFlow();
      return;
    }

    (window as any).__leadUploadFiles = action.files;
    setHasFiles(action.files.length > 0);
    if (action.files.length > 0) navigateToFlow();
  };

  const requestConsentAndRun = (action: PendingConsentAction) => {
    if (action.type === 'start-live-scan') {
      executeAction(action);
      return;
    }

    if (consentAccepted) {
      executeAction(action);
      return;
    }

    setPendingConsentAction(action);
    setShowConsentModal(true);
  };

  const acceptConsent = () => {
    setConsentAccepted(true);
    sessionStorage.setItem('estimateConsentAccepted', 'true');
    setShowConsentModal(false);

    if (pendingConsentAction) {
      executeAction(pendingConsentAction);
      setPendingConsentAction(null);
    }
  };

  const closeConsent = () => {
    setShowConsentModal(false);
    setPendingConsentAction(null);
  };

  const handleUploadPanelSelect = (panels: PanelType[]) => {
    setUploadSelectedPanels(panels);
    setShowUploadPanelSelector(false);
    setShowUploadMultiPanel(true);
  };

  const handleUploadPhotosReady = (files: File[], panels: PanelType[]) => {
    (window as any).__leadUploadFiles = files;
    (window as any).__leadSelectedPanels = panels;
    setHasFiles(files.length > 0);
    setShowUploadMultiPanel(false);
    setUploadSelectedPanels([]);
    if (files.length > 0) navigateToFlow();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []) as File[];
    const imageFiles = droppedFiles.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      requestConsentAndRun({ type: 'process-files', files: imageFiles });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      requestConsentAndRun({ type: 'process-files', files: imageFiles });
    }

    e.target.value = '';
  };

  return (
    <div className="min-h-screen overflow-x-hidden font-sans" style={{ background: '#f4f6fb' }}>

      {/* ── Header ── */}
      <header className="pt-5 sm:pt-7 pb-3" style={{ backgroundColor: '#273548' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center relative">
          <img src={LOGO_URL} alt="Dent-Vision AI" className="h-10 sm:h-12" />
          <a
            href="#/partner/login"
            className="absolute right-4 inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-white/75 hover:text-white transition-colors"
            aria-label="Owner access"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="hidden sm:inline">Restricted owner access</span>
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-7xl mx-auto px-4 py-7 lg:py-8 grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] gap-7 items-center" style={{ backgroundColor: '#eff1f7' }}>

        {/* Left: Copy */}
        <div className="space-y-5">
          <h1 className="text-[42px] font-extrabold text-gray-900 leading-[1.02] tracking-[-0.02em]">
            Your Virtual Quote.<br />
            In <span style={{ color: '#4f46e5' }}>1 Minute.</span>
          </h1>
          <p className="text-[#5f6b7b] text-[15px] leading-relaxed max-w-[280px]">
            Upload your damage photo, get an AI estimate in seconds, and connect with trusted local PDR shops.
          </p>
          <div className="space-y-4 pt-1">
            {[
              {
                icon: (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#eef0fb' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </div>
                ),
                title: 'Local Shops, Quick Offers',
                desc: 'We notify nearby PDR specialists who compete for your job.'
              },
              {
                icon: (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#eef0fb' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="13" r="7" />
                      <path d="M12 9v4l2.5 2" />
                      <path d="M5 6l2-2" />
                      <path d="M7 4h2" />
                    </svg>
                  </div>
                ),
                title: 'Paintless Dent Repair (PDR)',
                desc: 'Minor dents fixed without paint for a faster, affordable repair.'
              },
              {
                icon: (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#eef0fb' }}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l7 3v6c0 5-3.2 7.7-7 9-3.8-1.3-7-4-7-9V6l7-3z" />
                      <path d="M9.3 12.3l1.9 1.9 3.5-3.5" />
                    </svg>
                  </div>
                ),
                title: "You're in Control",
                desc: 'Compare offers, chat, and choose the best option for you.'
              },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="text-base mt-0.5" style={{ color: '#273548' }}>{f.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-[16px] leading-tight">{f.title}</p>
                  <p className="text-[#6c7787] text-[13px] leading-snug mt-1">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: centered square hero image */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-[560px] aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden bg-[#eef1f7]">
            <img src={HERO_DESKTOP_IMAGE_URL} alt="Hero banner" className="hidden lg:block w-full h-full object-contain object-center p-3" />
            <img src={CAR_IMAGE_URL} alt="Car" className="lg:hidden w-full h-full object-contain object-center p-2" />
          </div>
        </div>

        {/* Right: Form card */}
        <div className="bg-white rounded-2xl shadow-[0_18px_40px_rgba(17,24,39,0.12)] border border-gray-100 p-6">
          <h2 className="text-[20px] font-extrabold text-gray-900 text-center mb-1">Start Your Estimate</h2>
          <p className="text-[12px] text-[#6c7787] text-center mb-4 leading-snug">
            Get a virtual quote and let local PDR shops<br />near you review your job.
          </p>

          <p className="text-xs font-semibold text-gray-700 mb-1">Enter your ZIP code</p>
          <p className="text-xs text-gray-400 mb-2">We'll find shops near you.</p>
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">📍</span>
            <input
              type="text"
              value={zip}
              onChange={e => setZip(e.target.value)}
              placeholder="e.g. 90210"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: '#27354855' }}
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => requestConsentAndRun({ type: 'open-file' })}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors mb-3 ${
              dragOver ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-gray-50 hover:border-gray-400'
            }`}
            style={dragOver ? { borderColor: '#273548', backgroundColor: '#f4f6f8' } : {}}
          >
            <div className="flex justify-center mb-2">
              <div className="w-10 h-10 border-2 border-gray-300 rounded-xl bg-white flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700">Upload a photo of the dent</p>
            <p className="text-xs text-gray-400">or drag and drop here</p>
            <p className="text-xs text-gray-300 mt-1">JPG, PNG • Max 10MB</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {isMobile ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => requestConsentAndRun({ type: 'open-camera' })}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-[#4f46e5]/40 bg-[#f8f9ff] hover:bg-[#f0f1ff] transition-colors"
              >
                <svg className="w-6 h-6 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-semibold text-[#4f46e5]">Take Photo</span>
              </button>
              <button
                onClick={() => requestConsentAndRun({ type: 'open-file' })}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-semibold text-gray-600">From Gallery</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-semibold">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          <button
            onClick={() => {
              if (hasFiles) {
                requestConsentAndRun({ type: 'navigate' });
              } else if (isMobile) {
                requestConsentAndRun({ type: 'start-live-scan' });
              } else {
                requestConsentAndRun({ type: 'open-file' });
              }
            }}
            className="w-full py-3 rounded-full font-semibold text-[15px] text-white flex items-center justify-center gap-2 transition-all [animation:softPulse_3s_ease-in-out_infinite]"
            style={{
              background: 'linear-gradient(90deg, #5b5dfd 0%, #b667d4 48%, #f19a48 100%)',
              border: '1px solid rgba(255,255,255,0.35)',
              boxShadow: '0 2px 8px rgba(39,53,72,0.08)',
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
            </svg>
            {hasFiles ? 'Analyze My Photo →' : 'Start AI Estimate'}
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="text-[10px] font-semibold text-center rounded-md py-1" style={{ backgroundColor: '#f5f7fb', color: '#273548' }}>Secure Upload</div>
            <div className="text-[10px] font-semibold text-center rounded-md py-1" style={{ backgroundColor: '#f5f7fb', color: '#273548' }}>No Spam</div>
            <div className="text-[10px] font-semibold text-center rounded-md py-1" style={{ backgroundColor: '#f5f7fb', color: '#273548' }}>Free Estimate</div>
          </div>

          <p className="text-center text-[10px] text-gray-300 mt-2 flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Your information is secure and never shared without your permission.
          </p>
        </div>
      </section>

      <EstimateConsentModal
        open={showConsentModal}
        onAccept={acceptConsent}
        onClose={closeConsent}
      />

      {showLiveScanPermissionModal && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-md rounded-[28px] bg-[#f8fafc] p-6 shadow-2xl">
            <h3 className="text-[40px] leading-none text-center mb-4">📱</h3>
            <h2 className="text-[26px] leading-[1.15] font-extrabold text-[#1f2937] text-center mb-5">
              Allow this app to request access to:
            </h2>
            <div className="space-y-3 text-[#1f2937] text-[19px] font-semibold">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked readOnly className="h-6 w-6 accent-[#23c5de]" />
                <span>Camera</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked readOnly className="h-6 w-6 accent-[#23c5de]" />
                <span>Geographic location</span>
              </div>
            </div>
            <p className="text-center text-[#6b7280] text-[18px] leading-snug mt-6 mb-5">
              The app may not work properly without these permissions.
            </p>
            {liveScanPermissionError ? (
              <p className="text-sm text-red-600 text-center mb-4">{liveScanPermissionError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleAllowLiveScanPermissions}
              disabled={requestingLiveScanPermissions}
              className="w-full rounded-xl py-3.5 text-white text-[30px] leading-none font-bold disabled:opacity-60"
              style={{ backgroundColor: '#23c5de' }}
            >
              {requestingLiveScanPermissions ? 'Checking...' : 'Allow'}
            </button>
          </div>
        </div>
      )}

      {showLiveScanPanelSelector && (
        <LiveScanPanelSelector
          onCancel={closeLiveScanFlow}
          onSelect={(selectedPanels) => {
            setLiveScanSelectedPanels(selectedPanels);
            setLiveScanCurrentPanelIndex(0);
            setLiveScanCapturedFrames([]);
            setShowLiveScanPanelSelector(false);
            setShowLiveScanActivationModal(true);
          }}
        />
      )}

      {showLiveScanActivationModal && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-md rounded-[30px] bg-[#f8fafc] p-7 shadow-2xl text-center">
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <img
                src="https://wtfstakxspbnghalelby.supabase.co/storage/v1/object/public/media/icon%20celular.svg"
                alt="Quick scan icon"
                className="w-16 h-16 object-contain"
              />
            </div>
            <h2 className="text-[36px] leading-[1] font-extrabold text-[#111827] mb-3">Quick Scan Activation</h2>
            <p className="text-[14px] text-[#4b5563] leading-relaxed mb-6">
              The Live Scan will use your camera to quickly assess the damage in 15 seconds. Ensure good lighting and slowly move your camera over the damaged area while holding your phone horizontally.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowLiveScanActivationModal(false);
                setShowLiveScanView(true);
              }}
              className="w-full rounded-[18px] py-3.5 text-white text-[28px] leading-none font-bold mb-3"
              style={{ backgroundColor: '#23c5de' }}
            >
              ⊡ Start Live Scan
            </button>
            <button
              type="button"
              onClick={closeLiveScanFlow}
              className="w-full rounded-[18px] py-3.5 text-[#111827] text-[22px] leading-none font-bold bg-[#e5e7eb]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showLiveScanView && (
        <LiveScanView
          selectedPanels={liveScanSelectedPanels}
          currentPanelIndex={liveScanCurrentPanelIndex}
          onPanelComplete={handleLiveScanPanelComplete}
          onScanComplete={() => {
            setShowLiveScanView(false);
            setLiveScanPermissionError('Live Scan ended due to inactivity. Please restart the scan.');
            setShowLiveScanPanelSelector(true);
          }}
          onCancel={closeLiveScanFlow}
        />
      )}

      {showLiveScanPauseView && (
        <LiveScanPauseView
          frozenFrame={liveScanFrozenFrame}
          currentPanelIndex={liveScanCurrentPanelIndex}
          totalPanels={liveScanSelectedPanels.length}
          nextPanel={liveScanSelectedPanels[liveScanCurrentPanelIndex + 1] ?? null}
          onCancel={closeLiveScanFlow}
          onNextPanel={() => {
            setShowLiveScanPauseView(false);
            setLiveScanCurrentPanelIndex((prev) => prev + 1);
            setShowLiveScanView(true);
          }}
        />
      )}

      {isProcessingLiveScan && (
        <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full">
            <div className="text-3xl mb-2">⚙️</div>
            <p className="text-lg font-bold text-[#111827]">Processing Live Scan</p>
            <p className="text-sm text-[#6b7280] mt-1">Analyzing damage and calculating estimate...</p>
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      <section className="py-14 mt-5" style={{ background: '#dde3f5' }}>
        <div className="text-center mb-10 px-4">
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3" style={{ color: '#4f46e5' }}>HOW IT WORKS</p>
          <h2 className="text-[34px] sm:text-[40px] font-extrabold text-gray-900 leading-tight tracking-[-0.02em] mb-3">
            From Photo to Professional<br />
            Quote in <span style={{ color: '#4f46e5' }}>Under a Minute.</span>
          </h2>
          <p className="text-[#5f6b7b] text-[15px] max-w-lg mx-auto leading-relaxed">
            Our AI analyses damage, calculates costs and delivers accurate estimates in seconds.
          </p>
        </div>

        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* Card 1 – Upload Photos */}
          <div className="bg-white rounded-2xl p-6 shadow-sm relative min-h-[298px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 text-white rounded-full text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#273548' }}>1</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-2">Upload Photos</h3>
            <p className="text-[#5f6b7b] text-[13px] leading-relaxed mb-4">Upload photos or use Live Scan to capture the damaged area from any device.</p>
            <div className="rounded-xl overflow-hidden h-28 bg-gray-100">
              <img src={UPLOAD_CARD_IMAGE_URL} alt="Upload" className="w-full h-full object-cover object-right" />
            </div>
            <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white border border-gray-200 shadow-sm rounded-full items-center justify-center">
              <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>

          {/* Card 2 – AI Analysis */}
          <div className="bg-white rounded-2xl p-6 shadow-sm relative min-h-[298px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 text-white rounded-full text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#273548' }}>2</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-2">AI Analysis</h3>
            <p className="text-[#5f6b7b] text-[13px] leading-relaxed mb-4">Our AI analyses damage, measures panel area and understands the repair needs.</p>
            <div className="rounded-xl overflow-hidden h-28 bg-gray-100 relative">
              <img src={ANALYSIS_CARD_IMAGE_URL} alt="Analysis" className="w-full h-full object-cover" />
            </div>
            <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white border border-gray-200 shadow-sm rounded-full items-center justify-center">
              <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>

          {/* Card 3 – Instant Estimate */}
          <div className="bg-white rounded-2xl p-6 shadow-sm relative min-h-[298px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 text-white rounded-full text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#273548' }}>3</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-2">Instant Estimate</h3>
            <p className="text-[#5f6b7b] text-[13px] leading-relaxed mb-3">Get a professional, detailed estimate in under 60 seconds.</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">$ Estimated Total Cost</p>
              <p className="text-2xl font-extrabold" style={{ background: 'linear-gradient(90deg, #00c9d6 0%, #00e676 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>$450 – $750</p>
              <p className="text-xs text-gray-400 mt-1">1 dent detected</p>
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5 text-xs text-blue-600 font-medium text-center">
                3 repair slots available this week!
              </div>
            </div>
            <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white border border-gray-200 shadow-sm rounded-full items-center justify-center">
              <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>

          {/* Card 4 – Send & Close */}
          <div className="bg-white rounded-2xl p-6 shadow-sm min-h-[298px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 text-white rounded-full text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#273548' }}>4</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-2">Send & Close</h3>
            <p className="text-[#5f6b7b] text-[13px] leading-relaxed mb-4">Your quote request is instantly shared with registered partner shops near you for final confirmation.</p>
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-green-700">Quote Sent to Registered Partners!</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── Video Block ── */}
      <section className="max-w-5xl mx-auto px-4 mt-4 mb-8">
        <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-[#d9e2ff] bg-black shadow-[0_20px_50px_-24px_rgba(39,53,72,0.55)]">
          <video
            src="https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/full%20video%20copy.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover object-center"
          />
        </div>
      </section>

      {/* ── Trust & Network Bar ── */}
      <section className="max-w-7xl mx-auto px-4 mt-4 mb-5">
        <div className="bg-[#f4f6fb] border border-[#e6eaf6] rounded-2xl px-4 py-3 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 5-3.2 7.7-7 9-3.8-1.3-7-4-7-9V6l7-3z" /><path d="M9.3 12.3l1.9 1.9 3.5-3.5" /></svg>
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[#1f2937] leading-tight">Verified Local</p>
                <p className="text-[11px] text-[#6b7280] leading-tight">Repair Shops</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[#1f2937] leading-tight">Secure &amp; Private</p>
                <p className="text-[11px] text-[#6b7280] leading-tight">Your data is safe</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12h8" /><path d="M12 8v8" /><circle cx="12" cy="12" r="9" /></svg>
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[#1f2937] leading-tight">No Obligation</p>
                <p className="text-[11px] text-[#6b7280] leading-tight">You choose to proceed</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" /><path d="M5 19h14" /></svg>
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[#1f2937] leading-tight">AI-Assisted Estimate</p>
                <p className="text-[11px] text-[#6b7280] leading-tight">Final price confirmed by shops</p>
              </div>
            </div>
          </div>

          <a
            href="#/login"
            className="w-full lg:w-auto rounded-xl border border-[#d7ddf3] bg-white px-4 py-3 text-left lg:text-center hover:border-[#c6cff0] transition-colors"
          >
            <p className="text-[12px] font-semibold text-[#1f2937]">Own a PDR shop?</p>
            <p className="text-[12px] font-semibold text-[#4f46e5]">Join our repair network →</p>
          </a>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-4xl mx-auto px-4 mt-8 mb-8">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-[-0.02em]">Frequently Asked Questions</h2>
          <p className="text-[#5f6b7b] text-sm mt-2">Everything you need to know before requesting your estimate</p>
        </div>

        <div className="space-y-3">
          <details className="group bg-white border border-[#dfe5f2] rounded-xl px-5 py-4">
            <summary className="list-none cursor-pointer flex items-center justify-between text-[15px] font-semibold text-gray-900">
              Is Dent-Vision AI a repair workshop?
              <span className="text-[#4f46e5] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <p className="text-[14px] text-[#5f6b7b] leading-relaxed mt-3">
              No. Dent-Vision AI is not a bodyshop or mechanical workshop. We are a lead-connection platform that helps vehicle owners connect with registered local PDR specialists and bodyshops.
            </p>
          </details>

          <details className="group bg-white border border-[#dfe5f2] rounded-xl px-5 py-4">
            <summary className="list-none cursor-pointer flex items-center justify-between text-[15px] font-semibold text-gray-900">
              Is the AI estimate the final repair price?
              <span className="text-[#4f46e5] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <p className="text-[14px] text-[#5f6b7b] leading-relaxed mt-3">
              The AI estimate is a preliminary range based on your photos and partner pricing settings. Final pricing is always confirmed directly by the repair professional after physical inspection.
            </p>
          </details>

          <details className="group bg-white border border-[#dfe5f2] rounded-xl px-5 py-4">
            <summary className="list-none cursor-pointer flex items-center justify-between text-[15px] font-semibold text-gray-900">
              What happens after I submit my request?
              <span className="text-[#4f46e5] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <p className="text-[14px] text-[#5f6b7b] leading-relaxed mt-3">
              Your request is shared with nearby registered partners. Interested shops can review your damage details and contact you with confirmation, availability, and next steps.
            </p>
          </details>

          <details className="group bg-white border border-[#dfe5f2] rounded-xl px-5 py-4">
            <summary className="list-none cursor-pointer flex items-center justify-between text-[15px] font-semibold text-gray-900">
              Do I have to accept any offer?
              <span className="text-[#4f46e5] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <p className="text-[14px] text-[#5f6b7b] leading-relaxed mt-3">
              No. There is no obligation. You can compare partner responses and choose if and when to proceed.
            </p>
          </details>

          <details className="group bg-white border border-[#dfe5f2] rounded-xl px-5 py-4">
            <summary className="list-none cursor-pointer flex items-center justify-between text-[15px] font-semibold text-gray-900">
              Is my data secure?
              <span className="text-[#4f46e5] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <p className="text-[14px] text-[#5f6b7b] leading-relaxed mt-3">
              Yes. Your submission is handled securely and shared only as needed with partner repair shops to process your quote request.
            </p>
          </details>
        </div>
      </section>

      {/* ── Pre-Footer CTA ── */}
      <section className="max-w-4xl mx-auto px-4 mb-6 overflow-hidden">
        <div className="rounded-2xl border border-dashed px-3 py-3 lg:px-4" style={{ borderColor: '#c7d4ff', backgroundColor: '#f8faff' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-3 items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#eef2fb] border border-[#e2e8f7] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v10" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M5 20h14" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-[20px] leading-tight font-extrabold text-[#111827] tracking-[-0.02em] sm:text-[23px] lg:text-[22px]">Experience Dent-Vision AI live</h3>
                <p className="text-[#5f6b7b] text-[14px] leading-snug mt-1 sm:text-[15px] lg:text-[13px]">
                  Upload a photo of any dent and get an AI-powered estimate in seconds. No sign-up required.
                </p>
              </div>
            </div>

            <div className="min-w-0">
              <button
                onClick={() => {
                  if (hasFiles) {
                    requestConsentAndRun({ type: 'navigate' });
                  } else if (isMobile) {
                    requestConsentAndRun({ type: 'start-live-scan' });
                  } else {
                    requestConsentAndRun({ type: 'open-file' });
                  }
                }}
                className="w-full py-2.5 rounded-full font-semibold text-[14px] text-white flex items-center justify-center gap-1.5 transition-all [animation:softPulse_3s_ease-in-out_infinite]"
                style={{
                  background: 'linear-gradient(90deg, #5b5dfd 0%, #b667d4 48%, #f19a48 100%)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  boxShadow: '0 2px 8px rgba(39,53,72,0.08)',
                }}
              >
                <span>✦</span>
                {hasFiles ? 'Analyze My Photo →' : 'Start AI Estimate'}
              </button>
              <div className="mt-2 rounded-full border border-dashed border-[#d6deef] text-center py-1.5 text-[#6b7280] text-[12px]">
                or drag and drop image here
              </div>
              <p className="text-center text-[10px] text-[#9ca3af] mt-1">JPG, PNG • Max 5MB</p>
            </div>
          </div>
        </div>
      </section>

      {/* Upload panel selector modal */}
      {showUploadPanelSelector && (
        <LiveScanPanelSelector
          title="Select Panels"
          subtitle="Which panels are damaged? Select all that apply."
          ctaLabel="Next — Upload Photos →"
          onSelect={handleUploadPanelSelect}
          onCancel={() => setShowUploadPanelSelector(false)}
        />
      )}

      {/* Upload multi-panel photo slots modal */}
      {showUploadMultiPanel && (
        <UploadMultiPanelModal
          panels={uploadSelectedPanels}
          onConfirm={handleUploadPhotosReady}
          onBack={() => { setShowUploadMultiPanel(false); setShowUploadPanelSelector(true); }}
          onCancel={() => { setShowUploadMultiPanel(false); setUploadSelectedPanels([]); }}
        />
      )}

      <FlowLegalFooter className="mb-8" />

      <DarkFooter />

      <style>{`
        @keyframes softPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(39, 53, 72, 0.08); }
          50% { transform: scale(1.016); box-shadow: 0 8px 18px rgba(39, 53, 72, 0.16); }
        }
      `}</style>
    </div>
  );
};

export default LeadsGenerator;

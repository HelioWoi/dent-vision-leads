import React, { useEffect, useRef, useState } from 'react';
import { analyzeDents, identifyPanelsFromImages, verifyIsCarImage } from '../services/geminiServiceAdapter';
import { detectHailDamage } from '../services/hailAnalysisService';
import { LightingType, MaterialType, PanelType, VehicleType } from '../types';
import FlowLegalFooter from './PublicEstimate/FlowLegalFooter';

type LeadStage = 'upload' | 'preparing' | 'result' | 'error';

type LeadResult = {
  damageType: 'hail' | 'paint' | 'pdr';
  dents: number;
  scratches: number;
  estimateMin?: number;
  estimateMax?: number;
};

const LeadFlow: React.FC = () => {
  const [stage, setStage] = useState<LeadStage>('upload');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runLeadAnalysis = async (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) {
      setError('Please upload at least one image.');
      setStage('error');
      return;
    }

    setError(null);
    setResult(null);
    setStage('preparing');

    try {
      const imageFiles = incomingFiles.filter((file) => file.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        throw new Error('Only image files are allowed.');
      }

      const verificationResults = await Promise.all(
        imageFiles.map(async (file) => ({ file, verification: await verifyIsCarImage(file) }))
      );

      const verifiedFiles = verificationResults
        .filter((item) => item.verification.is_car)
        .map((item) => item.file);

      if (verifiedFiles.length === 0) {
        throw new Error('Could not confirm a vehicle image. Please upload a clearer car dent photo.');
      }

      const panelDetection = await identifyPanelsFromImages(verifiedFiles);
      const selectedPanels = panelDetection.panels.length > 0 ? panelDetection.panels : [PanelType.Doors];

      const analysis = await analyzeDents(
        verifiedFiles,
        VehicleType.Sedan,
        MaterialType.Steel,
        LightingType.Daylight,
        selectedPanels,
        'pdr'
      );

      const isHail = detectHailDamage(analysis);
      const hasPaintDamage = analysis.flags.pdr_incompatible && analysis.summary.total_scratches > 0;

      setResult({
        damageType: isHail ? 'hail' : hasPaintDamage ? 'paint' : 'pdr',
        dents: analysis.summary.total_dents,
        scratches: analysis.summary.total_scratches,
        estimateMin: analysis.summary.estimated_total_cost_AUD?.min,
        estimateMax: analysis.summary.estimated_total_cost_AUD?.max,
      });
      setStage('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setStage('error');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []) as File[];
    void runLeadAnalysis(selectedFiles);
  };

  useEffect(() => {
    const preloaded = (window as any).__leadUploadFiles as File[] | undefined;
    if (preloaded && preloaded.length > 0) {
      delete (window as any).__leadUploadFiles;
      void runLeadAnalysis(preloaded);
    }
  }, []);

  if (stage === 'preparing') {
    return (
      <div className="min-h-screen bg-[#e5e7eb] p-6 md:p-10">
        <div className="max-w-5xl mx-auto rounded-3xl border border-[#0f2438] overflow-hidden">
          <div
            className="min-h-[420px] md:min-h-[520px] flex flex-col items-center justify-center gap-5"
            style={{
              backgroundColor: '#070b12',
              backgroundImage:
                'linear-gradient(rgba(0,220,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,220,255,0.06) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          >
            <div className="w-12 h-12 rounded-full border-4 border-cyan-300/30 border-t-cyan-300 animate-spin" />
            <p className="text-cyan-300 text-3xl tracking-[0.08em] font-extrabold">PREPARING FOR ANALYSIS...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef2f8] px-4 py-10">
      <div className="max-w-3xl mx-auto bg-white border border-[#d8e0f3] rounded-3xl p-6 md:p-8">
        <h1 className="text-2xl font-extrabold text-[#111827] text-center mb-2">Lead AI Analysis</h1>
        <p className="text-sm text-[#5f6b7b] text-center mb-6">Independent flow (isolated from partner quote pipeline).</p>

        {(stage === 'upload' || stage === 'error') && (
          <>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#cbd5e1] rounded-2xl p-10 text-center cursor-pointer hover:border-[#94a3b8] transition-colors"
            >
              <p className="font-semibold text-[#1f2937]">Click to upload dent images</p>
              <p className="text-xs text-[#64748b] mt-1">JPG, PNG, WEBP</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
          </>
        )}

        {stage === 'result' && result && (
          <div className="rounded-2xl bg-[#f8faff] border border-[#d8e4ff] p-6 text-center">
            <p className="text-xs tracking-[0.14em] text-[#4f46e5] font-bold mb-2">AI CLASSIFICATION</p>
            <h2 className="text-3xl font-extrabold text-[#111827] uppercase">{result.damageType}</h2>
            <p className="mt-3 text-[#475569]">Dents: {result.dents} • Scratches: {result.scratches}</p>
            {typeof result.estimateMin === 'number' && typeof result.estimateMax === 'number' && (
              <p className="mt-2 text-lg font-bold text-[#0f172a]">Estimate: ${result.estimateMin} - ${result.estimateMax}</p>
            )}
            <button
              type="button"
              onClick={() => setStage('upload')}
              className="mt-6 px-5 py-2 rounded-full bg-[#273548] text-white text-sm font-semibold"
            >
              Analyze Another
            </button>
          </div>
        )}

        <a href="#/leads-generator" className="block text-center mt-6 text-sm text-[#4f46e5] font-semibold">
          Back to Leads Generator
        </a>
      </div>

      <FlowLegalFooter className="pb-2" />
    </div>
  );
};

export default LeadFlow;

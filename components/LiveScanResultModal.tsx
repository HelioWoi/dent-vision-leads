
import React from 'react';
import type { LiveScanResponse } from '../types';
import { XIcon, CheckCircleIcon, GaugeIcon, AiEstimateIcon, PaintBrushIcon } from './Icons';
import { PanelType } from '../types';

type LiveScanResultPayload = Partial<{
  damage_location: string;
  size_category: 'Small' | 'Medium' | 'Large';
  confidence: number;
  needs_paint_repair: boolean;
  damage_type: 'pdr' | 'hail' | 'uncertain';
  dent_count_estimate: number;
  hail_category: 'light' | 'moderate' | 'severe' | 'extreme';
  estimated_cost: { min: number; max: number };
  price_range: { min: number; max: number };
}> & Partial<LiveScanResponse>;

interface LiveScanResultModalProps {
  result: LiveScanResultPayload;
  selectedPanels?: PanelType[];
  onClose: () => void;
  onRequestQuote: () => void;
}

const LiveScanResultModal: React.FC<LiveScanResultModalProps> = ({ result, selectedPanels, onClose, onRequestQuote }) => {
  // Format selected panels for display
  const panelsDisplay = selectedPanels && selectedPanels.length > 0
    ? selectedPanels.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace('_', ' ')).join(', ')
    : result?.damage_location ?? 'N/A';
  
  const panelCount = selectedPanels?.length || 1;
  const price = result?.estimated_cost || result?.price_range;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-result-title"
    >
      <div
        className="bg-light-card rounded-2xl p-8 w-full max-w-md border border-light-border shadow-lg relative animate-scale-in text-center"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-light-text-secondary hover:bg-gray-100 rounded-full p-1 transition-colors"
          aria-label="Close"
        >
          <XIcon className="w-6 h-6" />
        </button>

        <CheckCircleIcon className="w-16 h-16 text-brand-lime mx-auto" />

        <h3 id="scan-result-title" className="text-2xl font-bold text-light-text-primary mt-4">
          Quick Scan Result
        </h3>
        <p className="text-light-text-secondary text-sm mt-1">
          Preliminary estimate based on {panelCount > 1 ? `${panelCount} panels` : 'a 15s scan'}.
        </p>
        
        <div className="mt-6 text-left space-y-4 bg-light-bg p-6 rounded-xl border border-light-border">
          <div>
            <p className="text-sm font-semibold text-gray-500">Damage Location</p>
            <p className="text-lg text-light-text-primary capitalize">
              {panelsDisplay}
              {panelCount > 1 && (
                <span className="text-sm text-gray-500 ml-2">({panelCount} panels selected)</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Damage Type</p>
            <p className="text-lg text-light-text-primary capitalize">
              {result?.damage_type === 'hail' ? '🌨️ Hail Damage' : 
               result?.damage_type === 'pdr' ? 'PDR (Single Dent)' : 
               'Uncertain'}
            </p>
          </div>
          {result?.dent_count_estimate && (
            <div>
              <p className="text-sm font-semibold text-gray-500">Estimated Dents</p>
              <p className="text-lg text-light-text-primary">{result.dent_count_estimate}+ dents detected</p>
            </div>
          )}
          {result?.damage_type === 'hail' && result?.hail_category && (
            <div>
              <p className="text-sm font-semibold text-gray-500">Hail Severity</p>
              <p className="text-lg text-light-text-primary capitalize">{result.hail_category}</p>
            </div>
          )}
          {result?.damage_type === 'pdr' && result?.size_category && (
            <div>
              <p className="text-sm font-semibold text-gray-500">Size Category</p>
              <p className="text-lg text-light-text-primary">{result.size_category}</p>
            </div>
          )}
          {price && (
            <div>
              <p className="text-sm font-semibold text-gray-500">Estimated Range</p>
              <p className="text-lg text-light-text-primary">${price.min} - ${price.max}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-500">Confidence Level</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div
                className="bg-brand-lime h-2.5 rounded-full"
                style={{ width: `${(result?.confidence ?? 0) * 100}%` }}
              ></div>
            </div>
             <p className="text-right text-lg font-bold text-light-text-primary mt-1">{((result?.confidence ?? 0) * 100).toFixed(0)}%</p>
          </div>
        </div>

        {result?.needs_paint_repair && (
          <div className="mt-4 text-xs text-purple-800 border border-purple-200 bg-purple-50 p-3 rounded-lg flex items-start gap-2">
            <PaintBrushIcon className="w-6 h-6 text-purple-600 flex-shrink-0" />
            <span>
              <strong>Paint Repair Detected:</strong> The AI has identified damage that may require paint repair (scratches, chips, or rust). This may affect repair costs and method.
            </span>
          </div>
        )}

        <div className="mt-4 text-xs text-yellow-800 border border-yellow-200 bg-yellow-50 p-3 rounded-lg flex items-start gap-2">
            <GaugeIcon className="w-6 h-6 text-yellow-600 flex-shrink-0" />
            <span>
                <strong>Warning:</strong> This is an economical analysis mode. For a detailed report and precise quote, please use the photo upload option.
            </span>
        </div>
        
        <button
          onClick={onRequestQuote}
          className="relative overflow-hidden w-full mt-8 flex justify-center items-center gap-2 bg-gray-900 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:bg-gray-800 group"
        >
            <span className="relative z-10 flex items-center gap-2">
              <AiEstimateIcon className="w-5 h-5"/> 
              {result?.damage_type === 'hail' || result?.damage_type === 'uncertain' 
                ? 'Get Full Hail Analysis' 
                : 'See Estimate'}
            </span>
            {/* Removed the sliding white span as it's not part of the light theme style */}
        </button>
      </div>
    </div>
  );
};

export default LiveScanResultModal;

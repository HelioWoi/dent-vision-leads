import React, { useState } from 'react';
import { PanelType } from '../types';
import { CheckCircleIcon, SparklesIcon } from './Icons';

interface LiveScanPanelSelectorProps {
  onSelect: (selectedPanels: PanelType[]) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

const PANEL_OPTIONS = [
  { value: PanelType.Bonnet, label: 'Bonnet', sublabel: '' },
  { value: PanelType.Guard, label: 'Guard', sublabel: 'Front and Rear' },
  { value: PanelType.Doors, label: 'Doors', sublabel: 'All doors' },
  { value: PanelType.Roof, label: 'Roof', sublabel: '' },
  { value: PanelType.Boot, label: 'Boot', sublabel: '' },
  { value: PanelType.Bumper, label: 'Bumper', sublabel: 'Front/Rear' },
  { value: PanelType.CantRail, label: 'Cant Rail', sublabel: 'Side rail' },
];

const LiveScanPanelSelector: React.FC<LiveScanPanelSelectorProps> = ({ 
  onSelect, 
  onCancel,
  title = "Live Scan",
  subtitle = "Select the damaged panels to analyze"
}) => {
  const [selectedPanels, setSelectedPanels] = useState<PanelType[]>([]);
  
  const isLiveScan = title === "Live Scan";

  const togglePanel = (panel: PanelType) => {
    // Bumper is not available for Live Scan only
    if (panel === PanelType.Bumper && isLiveScan) {
      return;
    }
    
    setSelectedPanels(prev => 
      prev.includes(panel) 
        ? prev.filter(p => p !== panel)
        : [...prev, panel]
    );
  };
  
  const isBumperSelected = selectedPanels.includes(PanelType.Bumper);

  const handleStartScan = () => {
    if (selectedPanels.length > 0) {
      onSelect(selectedPanels);
    }
  };

  const estimatedTime = selectedPanels.length * 15;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8 animate-scale-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto flex items-center justify-center mb-3">
            <img src="https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/icon/icon%20car.png" alt="Car" className="w-14 h-14 object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{title}</h2>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
        
        {/* Panel Grid - 2 columns */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {PANEL_OPTIONS.map(option => {
            const isSelected = selectedPanels.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => togglePanel(option.value)}
                className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  option.value === PanelType.Bumper
                    ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                    : isSelected 
                      ? 'border-[#62cae9] bg-[#dff6ff] shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected 
                    ? 'border-[#62cae9] bg-[#62cae9]' 
                    : 'border-gray-300'
                }`}>
                  {isSelected && (
                    <CheckCircleIcon className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {option.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Summary - Compact inline style */}
        <div className="flex items-center justify-center gap-2 mb-5 py-2 px-4 bg-gray-50 rounded-xl border border-gray-200">
          {selectedPanels.length > 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 bg-[#23c5de] rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">{selectedPanels.length}</span>
              </div>
              <span className="font-semibold text-gray-900">
                {selectedPanels.length} panel{selectedPanels.length > 1 ? 's' : ''}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">
                {isLiveScan ? `~${estimatedTime}s` : `${selectedPanels.length * 3} photos`}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-500">No panels selected</span>
          )}
        </div>
        
        {/* Bumper unavailable notice - only for Live Scan */}
        {isLiveScan && (
          <div className="flex items-center justify-center gap-2 mb-5 py-2 px-4 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> Bumper repair is not available for Live Scan. Please use Camera or Upload for bumper damage.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-3 text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleStartScan}
            disabled={selectedPanels.length === 0}
            className={`flex-1 px-5 py-3 rounded-2xl font-bold transition-all ${
              selectedPanels.length > 0
                ? 'bg-[#23c5de] text-white hover:bg-[#1eb4cb] shadow-lg'
                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
            }`}
          >
            {isLiveScan ? 'Start Scan' : 'Start Camera'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveScanPanelSelector;

import React from 'react';
import { PanelType } from '../types';

interface LiveScanPauseViewProps {
  frozenFrame: string;
  currentPanelIndex: number;
  totalPanels: number;
  nextPanel: PanelType | null;
  onNextPanel: () => void;
  onCancel: () => void;
}

const LiveScanPauseView: React.FC<LiveScanPauseViewProps> = ({
  frozenFrame,
  currentPanelIndex,
  totalPanels,
  nextPanel,
  onNextPanel,
  onCancel,
}) => {
  const isLastPanel = currentPanelIndex === totalPanels - 1;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center animate-fade-in">
      {/* Frozen Frame Background */}
      <img
        src={frozenFrame}
        alt="Last captured frame"
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      />

      {/* Overlay Content */}
      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Panel {currentPanelIndex + 1} Complete
        </h2>

        {/* Message */}
        {isLastPanel ? (
          <p className="text-gray-600 mb-6">
            All panels scanned successfully! Processing your results...
          </p>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              Ready to scan the next panel
            </p>
            <div className="bg-cyan-50 border-2 border-cyan-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Next Panel:</p>
              <p className="text-lg font-bold text-gray-900">{nextPanel}</p>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Position your camera for <strong>{nextPanel}</strong> and click "Next Panel" when ready
            </p>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors font-bold text-lg"
          >
            Cancel
          </button>
          {!isLastPanel && (
            <button
              onClick={onNextPanel}
              className="flex-1 px-6 py-4 bg-brand-cyan text-white hover:bg-cyan-600 rounded-2xl transition-colors font-bold text-lg shadow-lg"
            >
              Next Panel
            </button>
          )}
        </div>

        {/* Warning */}
        <p className="text-xs text-gray-500 mt-4">
          Canceling will discard all captured frames
        </p>
      </div>
    </div>
  );
};

export default LiveScanPauseView;

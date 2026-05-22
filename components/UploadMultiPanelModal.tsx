import React, { useRef, useState } from 'react';
import { PanelType } from '../types';

const PANEL_META: Record<PanelType, { label: string; sublabel: string }> = {
  [PanelType.Bonnet]:   { label: 'Bonnet',     sublabel: 'Front hood' },
  [PanelType.Guard]:    { label: 'Guard',       sublabel: 'Fender front/rear' },
  [PanelType.Doors]:    { label: 'Doors',       sublabel: 'Side doors' },
  [PanelType.Roof]:     { label: 'Roof',        sublabel: 'Top panel' },
  [PanelType.Boot]:     { label: 'Boot',        sublabel: 'Rear trunk / hatch' },
  [PanelType.Bumper]:   { label: 'Bumper',      sublabel: 'Front / rear' },
  [PanelType.CantRail]: { label: 'Cant Rail',   sublabel: 'Side rail' },
};

interface Props {
  panels: PanelType[];
  onConfirm: (files: File[], panels: PanelType[]) => void;
  onBack: () => void;
  onCancel: () => void;
}

const UploadMultiPanelModal: React.FC<Props> = ({ panels, onConfirm, onBack, onCancel }) => {
  const [photos, setPhotos] = useState<Partial<Record<PanelType, File>>>({});
  const inputRefs = useRef<Partial<Record<PanelType, HTMLInputElement | null>>>({});

  const readyPanels = panels.filter((p) => photos[p]);
  const canAnalyze = readyPanels.length > 0;

  const getPreview = (panel: PanelType) => {
    const f = photos[panel];
    return f ? URL.createObjectURL(f) : null;
  };

  const handleAnalyze = () => {
    const orderedFiles = readyPanels.map((p) => photos[p]!);
    onConfirm(orderedFiles, readyPanels);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">

        {/* Header */}
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-gray-900">Upload Panel Photos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload one photo per panel — tap any slot to select
          </p>
        </div>

        {/* Per-panel slots */}
        <div className={`grid gap-3 mb-5 ${panels.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {panels.map((panel) => {
            const meta = PANEL_META[panel];
            const preview = getPreview(panel);
            const hasPhoto = !!photos[panel];

            return (
              <div key={panel}>
                <input
                  ref={(el) => { inputRefs.current[panel] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPhotos((prev) => ({ ...prev, [panel]: f }));
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => inputRefs.current[panel]?.click()}
                  className={`w-full rounded-2xl border-2 overflow-hidden transition-all text-left ${
                    hasPhoto
                      ? 'border-green-400 shadow-sm'
                      : 'border-dashed border-gray-200 hover:border-[#4f46e5] hover:bg-[#f8f9ff]'
                  }`}
                >
                  {preview ? (
                    <div>
                      <div className="relative">
                        <img
                          src={preview}
                          alt={meta.label}
                          className="w-full h-28 object-cover"
                        />
                        <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-xs font-bold text-gray-900">{meta.label}</p>
                        <p className="text-[10px] text-green-600 font-semibold">Photo ready ✓  Tap to change</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center gap-2 text-center">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700">{meta.label}</p>
                        <p className="text-[10px] text-gray-400">{meta.sublabel}</p>
                      </div>
                      <p className="text-[10px] text-[#4f46e5] font-semibold">Tap to upload</p>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-5 py-2.5 px-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
            readyPanels.length > 0 ? 'bg-green-500' : 'bg-gray-200'
          }`}>
            <span className="text-white font-bold text-xs">{readyPanels.length}</span>
          </div>
          <span className="text-sm text-gray-600">
            {readyPanels.length === 0
              ? 'No photos yet — upload at least one'
              : readyPanels.length === panels.length
              ? '🎉 All panels ready!'
              : `${readyPanels.length} of ${panels.length} photos added`}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold transition-colors text-sm"
          >
            ← Change Panels
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`flex-1 px-4 py-3 rounded-2xl font-bold transition-all text-sm ${
              canAnalyze
                ? 'bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {canAnalyze
              ? `Analyze ${readyPanels.length} Photo${readyPanels.length > 1 ? 's' : ''} →`
              : 'Analyze →'}
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default UploadMultiPanelModal;

import React, { useEffect, useRef, useState } from 'react';
import { PanelType } from '../types';
import {
  PHOTOS_PER_PANEL,
  PHOTO_SLOT_HINTS,
  PanelPhotoGroup,
} from '../utils/panelPhotoUpload';
import { PHOTO_CAPTURE_TIPS } from '../utils/photoCaptureTips';

const PANEL_META: Record<PanelType, { label: string; sublabel: string }> = {
  [PanelType.Bonnet]:   { label: 'Bonnet',     sublabel: 'Front hood' },
  [PanelType.Guard]:    { label: 'Guard',       sublabel: 'Fender front/rear' },
  [PanelType.Doors]:    { label: 'Doors',       sublabel: 'Side doors' },
  [PanelType.Roof]:     { label: 'Roof',        sublabel: 'Top panel' },
  [PanelType.Boot]:     { label: 'Boot',        sublabel: 'Rear trunk / hatch' },
  [PanelType.Bumper]:   { label: 'Bumper',      sublabel: 'Front / rear' },
  [PanelType.CantRail]: { label: 'Cant Rail',   sublabel: 'Side rail' },
};

type PanelSlotPhotos = Partial<Record<PanelType, (File | null)[]>>;

interface Props {
  panels: PanelType[];
  onConfirm: (groups: PanelPhotoGroup[]) => void;
  onBack: () => void;
  onCancel: () => void;
}

const emptySlots = (): (File | null)[] => Array(PHOTOS_PER_PANEL).fill(null);

const SlotPreview: React.FC<{ file: File; alt: string }> = ({ file, alt }) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return <div className="w-full h-20 bg-gray-100" />;
  return <img src={url} alt={alt} className="w-full h-20 object-cover" />;
};

const UploadMultiPanelModal: React.FC<Props> = ({ panels, onConfirm, onBack, onCancel }) => {
  const [photos, setPhotos] = useState<PanelSlotPhotos>(() =>
    Object.fromEntries(panels.map((p) => [p, emptySlots()])) as PanelSlotPhotos,
  );
  const inputRefs = useRef<Partial<Record<string, HTMLInputElement | null>>>({});

  const panelPhotoCount = (panel: PanelType) =>
    (photos[panel] ?? []).filter(Boolean).length;

  const panelsWithPhotos = panels.filter((p) => panelPhotoCount(p) > 0);
  const totalPhotos = panelsWithPhotos.reduce((sum, p) => sum + panelPhotoCount(p), 0);
  const canAnalyze = panelsWithPhotos.length > 0;

  const setSlotPhoto = (panel: PanelType, slotIdx: number, file: File | null) => {
    setPhotos((prev) => {
      const slots = [...(prev[panel] ?? emptySlots())];
      slots[slotIdx] = file;
      return { ...prev, [panel]: slots };
    });
  };

  const handleAnalyze = () => {
    const groups: PanelPhotoGroup[] = panels
      .map((panel) => ({
        panel,
        photos: (photos[panel] ?? []).filter((f): f is File => !!f),
      }))
      .filter((g) => g.photos.length > 0);
    onConfirm(groups);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">

        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-gray-900">Upload Panel Photos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Up to 3 angles per panel — AI picks the clearest photo for analysis
          </p>
        </div>

        <div className="mb-4 rounded-2xl border border-[#dbe4ff] bg-[#f8faff] p-3">
          <p className="text-[11px] font-bold text-[#4f46e5] uppercase tracking-wide mb-2">Tips for small dents</p>
          <ul className="space-y-1">
            {PHOTO_CAPTURE_TIPS.slice(0, 3).map((tip) => (
              <li key={tip} className="text-[11px] text-[#4b5563] leading-snug flex gap-1.5">
                <span className="text-[#4f46e5] flex-shrink-0">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4 mb-5">
          {panels.map((panel) => {
            const meta = PANEL_META[panel];
            const slots = photos[panel] ?? emptySlots();
            const count = panelPhotoCount(panel);

            return (
              <div key={panel} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-3">
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{meta.label}</p>
                    <p className="text-[11px] text-gray-500">{meta.sublabel}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {count > 0 ? `${count}/3 added` : 'Optional slots'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {slots.map((file, slotIdx) => {
                    const inputKey = `${panel}-${slotIdx}`;
                    const slotMeta = PHOTO_SLOT_HINTS[slotIdx];

                    return (
                      <div key={inputKey} className="relative">
                        <input
                          ref={(el) => { inputRefs.current[inputKey] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setSlotPhoto(panel, slotIdx, f);
                            e.target.value = '';
                          }}
                        />
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => inputRefs.current[inputKey]?.click()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') inputRefs.current[inputKey]?.click();
                          }}
                          className={`w-full rounded-xl border-2 overflow-hidden transition-all text-left h-full min-h-[108px] cursor-pointer ${
                            file
                              ? 'border-green-400 bg-white shadow-sm'
                              : 'border-dashed border-gray-200 hover:border-[#4f46e5] hover:bg-[#f8f9ff] bg-white'
                          }`}
                        >
                          {file ? (
                            <div className="relative h-full">
                              <SlotPreview file={file} alt={`${meta.label} ${slotMeta.label}`} />
                              <div className="px-2 py-1.5">
                                <p className="text-[10px] font-bold text-gray-800">{slotMeta.label}</p>
                                <p className="text-[9px] text-green-600 font-semibold">Tap to change</p>
                              </div>
                              <button
                                type="button"
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow hover:bg-red-600 z-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSlotPhoto(panel, slotIdx, null);
                                }}
                                aria-label={`Remove ${slotMeta.label} photo`}
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 flex flex-col items-center justify-center gap-1.5 text-center h-full min-h-[108px]">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-700">{slotMeta.label}</p>
                                <p className="text-[9px] text-gray-400">{slotMeta.hint}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-2 mb-5 py-2.5 px-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
            totalPhotos > 0 ? 'bg-green-500' : 'bg-gray-200'
          }`}>
            <span className="text-white font-bold text-xs">{totalPhotos}</span>
          </div>
          <span className="text-sm text-gray-600">
            {totalPhotos === 0
              ? 'Add at least one photo on any panel'
              : `${totalPhotos} photo${totalPhotos !== 1 ? 's' : ''} across ${panelsWithPhotos.length} panel${panelsWithPhotos.length !== 1 ? 's' : ''} — AI will pick the best angle`}
          </span>
        </div>

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
            {canAnalyze ? 'Continue →' : 'Continue →'}
          </button>
        </div>

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

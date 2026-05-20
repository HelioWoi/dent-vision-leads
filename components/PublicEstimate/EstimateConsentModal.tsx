import React from 'react';

interface EstimateConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onClose: () => void;
}

const EstimateConsentModal: React.FC<EstimateConsentModalProps> = ({ open, onAccept, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-[#c7d2fe] bg-white">
        <div className="relative px-6 pt-6 pb-5 text-white" style={{ background: 'linear-gradient(115deg, #273548 0%, #3f4f67 35%, #4f46e5 100%)' }}>
          <div className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-[#f19a48]/20 blur-2xl" />

          <div className="relative">
            <p className="text-[11px] tracking-[0.24em] uppercase text-white/70 font-bold">Before You Continue</p>
            <h3 className="text-2xl font-extrabold mt-1">AI Estimate Consent</h3>
            <p className="text-sm text-white/85 mt-2 max-w-lg">
              Please review and accept the terms to continue with photo upload and AI estimate.
            </p>
          </div>
        </div>

        <div className="p-6 bg-[#f8f9ff]">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 max-h-[38vh] overflow-auto">
            <p className="text-xs text-[#4b5563] leading-relaxed">
              Dent-Vision AI provides AI-assisted repair estimates based on submitted photos and regional pricing logic.
              Estimates are indicative only and may vary after final inspection by the selected bodyshop.
            </p>
            <ul className="mt-3 text-xs text-[#4b5563] leading-relaxed list-disc pl-5 space-y-1.5">
              <li>Final pricing may increase or decrease after physical inspection.</li>
              <li>Each repair shop operates independently and sets its own pricing and conditions.</li>
              <li>Dent-Vision AI does not guarantee final pricing or workmanship by third-party shops.</li>
            </ul>
            <p className="text-xs text-[#4b5563] leading-relaxed mt-3">
              By continuing, you acknowledge these terms and agree to proceed.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-full border border-[#d1d5db] text-[#374151] font-semibold text-sm hover:bg-white transition-colors"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="w-full py-2.5 rounded-full text-white font-semibold text-sm shadow"
              style={{ background: 'linear-gradient(90deg, #5b5dfd 0%, #b667d4 45%, #f19a48 100%)' }}
            >
              I Accept & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimateConsentModal;

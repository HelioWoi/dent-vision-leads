import React from 'react';

const LOGO_URL =
  'https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/logo%20new%20wht.png';

const STEPS = [
  { id: 1, label: 'Photo Received' },
  { id: 2, label: 'AI Damage Analysis' },
  { id: 3, label: 'Connecting to Shops' },
  { id: 4, label: 'Best Estimate' },
];

interface Props {
  currentStep: 1 | 2 | 3 | 4;
}

const EstimateHeader: React.FC<Props> = ({ currentStep }) => (
  <header style={{ backgroundColor: '#273548' }} className="px-4 py-4 sticky top-0 z-40">
    <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
      <a
        href="#/"
        className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Home
      </a>

      <a href="#/" aria-label="Go to Dent-Vision home" className="text-center">
        <img src={LOGO_URL} alt="Dent-Vision AI" className="h-7 mx-auto" />
      </a>

      <div className="w-[132px] shrink-0" aria-hidden="true" />
    </div>

    <div className="max-w-xl mx-auto mt-4 flex items-center">
      {STEPS.map((step, i) => {
        const done = step.id < currentStep;
        const active = step.id === currentStep;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? 'bg-[#4f46e5] text-white'
                    : active
                    ? 'bg-[#4f46e5] text-white ring-4 ring-[#4f46e5]/25'
                    : 'bg-white/10 text-white/30'
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : active && step.id === 3 ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                ) : active && step.id === 4 ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap leading-none ${
                  active ? 'text-white font-semibold' : done ? 'text-white/60' : 'text-white/25'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1.5 mb-4 transition-all ${done ? 'bg-[#4f46e5]' : 'bg-white/10'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </header>
);

export default EstimateHeader;

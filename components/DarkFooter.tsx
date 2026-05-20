import React, { useState } from 'react';

const FOOTER_LOGO_URL =
  'https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/logo%20new%20wht.png';

type ModalKey = 'howItWorks' | 'aboutUs' | 'privacy' | 'terms' | null;

const MODAL_CONTENT: Record<NonNullable<ModalKey>, { title: string; body: React.ReactNode }> = {
  howItWorks: {
    title: 'How It Works',
    body: (
      <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
        <p>
          <strong className="text-[#111827]">Dent-Vision AI</strong> makes getting a dent repair
          estimate fast, simple, and hassle-free — no calls, no appointments needed.
        </p>
        <ol className="space-y-3 list-none">
          {[
            { n: '1', t: 'Upload Your Photos', d: 'Take 1–4 photos of the dented area in good lighting. Our system accepts any smartphone photo.' },
            { n: '2', t: 'AI Analysis', d: 'Our AI engine analyzes the dent size, depth, location, and panel type to generate a precise repair estimate.' },
            { n: '3', t: 'Get Your Estimate', d: 'Within seconds, you receive a transparent price range based on real quotes from verified local PDR specialists.' },
            { n: '4', t: 'Book a Shop', d: 'Choose the best offer, confirm your booking, and get your dent fixed — no hidden fees, no surprises.' },
          ].map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="w-7 h-7 flex-shrink-0 rounded-full bg-[#4f46e5] text-white text-xs font-bold flex items-center justify-center">
                {s.n}
              </span>
              <div>
                <p className="font-semibold text-[#111827]">{s.t}</p>
                <p className="text-gray-500 text-[13px]">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[12px] text-gray-400 border-t pt-3">
          All estimates are AI-generated and should be confirmed with the repair professional after physical inspection.
        </p>
      </div>
    ),
  },
  aboutUs: {
    title: 'About Us',
    body: (
      <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
        <p>
          <strong className="text-[#111827]">Dent-Vision AI</strong> is a technology platform built
          to bridge the gap between vehicle owners and trusted paintless dent repair (PDR)
          professionals across Australia.
        </p>
        <p>
          We believe getting a car dent fixed shouldn't be stressful. That's why we built an
          AI-powered estimating tool that analyzes your photos instantly and connects you with
          pre-screened local shops — so you always know what to expect before you even step foot in
          a workshop.
        </p>
        <div className="bg-[#f8f9ff] rounded-xl p-4 border border-[#e0e3ff]">
          <p className="font-semibold text-[#4f46e5] mb-1">Our Mission</p>
          <p className="text-[13px] text-gray-600">
            To make dent repair transparent, fair, and accessible for every driver — powered by
            artificial intelligence and backed by certified repair experts.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { v: '24+', l: 'Partner Shops' },
            { v: '88%', l: 'AI Accuracy' },
            { v: '< 60s', l: 'Estimate Time' },
          ].map((s) => (
            <div key={s.l} className="bg-gray-50 rounded-lg p-3">
              <p className="text-lg font-extrabold text-[#4f46e5]">{s.v}</p>
              <p className="text-[11px] text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-gray-400 border-t pt-3">
          Currently in beta — we're growing our network of PDR specialists across Australia.{' '}
          <a href="https://dent-vision.ai/" target="_blank" rel="noreferrer" className="text-[#4f46e5] underline">
            Learn more at dent-vision.ai
          </a>
        </p>
      </div>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: (
      <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
        <p className="text-[12px] text-gray-400">Last updated: May 2026</p>
        {[
          {
            h: 'Information We Collect',
            t: 'We collect your zip/postcode, vehicle photos, and contact details (name, email, phone) submitted during the estimate or lead flow. Photos are used solely for AI dent analysis and are not stored permanently.',
          },
          {
            h: 'How We Use Your Information',
            t: 'Your data is used to generate AI estimates, connect you with local PDR shops, and improve our service. We do not sell your personal data to third parties.',
          },
          {
            h: 'Data Sharing',
            t: 'Your contact details may be shared with the repair shop you choose to book with, so they can confirm your appointment. Shop partners are bound by confidentiality agreements.',
          },
          {
            h: 'Cookies & Analytics',
            t: 'We use standard web analytics to understand how users interact with our platform. No personally identifiable tracking cookies are used without consent.',
          },
          {
            h: 'Your Rights',
            t: 'You may request deletion of your data at any time by contacting us at contact@dent-vision.ai. We comply with applicable Australian privacy laws.',
          },
        ].map((s) => (
          <div key={s.h}>
            <p className="font-semibold text-[#111827] mb-0.5">{s.h}</p>
            <p className="text-gray-500 text-[13px]">{s.t}</p>
          </div>
        ))}
        <p className="text-[12px] text-gray-400 border-t pt-3">
          Questions? Email{' '}
          <a href="mailto:contact@dent-vision.ai" className="text-[#4f46e5] underline">
            contact@dent-vision.ai
          </a>
        </p>
      </div>
    ),
  },
  terms: {
    title: 'Terms of Service',
    body: (
      <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
        <p className="text-[12px] text-gray-400">Last updated: May 2026</p>
        {[
          {
            h: 'Acceptance of Terms',
            t: 'By using Dent-Vision AI, you agree to these Terms of Service. If you do not agree, please do not use our platform.',
          },
          {
            h: 'Nature of Estimates',
            t: 'All estimates generated by Dent-Vision AI are AI-powered approximations based on submitted photos. They are not binding quotes. Final pricing must be confirmed directly with the repair professional after physical inspection.',
          },
          {
            h: 'Lead Connection Service',
            t: 'Dent-Vision AI operates as a lead connection platform. We facilitate introductions between vehicle owners and PDR specialists. We are not a repair shop and do not perform repairs.',
          },
          {
            h: 'User Responsibilities',
            t: 'You agree to provide accurate photos and information. Submitting photos of vehicles you do not own or have authorization to act on behalf of is prohibited.',
          },
          {
            h: 'Limitation of Liability',
            t: 'Dent-Vision AI is not liable for any difference between AI estimates and final repair costs. Repair outcomes and quality are the sole responsibility of the chosen repair professional.',
          },
          {
            h: 'Changes to Terms',
            t: 'We may update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.',
          },
        ].map((s) => (
          <div key={s.h}>
            <p className="font-semibold text-[#111827] mb-0.5">{s.h}</p>
            <p className="text-gray-500 text-[13px]">{s.t}</p>
          </div>
        ))}
        <p className="text-[12px] text-gray-400 border-t pt-3">
          Questions? Email{' '}
          <a href="mailto:contact@dent-vision.ai" className="text-[#4f46e5] underline">
            contact@dent-vision.ai
          </a>
        </p>
      </div>
    ),
  },
};

const DarkFooter: React.FC = () => {
  const [modal, setModal] = useState<ModalKey>(null);
  const open = (k: ModalKey) => setModal(k);
  const close = () => setModal(null);
  const content = modal ? MODAL_CONTENT[modal] : null;

  return (
    <>
      <footer style={{ background: '#1a2535' }} className="py-10 px-4 mt-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <img src={FOOTER_LOGO_URL} alt="Dent-Vision AI" className="h-9 mb-3" />
              <p className="text-[13px] text-gray-400 leading-relaxed max-w-[220px]">
                AI-powered dent estimating. Fast, accurate, and trusted by local repair shops.
              </p>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-3">Product</p>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => open('howItWorks')}
                    className="text-gray-400 text-[13px] hover:text-white transition-colors text-left"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <a
                    href="https://dent-vision.ai/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-400 text-[13px] hover:text-white transition-colors"
                  >
                    For Repair Shops
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => open('aboutUs')}
                    className="text-gray-400 text-[13px] hover:text-white transition-colors text-left"
                  >
                    About Us
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-3">Legal</p>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => open('privacy')}
                    className="text-gray-400 text-[13px] hover:text-white transition-colors text-left"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => open('terms')}
                    className="text-gray-400 text-[13px] hover:text-white transition-colors text-left"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <a
                    href="mailto:contact@dent-vision.ai"
                    className="text-gray-400 text-[13px] hover:text-white transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 mb-6">
            <p className="text-[12px] text-gray-500 leading-relaxed mb-4">
              Dent-Vision AI is currently in beta testing and operates as a lead connection platform
              designed to help vehicle owners connect with nearby PDR (Paintless Dent Repair)
              specialists and bodyshops. AI-powered estimates are generated automatically based on
              submitted photos and shop pricing preferences to help streamline the quoting process.
              Because estimates are virtual and automated, minor variations may occur, and final
              repair pricing must always be confirmed directly with the repair professional after a
              physical inspection. By submitting your request or using this platform, you
              acknowledge and agree to these terms.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[12px] text-gray-400 text-center sm:text-left">
                © 2026 Dent-Vision AI • Connecting Drivers with Local PDR Specialists •{' '}
                <a href="mailto:contact@dent-vision.ai" className="hover:text-white transition-colors">
                  contact@dent-vision.ai
                </a>
              </p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[12px] text-gray-400">Secure &amp; Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal */}
      {modal && content && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={close}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-extrabold text-[#111827] text-base">{content.title}</h2>
              <button
                onClick={close}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto">{content.body}</div>
            <div className="px-6 pb-5">
              <button
                onClick={close}
                className="w-full py-2.5 rounded-xl bg-[#4f46e5] text-white text-sm font-semibold hover:brightness-110 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DarkFooter;

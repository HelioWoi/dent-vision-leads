import React, { useState } from 'react';
import { signInPartner, signUpPartner } from '../../services/partnerPlatformService';

const PartnerLogin: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'signup') {
      const result = await signUpPartner(email.trim(), password, ownerName.trim());
      setLoading(false);
      setError(result.error || 'Account created. Check your email to confirm.');
      return;
    }

    const result = await signInPartner(email.trim(), password);
    if (!result.isAuthenticated) {
      setError(result.error || 'Unable to sign in.');
      setLoading(false);
      return;
    }

    if (!result.isPartner) {
      setError('Your account is authenticated but not enabled as a bodyshop partner yet.');
      setLoading(false);
      return;
    }

    window.location.hash = '#/partner/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#eef2ff] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-[#d4ddff] bg-white p-8 shadow-[0_34px_70px_-40px_rgba(17,24,39,0.9)]">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#4f46e5]">Dent-Vision AI Partner</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#111827]">Bodyshop Dashboard</h1>
          <p className="mt-2 text-sm text-[#64748b]">Respond to leads quickly and win more repairs.</p>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-xl bg-[#eef3ff] p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-lg py-2 transition ${mode === 'login' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#64748b]'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-lg py-2 transition ${mode === 'signup' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#64748b]'}`}
          >
            Create Account
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          {mode === 'signup' ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#475569]">Owner Name</label>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-[#d7dff5] px-3 py-2.5 text-sm outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20"
                placeholder="Liam Baker"
              />
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#475569]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[#d7dff5] px-3 py-2.5 text-sm outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20"
              placeholder="owner@bodyshop.com"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#475569]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[#d7dff5] px-3 py-2.5 text-sm outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="rounded-xl border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-sm text-[#b42318]">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(90deg, #5a4fff 0%, #4f87ff 52%, #fb923c 100%)' }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Enter Partner Dashboard' : 'Create Partner Account'}
          </button>
        </form>

        <a href="#/" className="mt-4 block text-center text-xs font-semibold text-[#4f46e5]">
          Back to customer flow
        </a>
      </div>
    </div>
  );
};

export default PartnerLogin;

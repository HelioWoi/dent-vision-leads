import React, { useState } from 'react';
import { signInAdmin, signOutAdmin } from '../../services/adminPlatformService';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = await signInAdmin(email.trim(), password);

    if (!result.isAuthenticated) {
      setError(result.error || 'Unable to authenticate admin user.');
      setLoading(false);
      return;
    }

    if (!result.isAdmin) {
      await signOutAdmin();
      setError('Your account is authenticated but is not authorized for Admin Mission Control.');
      setLoading(false);
      return;
    }

    window.location.hash = '#/admin/dashboard';
  };

  return (
    <div className="min-h-screen bg-[#e9efff] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-[#cad7ff] bg-white p-8 shadow-[0_35px_65px_-38px_rgba(39,53,72,0.95)]">
        <div className="text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#4f46e5]">Dent-Vision AI</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#111827]">Admin Mission Control</h1>
          <p className="mt-2 text-sm text-[#64748b]">Secure access for Dent-Vision AI operations staff only.</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#475569]">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[#d7dff5] px-3 py-2.5 text-sm outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20"
              placeholder="admin@dentvision.ai"
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

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 font-semibold text-white transition disabled:opacity-60"
            style={{ background: 'linear-gradient(90deg, #4f46e5 0%, #6677f8 50%, #f59e0b 100%)' }}
          >
            {loading ? 'Signing In...' : 'Sign In to Admin'}
          </button>

          <a
            href="#/"
            className="block text-center text-xs font-semibold text-[#4f46e5] hover:text-[#3730a3] transition-colors"
          >
            Back to customer experience
          </a>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

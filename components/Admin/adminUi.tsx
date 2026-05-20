import React from 'react';
import { LeadStatus } from '../../services/adminPlatformService';

export const STATUS_ORDER: LeadStatus[] = [
  'new',
  'ai_analyzed',
  'sent_to_bodyshops',
  'bodyshop_reviewing',
  'quoted',
  'booked',
  'no_response',
  'rejected_by_shops',
  'manual_review',
  'expired',
];

export const statusClassName = (status: LeadStatus) => {
  if (status === 'booked') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'quoted') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (status === 'manual_review') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (status === 'no_response' || status === 'rejected_by_shops' || status === 'expired') {
    return 'bg-rose-100 text-rose-800 border-rose-200';
  }
  return 'bg-slate-100 text-slate-800 border-slate-200';
};

export const levelClassName = (level: 'info' | 'warning' | 'critical') => {
  if (level === 'critical') return 'bg-rose-50 border-rose-200 text-rose-800';
  if (level === 'warning') return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-sky-50 border-sky-200 text-sky-800';
};

export const formatTime = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const capitalizeWords = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export const percent = (value: number) => `${Math.round(value * 100)}%`;

export const StatCard: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-[#d9e2ff] bg-white p-4 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.65)]">
    <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b7280] font-semibold">{label}</p>
    <p className="mt-2 text-2xl font-extrabold text-[#111827]">{value}</p>
    {hint ? <p className="mt-1 text-xs text-[#64748b]">{hint}</p> : null}
  </div>
);

export const PanelCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <section className="rounded-2xl border border-[#d9e2ff] bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.8)]">
    <div className="flex items-center justify-between border-b border-[#ecf1ff] px-5 py-4">
      <h3 className="text-sm font-bold tracking-[0.06em] uppercase text-[#273548]">{title}</h3>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

export type AdminSection =
  | 'dashboard'
  | 'leads'
  | 'bodyshops'
  | 'owners'
  | 'notifications'
  | 'ai-rules'
  | 'pricing-regions'
  | 'manual-reviews'
  | 'analytics'
  | 'settings';

export type ParsedAdminRoute = {
  isAdminPath: boolean;
  isLogin: boolean;
  section: AdminSection;
  leadId?: string;
};

export type NavItem = {
  key: AdminSection;
  label: string;
  icon: string;
  href: string;
};

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '◈', href: '#/admin/dashboard' },
  { key: 'leads', label: 'Live Leads', icon: '◎', href: '#/admin/leads' },
  { key: 'bodyshops', label: 'Bodyshops', icon: '▣', href: '#/admin/bodyshops' },
  { key: 'owners', label: 'Bodyshop Owners', icon: '◍', href: '#/admin/owners' },
  { key: 'notifications', label: 'Notifications', icon: '✦', href: '#/admin/notifications' },
  { key: 'ai-rules', label: 'AI Rules', icon: '◉', href: '#/admin/ai-rules' },
  { key: 'pricing-regions', label: 'Pricing Regions', icon: '▤', href: '#/admin/pricing-regions' },
  { key: 'manual-reviews', label: 'Manual Reviews', icon: '◬', href: '#/admin/manual-reviews' },
  { key: 'analytics', label: 'Analytics', icon: '◔', href: '#/admin/analytics' },
  { key: 'settings', label: 'Settings', icon: '⚙', href: '#/admin/settings' },
];

export const parseAdminRoute = (rawRoute: string): ParsedAdminRoute => {
  const routePath = rawRoute.split('?')[0] || '';
  const cleaned = routePath.startsWith('#/')
    ? routePath.replace(/^#\//, '')
    : routePath.startsWith('/')
      ? routePath.replace(/^\//, '')
      : routePath;

  const segments = cleaned.split('/').filter(Boolean);
  if (segments[0] !== 'admin') {
    return { isAdminPath: false, isLogin: false, section: 'dashboard' };
  }

  if (!segments[1] || segments[1] === 'dashboard') {
    return { isAdminPath: true, isLogin: false, section: 'dashboard' };
  }

  if (segments[1] === 'login') {
    return { isAdminPath: true, isLogin: true, section: 'dashboard' };
  }

  if (segments[1] === 'leads' && segments[2]) {
    return { isAdminPath: true, isLogin: false, section: 'leads', leadId: segments[2] };
  }

  const key = segments[1] as AdminSection;
  if (NAV_ITEMS.some((item) => item.key === key)) {
    return { isAdminPath: true, isLogin: false, section: key };
  }

  return { isAdminPath: true, isLogin: false, section: 'dashboard' };
};

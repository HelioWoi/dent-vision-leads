import React from 'react';
import { PartnerRouteSection } from '../../services/partnerPlatformService';

export type ParsedPartnerRoute = {
  isPartnerPath: boolean;
  isLogin: boolean;
  section: PartnerRouteSection;
};

export type PartnerNavItem = {
  key: PartnerRouteSection;
  label: string;
  badge?: number;
  href: string;
  icon: React.ReactNode;
};

export const parsePartnerRoute = (rawRoute: string): ParsedPartnerRoute => {
  const routePath = rawRoute.split('?')[0] || '';
  const cleaned = routePath.startsWith('#/')
    ? routePath.replace(/^#\//, '')
    : routePath.startsWith('/')
      ? routePath.replace(/^\//, '')
      : routePath;

  const segments = cleaned.split('/').filter(Boolean);
  if (segments[0] !== 'partner') {
    return { isPartnerPath: false, isLogin: false, section: 'dashboard' };
  }

  const next = segments[1] || 'dashboard';
  if (next === 'login') {
    return { isPartnerPath: true, isLogin: true, section: 'dashboard' };
  }

  if (
    next === 'dashboard' ||
    next === 'leads' ||
    next === 'quoted' ||
    next === 'booked' ||
    next === 'performance' ||
    next === 'notifications' ||
    next === 'settings'
  ) {
    return { isPartnerPath: true, isLogin: false, section: next };
  }

  return { isPartnerPath: true, isLogin: false, section: 'dashboard' };
};

export const formatRelativeTime = (iso: string) => {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const formatClock = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const ratioPercent = (value: number) => `${Math.round(value * 100)}%`;

export const getLeadTimeLeft = (deadlineAt: string) => {
  const seconds = Math.max(0, Math.floor((new Date(deadlineAt).getTime() - Date.now()) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return {
    seconds,
    label: `${mm}:${ss}`,
    ratio: Math.min(1, seconds / 60),
  };
};

export const IconWrap: React.FC<{ children: React.ReactNode; tone?: 'purple' | 'blue' | 'green' | 'orange' }> = ({ children, tone = 'blue' }) => {
  const toneStyles: Record<string, string> = {
    purple: 'from-[#5a4fff] to-[#7c5cff]',
    blue: 'from-[#3b82f6] to-[#2563eb]',
    green: 'from-[#10b981] to-[#059669]',
    orange: 'from-[#fb923c] to-[#f97316]',
  };

  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${toneStyles[tone]} text-white shadow-[0_8px_20px_-10px_rgba(59,130,246,0.9)]`}>
      {children}
    </span>
  );
};

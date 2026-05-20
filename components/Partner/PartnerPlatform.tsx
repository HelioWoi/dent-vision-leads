import React, { useEffect, useMemo, useState } from 'react';
import {
  PartnerDataBundle,
  PartnerIdentity,
  PartnerLead,
  getPartnerIdentity,
  loadPartnerDataBundle,
  signOutPartner,
  submitPartnerLeadResponse,
  updatePartnerNotificationSettings,
  updatePartnerOnlineStatus,
} from '../../services/partnerPlatformService';
import PartnerLogin from './PartnerLogin';
import {
  IconWrap,
  PartnerNavItem,
  ParsedPartnerRoute,
  formatClock,
  formatRelativeTime,
  getLeadTimeLeft,
  parsePartnerRoute,
  ratioPercent,
} from './partnerUi';

const PARTNER_LOGO_URL =
  'https://swcwxzgjwgpvmuiwrugs.supabase.co/storage/v1/object/public/media/logo%20new%20wht.png';

type PartnerPlatformProps = {
  route: string;
};

const initialIdentity: PartnerIdentity = {
  isAuthenticated: false,
  isPartner: false,
  source: 'none',
};

const buildNav = (data?: PartnerDataBundle): PartnerNavItem[] => [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '#/partner/dashboard',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    key: 'leads',
    label: 'New Leads',
    badge: data?.metrics.pendingResponse || 0,
    href: '#/partner/leads',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3 6 6 .8-4.5 4.4 1 6.8L12 17l-5.5 3 1-6.8L3 8.8 9 8l3-6z" />
      </svg>
    ),
  },
  {
    key: 'quoted',
    label: 'Quoted',
    badge: data?.respondedLeads.length || 0,
    href: '#/partner/quoted',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16v16H4z" />
        <path d="M8 9h8M8 13h6" />
      </svg>
    ),
  },
  {
    key: 'booked',
    label: 'Booked Jobs',
    badge: data?.bookedJobs.length || 0,
    href: '#/partner/booked',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M8 2v4M16 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    key: 'performance',
    label: 'Performance',
    href: '#/partner/performance',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-6" />
        <path d="M22 20V8" />
      </svg>
    ),
  },
  {
    key: 'notifications',
    label: 'Notifications',
    badge: data?.activity.length || 0,
    href: '#/partner/notifications',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5" />
        <path d="M9 17a3 3 0 006 0" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '#/partner/settings',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.56V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.56-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 012.83-2.83l.06.06a1.7 1.7 0 001.87.34h.01A1.7 1.7 0 0010 3.1V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.56 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.01a1.7 1.7 0 001.56 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.56 1z" />
      </svg>
    ),
  },
];

const getDefaultBundle = (): PartnerDataBundle => ({
  bodyshop: {
    id: 'shop-loading',
    name: 'Bodyshop Partner',
    region: 'Loading region',
    avatarInitials: 'DV',
    online: true,
    acceptingLeads: true,
    supportLabel: 'Contact Support',
    ownerName: 'Owner',
    ownerEmail: 'owner@partner.local',
  },
  metrics: {
    newLeadsToday: 0,
    pendingResponse: 0,
    bookedJobs: 0,
    acceptanceRate: 0,
    avgResponseMinutes: 0,
  },
  leads: [],
  respondedLeads: [],
  bookedJobs: [],
  performance: {
    acceptanceRate: 0,
    leadsReceived: 0,
    quotesSent: 0,
    jobsBooked: 0,
    averageResponseMinutes: 0,
  },
  notificationSettings: {
    pushEnabled: true,
    smsEnabled: true,
    emailEnabled: true,
    soundEnabled: true,
  },
  activity: [],
  quickTip: 'Respond quickly to improve your booking conversion.',
  settings: {
    acceptingLeads: true,
    serviceRadiusKm: 20,
    acceptedRepairTypes: ['Minor Dent'],
    operatingHours: 'Mon-Sat 08:00-18:00',
    regionLabel: 'Loading region',
  },
});

const recomputeBundle = (bundle: PartnerDataBundle): PartnerDataBundle => {
  const leads = [...bundle.leads];
  const responded = leads.filter((lead) => lead.status === 'quoted' || lead.status === 'inspection');
  const booked = leads.filter((lead) => lead.status === 'booked');
  const metrics = {
    newLeadsToday: leads.filter((lead) => lead.status === 'new').length,
    pendingResponse: leads.filter((lead) => lead.status === 'new').length,
    bookedJobs: booked.length,
    acceptanceRate: leads.length ? booked.length / Math.max(1, responded.length + booked.length) : 0,
    avgResponseMinutes: bundle.metrics.avgResponseMinutes || 7,
  };

  return {
    ...bundle,
    metrics,
    leads,
    respondedLeads: responded,
    bookedJobs: booked,
    performance: {
      ...bundle.performance,
      acceptanceRate: metrics.acceptanceRate,
      leadsReceived: leads.length,
      quotesSent: responded.length + booked.length,
      jobsBooked: booked.length,
      averageResponseMinutes: metrics.avgResponseMinutes,
    },
  };
};

const MetricCard: React.FC<{ title: string; value: string; tone: 'purple' | 'orange' | 'blue' | 'green'; hint: string; icon: React.ReactNode }> = ({
  title,
  value,
  tone,
  hint,
  icon,
}) => {
  return (
    <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-24px_rgba(15,23,42,0.65)]">
      <div className="flex items-start justify-between">
        <IconWrap tone={tone}>{icon}</IconWrap>
      </div>
      <p className="mt-3 text-xs font-semibold tracking-[0.06em] uppercase text-[#64748b]">{title}</p>
      <p className="mt-1 text-3xl font-extrabold text-[#111827]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#4f46e5]">{hint}</p>
    </div>
  );
};

const Toggle: React.FC<{ checked: boolean; onChange: (next: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-[#5a4fff]' : 'bg-[#cbd5e1]'}`}
  >
    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
  </button>
);

const PartnerPlatform: React.FC<PartnerPlatformProps> = ({ route }) => {
  const parsedRoute = parsePartnerRoute(route);
  const [identity, setIdentity] = useState<PartnerIdentity>(initialIdentity);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<PartnerDataBundle>(getDefaultBundle());
  const [adjustOpen, setAdjustOpen] = useState<string | null>(null);
  const [quoteDraft, setQuoteDraft] = useState<Record<string, { quote: string; note: string }>>({});
  const [photoPreview, setPhotoPreview] = useState<{ url: string; alt: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [route]);

  useEffect(() => {
    setData((prev) => {
      let changed = false;
      const leads: PartnerLead[] = prev.leads.map((lead) => {
        if (lead.status === 'new' && getLeadTimeLeft(lead.responseDeadlineAt).seconds <= 0) {
          changed = true;
          return {
            ...lead,
            status: 'expired' as const,
            customerRef: 'Hidden after SLA timeout',
            customerContact: undefined,
          };
        }
        return lead;
      });

      if (!changed) return prev;
      return recomputeBundle({ ...prev, leads });
    });
  }, [tick]);

  const refreshIdentity = async () => {
    setIdentityLoading(true);
    const next = await getPartnerIdentity();
    setIdentity(next);
    setIdentityLoading(false);
    return next;
  };

  const refreshData = async (currentIdentity?: PartnerIdentity) => {
    const activeIdentity = currentIdentity || identity;
    if (!activeIdentity.isPartner) return;
    setBusy(true);
    const bundle = await loadPartnerDataBundle(activeIdentity);
    setData(recomputeBundle(bundle));
    setBusy(false);
  };

  useEffect(() => {
    if (!parsedRoute.isPartnerPath) return;
    void refreshIdentity().then((next) => {
      if (next.isPartner && !parsedRoute.isLogin) {
        void refreshData(next);
      }
    });
  }, [parsedRoute.isPartnerPath]);

  useEffect(() => {
    if (!parsedRoute.isPartnerPath || identityLoading) return;

    if (!parsedRoute.isLogin && !identity.isAuthenticated) {
      window.location.hash = '#/partner/login';
      return;
    }

    if (parsedRoute.isLogin && identity.isAuthenticated && identity.isPartner) {
      window.location.hash = '#/partner/dashboard';
    }
  }, [parsedRoute, identityLoading, identity]);

  const navItems = useMemo(() => buildNav(data), [data]);

  const liveLeadQueue = useMemo(
    () =>
      data.leads
        .filter((lead) => lead.status === 'new' || lead.status === 'expired')
        .sort((a, b) => {
          const aExpired = a.status === 'expired' ? 1 : 0;
          const bExpired = b.status === 'expired' ? 1 : 0;
          if (aExpired !== bExpired) return aExpired - bExpired;
          return +new Date(a.responseDeadlineAt) - +new Date(b.responseDeadlineAt);
        }),
    [data.leads, tick]
  );

  const mutateLead = (leadId: string, updater: (lead: PartnerLead) => PartnerLead) => {
    setData((prev) => {
      const next = {
        ...prev,
        leads: prev.leads.map((lead) => (lead.id === leadId ? updater(lead) : lead)),
      };
      return recomputeBundle(next);
    });
  };

  const respondAcceptAI = (lead: PartnerLead) => {
    mutateLead(lead.id, (current) => ({
      ...current,
      status: 'quoted',
      quoteMin: current.aiEstimateMin,
      quoteMax: current.aiEstimateMax,
      respondedAt: new Date().toISOString(),
    }));
    if (data.bodyshop.id) {
      void submitPartnerLeadResponse(data.bodyshop.id, lead.id, 'quoted', lead.aiEstimateMin, lead.aiEstimateMax, 'Accepted AI estimate');
    }
  };

  const respondDecline = (lead: PartnerLead) => {
    mutateLead(lead.id, (current) => ({
      ...current,
      status: 'declined',
      respondedAt: new Date().toISOString(),
    }));
    if (data.bodyshop.id) {
      void submitPartnerLeadResponse(data.bodyshop.id, lead.id, 'declined', undefined, undefined, 'Declined by bodyshop');
    }
  };

  const respondNeedInspection = (lead: PartnerLead) => {
    mutateLead(lead.id, (current) => ({
      ...current,
      status: 'inspection',
      quoteNote: 'In-person inspection required before final quote',
      respondedAt: new Date().toISOString(),
    }));
    if (data.bodyshop.id) {
      void submitPartnerLeadResponse(
        data.bodyshop.id,
        lead.id,
        'inspection',
        undefined,
        undefined,
        'In-person inspection requested by bodyshop'
      );
    }
  };

  const submitAdjustedQuote = (lead: PartnerLead) => {
    const draft = quoteDraft[lead.id];
    const quoteValue = Number(draft?.quote || 0);
    if (!quoteValue) return;

    mutateLead(lead.id, (current) => ({
      ...current,
      status: 'quoted',
      quoteMin: quoteValue,
      quoteMax: quoteValue,
      quoteNote: draft?.note || '',
      respondedAt: new Date().toISOString(),
    }));

    if (data.bodyshop.id) {
      void submitPartnerLeadResponse(data.bodyshop.id, lead.id, 'quoted', quoteValue, quoteValue, draft?.note || '');
    }

    setAdjustOpen(null);
  };

  const setOnlineState = (next: boolean) => {
    setData((prev) => ({
      ...prev,
      bodyshop: {
        ...prev.bodyshop,
        online: next,
        acceptingLeads: next,
      },
      settings: {
        ...prev.settings,
        acceptingLeads: next,
      },
    }));
    if (data.bodyshop.id) void updatePartnerOnlineStatus(data.bodyshop.id, next);
  };

  const setNotificationSetting = (key: keyof PartnerDataBundle['notificationSettings'], value: boolean) => {
    setData((prev) => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        [key]: value,
      },
    }));
  };

  const saveNotificationSettings = () => {
    if (data.bodyshop.id) {
      void updatePartnerNotificationSettings(data.bodyshop.id, data.notificationSettings);
    }
  };

  const sectionHeading = (() => {
    if (parsedRoute.section === 'dashboard') return 'Dashboard';
    if (parsedRoute.section === 'leads') return 'New Leads';
    if (parsedRoute.section === 'quoted') return 'Quoted';
    if (parsedRoute.section === 'booked') return 'Booked Jobs';
    if (parsedRoute.section === 'performance') return 'Performance';
    if (parsedRoute.section === 'notifications') return 'Notifications';
    return 'Settings';
  })();

  const renderLeadCard = (lead: PartnerLead) => {
    const timer = getLeadTimeLeft(lead.responseDeadlineAt);
    const draft = quoteDraft[lead.id] || { quote: String(lead.aiEstimateMax || ''), note: '' };
    const photoSlots = Array.from({ length: 4 }, (_, index) => lead.photoUrls[index] || null);
    const expired = lead.status === 'expired';

    return (
      <article key={lead.id} className="relative rounded-2xl border border-[#e4e9f8] bg-white p-4 shadow-[0_15px_35px_-28px_rgba(15,23,42,0.8)]">
        {expired ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/72">
            <p className="-rotate-12 text-lg font-extrabold tracking-[0.2em] text-[#94a3b8]">EXPIRED LEAD · INFO HIDDEN</p>
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto] lg:items-start">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#dbe4ff] bg-[#f8fbff] p-2">
            {photoSlots.map((photo, slotIndex) => (
              <button
                key={`${lead.id}-photo-slot-${slotIndex}`}
                type="button"
                disabled={!photo}
                onClick={() => photo && setPhotoPreview({ url: photo, alt: `${lead.damageType} photo ${slotIndex + 1}` })}
                className={`relative overflow-hidden rounded-lg border ${photo ? 'border-[#c9d7ff] bg-white cursor-zoom-in' : 'border-dashed border-[#d8e1f7] bg-[#f3f6fd] cursor-not-allowed'} h-20 w-full`}
              >
                {photo ? (
                  <img src={photo} alt={`${lead.damageType} photo ${slotIndex + 1}`} className={`h-full w-full object-cover ${expired ? 'blur-[1.5px] grayscale' : ''}`} />
                ) : (
                  <span className="text-[10px] font-semibold text-[#94a3b8]">Empty slot</span>
                )}
              </button>
            ))}
          </div>

          <div>
            <div className="flex items-center gap-2">
              {lead.isNew ? <span className="rounded-full bg-[#5a4fff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">New</span> : null}
              <p className="text-lg font-extrabold text-[#111827]">{expired ? 'Lead details hidden' : lead.damageType}</p>
            </div>
            <p className="text-sm text-[#475569]">{expired ? 'SLA response window expired' : `${lead.panelLocation} • ${lead.dentCount} Dents`}</p>
            <p className="mt-1 text-xs text-[#64748b]">{expired ? 'Customer and estimate info hidden in dashboard' : `📍 ${lead.distanceMiles.toFixed(1)} mi away`}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">AI Estimate</p>
            <p className="text-2xl font-extrabold text-[#4f46e5]">{expired ? 'Hidden' : `$${lead.aiEstimateMin} - $${lead.aiEstimateMax}`}</p>
          </div>

          <div className="flex flex-row items-center gap-3 lg:flex-col lg:gap-0">
            <div
              className="relative h-20 w-20 rounded-full"
              style={{
                background: `conic-gradient(#fb923c ${Math.round(timer.ratio * 360)}deg, #e2e8f0 0deg)`,
              }}
            >
              <div className="absolute inset-[5px] rounded-full bg-white flex items-center justify-center text-base font-extrabold text-[#111827]">
                {timer.label}
              </div>
            </div>
            <p className="text-[11px] font-semibold text-[#475569] text-left lg:mt-2 lg:text-center">Respond within<br /><span className="text-[#fb923c]">1 minute</span></p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => respondAcceptAI(lead)}
            disabled={expired}
            className="rounded-xl border border-[#bbf7d0] bg-[#ecfdf3] px-3 py-2 text-sm font-semibold text-[#166534]"
          >
            Accept AI Estimate
          </button>
          <button
            type="button"
            onClick={() => setAdjustOpen((current) => (current === lead.id ? null : lead.id))}
            disabled={expired}
            className="rounded-xl border border-[#cad7f0] bg-[#edf2fa] px-3 py-2 text-sm font-semibold text-[#273548]"
          >
            Adjust Price
          </button>
          <button
            type="button"
            onClick={() => respondNeedInspection(lead)}
            disabled={expired}
            className="rounded-xl border border-[#f5c98f] bg-[#fff7ed] px-3 py-2 text-sm font-semibold text-[#9a3412]"
          >
            Need Inspection
          </button>
          <button
            type="button"
            onClick={() => respondDecline(lead)}
            disabled={expired}
            className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-sm font-semibold text-[#be123c]"
          >
            Decline
          </button>
        </div>

        {adjustOpen === lead.id ? (
          <div className="mt-3 rounded-xl border border-[#d8e2ff] bg-[#f8fbff] p-3">
            <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#64748b]">AI Estimate: ${lead.aiEstimateMin} - ${lead.aiEstimateMax}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
              <input
                type="number"
                value={draft.quote}
                onChange={(event) =>
                  setQuoteDraft((prev) => ({
                    ...prev,
                    [lead.id]: {
                      ...(prev[lead.id] || { quote: '', note: '' }),
                      quote: event.target.value,
                    },
                  }))
                }
                className="rounded-lg border border-[#d1dbf8] px-3 py-2 text-sm"
                placeholder="Your quote"
              />
              <input
                value={draft.note}
                onChange={(event) =>
                  setQuoteDraft((prev) => ({
                    ...prev,
                    [lead.id]: {
                      ...(prev[lead.id] || { quote: '', note: '' }),
                      note: event.target.value,
                    },
                  }))
                }
                className="rounded-lg border border-[#d1dbf8] px-3 py-2 text-sm"
                placeholder="Optional note"
              />
              <button
                type="button"
                onClick={() => submitAdjustedQuote(lead)}
                className="rounded-lg bg-[#273548] px-3 py-2 text-sm font-semibold text-white"
              >
                Submit
              </button>
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  const renderDashboard = () => {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="New Leads Today" value={String(data.metrics.newLeadsToday)} hint="+2 from yesterday" tone="purple" icon={<span>✦</span>} />
          <MetricCard title="Pending Response" value={String(data.metrics.pendingResponse)} hint="Respond within 1 min" tone="orange" icon={<span>◷</span>} />
          <MetricCard title="Booked Jobs" value={String(data.metrics.bookedJobs)} hint="+1 from yesterday" tone="blue" icon={<span>☑</span>} />
          <MetricCard title="Acceptance Rate" value={ratioPercent(data.metrics.acceptanceRate)} hint="+8% from last 7 days" tone="green" icon={<span>↗</span>} />
          <MetricCard title="Avg. Response" value={`${data.metrics.avgResponseMinutes} min`} hint="Top 20% of shops" tone="blue" icon={<span>⚡</span>} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4 shadow-[0_18px_35px_-24px_rgba(15,23,42,0.7)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-[#111827]">New Leads</h3>
                <p className="text-xs text-[#64748b]">Respond quickly to win more jobs.</p>
              </div>
              <button type="button" onClick={() => (window.location.hash = '#/partner/leads')} className="text-xs font-semibold text-[#4f46e5]">View all</button>
            </div>
            <div className="space-y-3">{liveLeadQueue.slice(0, 3).map((lead) => renderLeadCard(lead))}</div>
          </section>

          <div className="space-y-4">
            <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4 shadow-[0_18px_35px_-24px_rgba(15,23,42,0.7)]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-[#111827]">Performance Overview</h3>
                <span className="text-xs text-[#64748b]">This Week</span>
              </div>
              <div className="mt-4 flex items-center justify-center">
                <div className="relative h-44 w-44">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#5a4fff ${Math.round(data.performance.acceptanceRate * 360)}deg, #e2e8f0 0deg)`,
                    }}
                  />
                  <div className="absolute inset-[14px] rounded-full bg-white flex flex-col items-center justify-center">
                    <p className="text-3xl font-extrabold text-[#111827]">{ratioPercent(data.performance.acceptanceRate)}</p>
                    <p className="text-xs text-[#64748b]">Acceptance Rate</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span>Leads Received</span><span className="font-semibold">{data.performance.leadsReceived}</span></div>
                <div className="flex justify-between"><span>Quotes Sent</span><span className="font-semibold">{data.performance.quotesSent}</span></div>
                <div className="flex justify-between"><span>Jobs Booked</span><span className="font-semibold">{data.performance.jobsBooked}</span></div>
                <div className="flex justify-between"><span>Response Time</span><span className="font-semibold">{data.performance.averageResponseMinutes} min</span></div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4 shadow-[0_18px_35px_-24px_rgba(15,23,42,0.7)]">
              <h3 className="text-base font-extrabold text-[#111827]">Notification Settings</h3>
              <p className="text-xs text-[#64748b]">Manage how you receive leads</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between"><p className="text-sm">Push Notifications</p><Toggle checked={data.notificationSettings.pushEnabled} onChange={(next) => setNotificationSetting('pushEnabled', next)} /></div>
                <div className="flex items-center justify-between"><p className="text-sm">SMS Notifications</p><Toggle checked={data.notificationSettings.smsEnabled} onChange={(next) => setNotificationSetting('smsEnabled', next)} /></div>
                <div className="flex items-center justify-between"><p className="text-sm">Email Notifications</p><Toggle checked={data.notificationSettings.emailEnabled} onChange={(next) => setNotificationSetting('emailEnabled', next)} /></div>
                <div className="flex items-center justify-between"><p className="text-sm">Sound Alerts</p><Toggle checked={data.notificationSettings.soundEnabled} onChange={(next) => setNotificationSetting('soundEnabled', next)} /></div>
              </div>
              <button type="button" onClick={saveNotificationSettings} className="mt-4 w-full rounded-xl border border-[#d3dcff] bg-[#f4f7ff] py-2 text-sm font-semibold text-[#4f46e5]">Manage Preferences</button>
            </section>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#111827]">Responded Leads</h3>
              <button type="button" onClick={() => (window.location.hash = '#/partner/quoted')} className="text-xs font-semibold text-[#4f46e5]">View all</button>
            </div>
            <div className="space-y-2">
              {data.respondedLeads.slice(0, 3).map((lead) => (
                <div key={lead.id} className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2">
                  <p className="text-sm font-semibold text-[#111827]">{lead.customerRef} · {lead.damageType}</p>
                  <div className="flex items-center justify-between text-xs text-[#64748b]"><span>${lead.quoteMin || lead.aiEstimateMin}</span><span>{formatRelativeTime(lead.respondedAt || lead.createdAt)}</span></div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#111827]">Booked Jobs</h3>
              <button type="button" onClick={() => (window.location.hash = '#/partner/booked')} className="text-xs font-semibold text-[#4f46e5]">View all</button>
            </div>
            <div className="space-y-2">
              {data.bookedJobs.slice(0, 3).map((lead) => (
                <div key={lead.id} className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2">
                  <p className="text-sm font-semibold text-[#111827]">{lead.customerRef} · {lead.damageType}</p>
                  <div className="flex items-center justify-between text-xs text-[#64748b]"><span>${lead.quoteMin || lead.aiEstimateMin}</span><span className="text-[#16a34a]">Booked</span></div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#111827]">Activity Feed</h3>
              <button type="button" onClick={() => (window.location.hash = '#/partner/notifications')} className="text-xs font-semibold text-[#4f46e5]">View all</button>
            </div>
            <div className="space-y-2">
              {data.activity.slice(0, 4).map((activity) => (
                <div key={activity.id} className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2 text-sm">
                  <p className="text-[#111827]">{activity.text}</p>
                  <p className="text-xs text-[#64748b]">{formatRelativeTime(activity.at)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[#d3dcff] bg-gradient-to-r from-[#eef2ff] via-white to-[#fff3e8] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#111827]">🚀 Quick Tip: {data.quickTip}</p>
            <button type="button" onClick={() => (window.location.hash = '#/partner/performance')} className="rounded-xl border border-[#cfd7ff] bg-white px-4 py-2 text-xs font-semibold text-[#4f46e5]">Improve Response Time</button>
          </div>
        </section>
      </div>
    );
  };

  const renderLeadsPage = () => (
    <div className="space-y-4">
      {liveLeadQueue.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-[#64748b]">No new leads right now. Keep your shop online to stay visible in customer searches.</p> : null}
      {liveLeadQueue.map((lead) => renderLeadCard(lead))}
    </div>
  );

  const renderQuotedPage = () => (
    <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
      <h3 className="text-lg font-extrabold text-[#111827]">Quoted Leads</h3>
      <div className="mt-3 space-y-3">
        {data.respondedLeads.map((lead) => (
          <div key={lead.id} className="rounded-xl border border-[#e5eaf8] p-3">
            <p className="font-semibold text-[#111827]">{lead.customerRef} · {lead.damageType}</p>
            <p className="text-sm text-[#64748b]">Quote ${lead.quoteMin || lead.aiEstimateMin} sent {formatRelativeTime(lead.respondedAt || lead.createdAt)}</p>
            <p className="mt-1 text-xs text-[#64748b]">Customer contact is hidden until booking confirmation.</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBookedPage = () => (
    <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
      <h3 className="text-lg font-extrabold text-[#111827]">Booked Jobs</h3>
      <div className="mt-3 space-y-3">
        {data.bookedJobs.map((lead) => (
          <div key={lead.id} className="rounded-xl border border-[#dcfce7] bg-[#f0fdf4] p-3">
            <p className="font-semibold text-[#111827]">{lead.customerRef} · {lead.damageType}</p>
            <p className="text-sm text-[#166534]">Booked value ${lead.quoteMin || lead.aiEstimateMin}</p>
            <p className="text-sm text-[#475569]">Customer contact: {lead.customerContact || 'Available after customer booking'}</p>
            <p className="text-xs text-[#64748b]">Booked at {formatClock(lead.bookedAt || lead.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPerformancePage = () => (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
        <h3 className="text-lg font-extrabold text-[#111827]">Performance Score</h3>
        <div className="mt-4 flex items-center justify-center">
          <div className="relative h-52 w-52">
            <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#5a4fff ${Math.round(data.performance.acceptanceRate * 360)}deg, #e2e8f0 0deg)` }} />
            <div className="absolute inset-[14px] rounded-full bg-white flex flex-col items-center justify-center">
              <p className="text-4xl font-extrabold text-[#111827]">{ratioPercent(data.performance.acceptanceRate)}</p>
              <p className="text-xs text-[#64748b]">Acceptance Rate</p>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
        <h3 className="text-lg font-extrabold text-[#111827]">Operational Insights</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e5eaf8] p-3"><p className="text-xs text-[#64748b]">Leads Received</p><p className="text-2xl font-extrabold text-[#111827]">{data.performance.leadsReceived}</p></div>
          <div className="rounded-xl border border-[#e5eaf8] p-3"><p className="text-xs text-[#64748b]">Quotes Sent</p><p className="text-2xl font-extrabold text-[#111827]">{data.performance.quotesSent}</p></div>
          <div className="rounded-xl border border-[#e5eaf8] p-3"><p className="text-xs text-[#64748b]">Jobs Booked</p><p className="text-2xl font-extrabold text-[#111827]">{data.performance.jobsBooked}</p></div>
          <div className="rounded-xl border border-[#e5eaf8] p-3"><p className="text-xs text-[#64748b]">Avg Response Time</p><p className="text-2xl font-extrabold text-[#111827]">{data.performance.averageResponseMinutes} min</p></div>
        </div>
        <p className="mt-4 rounded-xl border border-[#d3dcff] bg-[#f3f7ff] px-3 py-2 text-sm text-[#475569]">Gamification Tip: Stay under 5 minutes response time to appear higher in lead routing priority.</p>
      </section>
    </div>
  );

  const renderNotificationsPage = () => (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
        <h3 className="text-lg font-extrabold text-[#111827]">Notification Preferences</h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between"><p>Push Notifications</p><Toggle checked={data.notificationSettings.pushEnabled} onChange={(next) => setNotificationSetting('pushEnabled', next)} /></div>
          <div className="flex items-center justify-between"><p>SMS Notifications</p><Toggle checked={data.notificationSettings.smsEnabled} onChange={(next) => setNotificationSetting('smsEnabled', next)} /></div>
          <div className="flex items-center justify-between"><p>Email Notifications</p><Toggle checked={data.notificationSettings.emailEnabled} onChange={(next) => setNotificationSetting('emailEnabled', next)} /></div>
          <div className="flex items-center justify-between"><p>Sound Alerts</p><Toggle checked={data.notificationSettings.soundEnabled} onChange={(next) => setNotificationSetting('soundEnabled', next)} /></div>
        </div>
        <button type="button" onClick={saveNotificationSettings} className="mt-4 w-full rounded-xl bg-[#273548] py-2 text-sm font-semibold text-white">Save Preferences</button>
      </section>
      <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
        <h3 className="text-lg font-extrabold text-[#111827]">Realtime Activity Feed</h3>
        <div className="mt-3 space-y-2">
          {data.activity.map((item) => (
            <div key={item.id} className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2">
              <p className="text-sm text-[#111827]">{item.text}</p>
              <p className="text-xs text-[#64748b]">{formatRelativeTime(item.at)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderSettingsPage = () => (
    <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
      <h3 className="text-lg font-extrabold text-[#111827]">Partner Settings</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[#111827]">Accepting Leads</p>
            <Toggle checked={data.settings.acceptingLeads} onChange={(next) => setOnlineState(next)} />
          </div>
          <p className="mt-2 text-xs text-[#64748b]">When OFF, your shop is hidden from customer lead matching.</p>
        </div>

        <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Service Radius (km)</label>
          <input
            type="number"
            value={data.settings.serviceRadiusKm}
            onChange={(event) =>
              setData((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  serviceRadiusKm: Number(event.target.value || 0),
                },
              }))
            }
            className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Accepted Repair Types</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Minor Dent', 'Hail Damage', 'Crease Dent', 'Panel Dent'].map((type) => {
              const active = data.settings.acceptedRepairTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        acceptedRepairTypes: active
                          ? prev.settings.acceptedRepairTypes.filter((item) => item !== type)
                          : [...prev.settings.acceptedRepairTypes, type],
                      },
                    }))
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-[#5a4fff] bg-[#eef2ff] text-[#4338ca]' : 'border-[#d1d9f0] bg-white text-[#475569]'}`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Operating Hours</label>
          <input
            value={data.settings.operatingHours}
            onChange={(event) =>
              setData((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  operatingHours: event.target.value,
                },
              }))
            }
            className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button type="button" onClick={() => setOnlineState(data.settings.acceptingLeads)} className="mt-4 rounded-xl bg-[#273548] px-4 py-2 text-sm font-semibold text-white">
        Save Partner Settings
      </button>
    </div>
  );

  const renderSection = () => {
    if (parsedRoute.section === 'dashboard') return renderDashboard();
    if (parsedRoute.section === 'leads') return renderLeadsPage();
    if (parsedRoute.section === 'quoted') return renderQuotedPage();
    if (parsedRoute.section === 'booked') return renderBookedPage();
    if (parsedRoute.section === 'performance') return renderPerformancePage();
    if (parsedRoute.section === 'notifications') return renderNotificationsPage();
    return renderSettingsPage();
  };

  if (!parsedRoute.isPartnerPath) return null;
  if (parsedRoute.isLogin) return <PartnerLogin />;

  if (identityLoading) {
    return <div className="min-h-screen bg-[#eef2ff] flex items-center justify-center text-[#273548] font-semibold">Verifying partner access...</div>;
  }

  if (!identity.isAuthenticated) return <PartnerLogin />;

  if (!identity.isPartner) {
    return (
      <div className="min-h-screen bg-[#eef2ff] flex items-center justify-center px-4">
        <div className="max-w-lg rounded-2xl border border-[#f5c2c7] bg-white p-6">
          <h2 className="text-xl font-extrabold text-[#111827]">Partner access not enabled</h2>
          <p className="mt-2 text-sm text-[#475569]">Your account is authenticated but not mapped to a bodyshop owner yet.</p>
          <p className="mt-1 text-xs text-[#64748b]">{identity.error}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await signOutPartner();
                window.location.hash = '#/partner/login';
              }}
              className="rounded-lg bg-[#273548] px-4 py-2 text-sm font-semibold text-white"
            >
              Sign out
            </button>
            <a href="#/" className="rounded-lg border border-[#d7dff5] px-4 py-2 text-sm font-semibold text-[#273548]">
              Back
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f1f4fb]">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#273548] text-white p-4 shadow-[10px_0_40px_-20px_rgba(39,53,72,0.95)] transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-extrabold tracking-tight">Dent-Vision AI <span className="ml-1 rounded bg-[#5a4fff] px-1.5 py-0.5 text-[10px] align-middle">Partner</span></p>
                <p className="text-xs text-[#9fb3d9]">Bodyshop Dashboard</p>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-md border border-white/20 px-2 py-1 text-xs lg:hidden">✕</button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#6c63ff] to-[#4f87ff] font-bold">{data.bodyshop.avatarInitials}</div>
              <p className="mt-3 text-center text-sm font-bold">{data.bodyshop.name}</p>
              <p className="text-center text-xs text-[#9fb3d9]">{data.bodyshop.region}</p>
              <div className="mt-3 flex items-center justify-center gap-2 rounded-full border border-white/15 bg-[#0e2038] px-3 py-1 text-xs">
                <span className={`h-2 w-2 rounded-full ${data.bodyshop.acceptingLeads ? 'bg-emerald-400 pulse-dot' : 'bg-slate-500'}`} />
                {data.bodyshop.acceptingLeads ? 'Accepting Leads' : 'Offline'}
              </div>
            </div>
          </div>

          <nav className="mt-4 space-y-1">
            {navItems.map((item) => {
              const active = parsedRoute.section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => (window.location.hash = item.href)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-white text-[#273548]' : 'text-[#d6dffb] hover:bg-white/10 hover:text-white'}`}
                >
                  <span className="flex items-center gap-2">{item.icon}{item.label}</span>
                  {item.badge ? <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-[#edf2fa] text-[#273548]' : 'bg-white/10 text-white'}`}>{item.badge}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-[#9fb3d9]">Need help?</p>
            <p className="text-xs text-[#c5d2ec]">Our support team is here to help you.</p>
            <button type="button" className="mt-3 w-full rounded-lg border border-white/20 bg-[#233146] py-2 text-xs font-semibold">
              {data.bodyshop.supportLabel}
            </button>
          </div>

          <div className="mt-auto pt-5">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
              <div className="h-8 w-8 rounded-full bg-[#5a4fff] flex items-center justify-center text-xs font-bold">{data.bodyshop.avatarInitials}</div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{data.bodyshop.ownerName}</p>
                <p className="truncate text-[11px] text-[#9fb3d9]">{data.bodyshop.ownerEmail}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOutPartner();
                window.location.hash = '#/partner/login';
              }}
              className="mt-2 w-full rounded-xl border border-white/15 py-2 text-xs font-semibold text-[#dce5f9]"
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="flex-1 lg:ml-72">
          <header className="sticky top-0 z-20 border-b border-[#dce3f6] bg-[#f7f9ff]/95 backdrop-blur px-4 py-3 lg:px-6">
            <div className="-mx-4 mb-3 bg-[#273548] px-4 py-4 lg:hidden">
              <img src={PARTNER_LOGO_URL} alt="Dent-Vision AI" className="mx-auto h-9 w-auto" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen((prev) => !prev)}
                  className="rounded-lg border border-[#d7dff5] bg-white px-2 py-1 text-sm lg:hidden"
                >
                  ☰
                </button>
                <div>
                  <h1 className="text-lg font-extrabold text-[#111827] sm:text-2xl">Good morning, {data.bodyshop.ownerName.split(' ')[0]}! 👋</h1>
                  <p className="text-xs text-[#64748b] sm:text-sm">Here&apos;s what&apos;s happening with your leads today.</p>
                </div>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <button type="button" className="relative rounded-xl border border-[#d7dff5] bg-white px-3 py-2 text-sm">🔔<span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[10px] text-white">{data.activity.length}</span></button>
                <div className="rounded-xl border border-[#d7dff5] bg-white px-3 py-2 text-xs sm:text-sm flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${data.bodyshop.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <span>{data.bodyshop.online ? 'Online' : 'Offline'}</span>
                  <Toggle checked={data.bodyshop.online} onChange={setOnlineState} />
                </div>
              </div>
            </div>
          </header>

          <main className="p-4 lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold tracking-[0.08em] uppercase text-[#475569]">{sectionHeading}</h2>
              <button
                type="button"
                onClick={() => refreshData()}
                className="rounded-lg border border-[#d3dcff] bg-white px-3 py-1.5 text-sm font-semibold text-[#374151]"
              >
                {busy ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {renderSection()}
          </main>
        </div>
      </div>

      {mobileOpen ? <button type="button" aria-label="Close menu overlay" className="fixed inset-0 z-30 bg-[#020617]/40 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      {photoPreview ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b1220]/80 p-4" onClick={() => setPhotoPreview(null)}>
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/20 bg-[#0f172a] p-3" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              className="absolute right-3 top-3 rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white"
            >
              Close
            </button>
            <img src={photoPreview.url} alt={photoPreview.alt} className="max-h-[78vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      ) : null}

      <style>{`
        .pulse-dot {
          animation: pulseDot 1.8s ease-in-out infinite;
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.65; }
        }
      `}</style>
    </div>
  );
};

export default PartnerPlatform;

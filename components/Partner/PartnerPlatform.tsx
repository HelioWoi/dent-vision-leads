import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PartnerDataBundle,
  PartnerIdentity,
  PartnerLead,
  getPartnerIdentity,
  loadPartnerDataBundle,
  signOutPartner,
  submitPartnerLeadResponse,
  deletePartnerLead,
  updatePartnerNotificationSettings,
  updatePartnerOnlineStatus,
  updatePartnerSettings,
} from '../../services/partnerPlatformService';
import { completePartnerJob } from '../../services/commissionService';
import PartnerLogin from './PartnerLogin';
import { PartnerBookingCalendar, PartnerLeadTable, PartnerAssignmentBadge, PartnerJobTaskList, PartnerCommissionReport, PartnerLeadExportBar, PartnerLeadDetailPanel } from './PartnerLeadViews';
import { LEAD_RESPONSE_SLA_MINUTES } from '../../services/leadSla';
import { uploadBodyshopLogo } from '../../services/bodyshopProfileService';
import { registerPartnerPush, isPushSupported } from '../../services/partnerPushService';
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATE, testPartnerWhatsApp } from '../../services/partnerNotificationService';
import { playLeadAlertSound, setPartnerSoundEnabled } from '../../services/notificationSound';
import { PartnerAvailabilityEditor } from './PartnerAvailabilityEditor';
import {
  fetchPartnerAvailability,
  PartnerAvailabilitySlot,
  setPartnerSlotOpen,
} from '../../services/bodyshopAvailabilityService';
import {
  IconWrap,
  PartnerNavItem,
  ParsedPartnerRoute,
  formatClock,
  formatRelativeTime,
  getLeadTimeLeft,
  parsePartnerRoute,
  ratioPercent,
  nextMonthlyInvoiceDate,
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
    key: 'complete',
    label: 'Complete Jobs',
    badge: data?.bookedJobs.length || 0,
    href: '#/partner/complete',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
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
  completedJobs: [],
  commission: {
    pendingJobs: 0,
    pendingValue: 0,
    earnedJobs: 0,
    earnedCommission: 0,
    paidCommission: 0,
    totalDue: 0,
    entries: [],
  },
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
    whatsappEnabled: true,
    whatsappPhone: '',
    whatsappMessageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  },
  activity: [],
  quickTip: 'Respond quickly to improve your booking conversion.',
    settings: {
    businessName: 'Bodyshop Partner',
    logoUrl: undefined,
    address: '',
    phone: '',
    email: '',
    website: '',
    postalCode: '',
    acceptingLeads: true,
    serviceRadiusKm: 35,
    acceptedRepairTypes: ['PDR Dent'],
    operatingHours: 'Mon-Fri 07:30-17:30',
    regionLabel: 'Loading region',
    acceptsPdr: true,
    acceptsPaintRepair: true,
  },
});

const recomputeBundle = (bundle: PartnerDataBundle): PartnerDataBundle => {
  const leads = [...bundle.leads];
  const responded = leads.filter((lead) =>
    lead.status === 'quoted'
    || lead.status === 'inspection'
    || lead.status === 'booked'
    || lead.status === 'completed'
  );
  const booked = leads.filter((lead) => lead.status === 'booked');
  const completed = leads.filter((lead) => lead.status === 'completed');
  const metrics = {
    newLeadsToday: leads.filter((lead) => lead.status === 'new').length,
    pendingResponse: leads.filter((lead) => lead.status === 'new').length,
    bookedJobs: booked.length + completed.length,
    acceptanceRate: leads.length ? (booked.length + completed.length) / Math.max(1, responded.length + booked.length + completed.length) : 0,
    avgResponseMinutes: bundle.metrics.avgResponseMinutes || 7,
  };

  return {
    ...bundle,
    metrics,
    leads,
    respondedLeads: responded,
    bookedJobs: booked,
    completedJobs: completed,
    performance: {
      ...bundle.performance,
      acceptanceRate: metrics.acceptanceRate,
      leadsReceived: leads.length,
      quotesSent: responded.length + booked.length + completed.length,
      jobsBooked: metrics.bookedJobs,
      averageResponseMinutes: metrics.avgResponseMinutes,
    },
  };
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  tone: 'purple' | 'orange' | 'blue' | 'green';
  hint: string;
  icon: React.ReactNode;
  href?: string;
}> = ({
  title,
  value,
  tone,
  hint,
  icon,
  href,
}) => {
  const iconButton = href ? (
    <button
      type="button"
      onClick={() => { window.location.hash = href; }}
      className="rounded-xl transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]"
      aria-label={`Open ${title}`}
    >
      <IconWrap tone={tone}>{icon}</IconWrap>
    </button>
  ) : (
    <IconWrap tone={tone}>{icon}</IconWrap>
  );

  return (
    <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-24px_rgba(15,23,42,0.65)]">
      <div className="flex items-start justify-between">
        {iconButton}
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
  const [quoteDraft, setQuoteDraft] = useState<
    Record<string, { pdr: string; paint: string; note: string }>
  >({});
  const [photoPreview, setPhotoPreview] = useState<{ url: string; alt: string } | null>(null);
  const [selectedTableLeadId, setSelectedTableLeadId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [pushRegistering, setPushRegistering] = useState(false);
  const [whatsappTesting, setWhatsappTesting] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState('');
  const [bookedView, setBookedView] = useState<'calendar' | 'table'>('calendar');
  const [availabilitySlots, setAvailabilitySlots] = useState<PartnerAvailabilitySlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const knownNewLeadIdsRef = useRef<Set<string> | null>(null);

  const maybePlayNewLeadSound = (leads: PartnerLead[], soundEnabled: boolean) => {
    if (!soundEnabled) return;
    const newLeadIds = leads.filter((lead) => lead.status === 'new').map((lead) => lead.id);
    if (!knownNewLeadIdsRef.current) {
      knownNewLeadIdsRef.current = new Set(newLeadIds);
      return;
    }
    const freshIds = newLeadIds.filter((id) => !knownNewLeadIdsRef.current!.has(id));
    knownNewLeadIdsRef.current = new Set(newLeadIds);
    if (freshIds.length) {
      void playLeadAlertSound();
    }
  };

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
            customerName: 'Hidden',
            customerRef: 'Hidden after SLA timeout',
            customerContact: undefined,
            customerEmail: undefined,
            customerPhone: undefined,
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
    maybePlayNewLeadSound(bundle.leads, bundle.notificationSettings.soundEnabled);
    setData(recomputeBundle(bundle));
    setBusy(false);
  };

  const refreshAvailability = async (bodyshopId?: string) => {
    const shopId = bodyshopId || identity.bodyshopId || data.bodyshop.id;
    if (!shopId) return;
    setAvailabilityLoading(true);
    const slots = await fetchPartnerAvailability(shopId);
    setAvailabilitySlots(slots);
    setAvailabilityLoading(false);
  };

  const handleToggleAvailability = async (
    slotDate: string,
    timePeriod: 'morning' | 'afternoon',
    nextOpen: boolean,
  ) => {
    const shopId = identity.bodyshopId || data.bodyshop.id;
    if (!shopId) return;
    setAvailabilitySaving(true);
    await setPartnerSlotOpen(shopId, slotDate, timePeriod, nextOpen);
    await refreshAvailability(shopId);
    setAvailabilitySaving(false);
  };

  useEffect(() => {
    if (!parsedRoute.isPartnerPath) return;
    void refreshIdentity().then((next) => {
      if (next.isPartner && !parsedRoute.isLogin) {
        void refreshData(next);
        void refreshAvailability(next.bodyshopId);
      }
    });
  }, [parsedRoute.isPartnerPath]);

  useEffect(() => {
    if (!identity.isPartner || parsedRoute.isLogin) return;
    const timer = window.setInterval(() => {
      void refreshData();
      if (parsedRoute.section === 'booked' || parsedRoute.section === 'complete' || parsedRoute.section === 'settings') {
        void refreshAvailability();
      }
    }, 25000);
    return () => window.clearInterval(timer);
  }, [identity.isPartner, parsedRoute.isLogin, parsedRoute.section, identity.bodyshopId]);

  useEffect(() => {
    if (!identity.isPartner || parsedRoute.isLogin) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'partner-new-lead-push') return;
      if (!data.notificationSettings.soundEnabled) return;
      void playLeadAlertSound();
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [identity.isPartner, parsedRoute.isLogin, data.notificationSettings.soundEnabled]);

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

  const handleCompleteJob = async (lead: PartnerLead) => {
    if (!data.bodyshop.id || lead.status !== 'booked') return;
    const finalValue = lead.quoteMin ?? lead.aiEstimateMin ?? 0;
    const confirmed = window.confirm(
      `Have you finished ${lead.customerRef}'s repair?\n\nJob value: $${finalValue}\nPlatform fee (10%): $${Math.round(finalValue * 0.1)}\n\nWe'll email your customer to confirm the service was completed.`,
    );
    if (!confirmed) return;

    const result = await completePartnerJob(data.bodyshop.id, lead.id, finalValue);
    if (!result.ok) {
      window.alert(result.error || 'Could not mark job as completed.');
      return;
    }

    const now = new Date().toISOString();
    setData((prev) => {
      const updatedLead: PartnerLead = {
        ...lead,
        status: 'completed',
        completedAt: now,
        commissionAmount: result.commissionAmount,
        commissionStatus: 'earned',
      };
      const nextLeads = prev.leads.map((item) => (item.id === lead.id ? updatedLead : item));
      const nextCommission = {
        ...prev.commission,
        pendingJobs: Math.max(0, prev.commission.pendingJobs - 1),
        pendingValue: Math.max(0, prev.commission.pendingValue - (result.jobValue || finalValue)),
        earnedJobs: prev.commission.earnedJobs + 1,
        earnedCommission: prev.commission.earnedCommission + (result.commissionAmount || Math.round(finalValue * 0.1)),
        totalDue: prev.commission.totalDue + (result.commissionAmount || Math.round(finalValue * 0.1)),
      };
      return recomputeBundle({
        ...prev,
        leads: nextLeads,
        commission: nextCommission,
      });
    });

    if (result.emailSent) {
      window.alert('Done. Your customer will receive a confirmation email shortly.');
    } else if (result.devMode && result.reviewUrl) {
      window.prompt('Job marked complete. Share this link with your customer to confirm the repair:', result.reviewUrl);
    } else {
      window.alert('Job marked complete.');
    }
  };

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

  const handleDeleteLead = async (lead: PartnerLead) => {
    if (!data.bodyshop.id) return;
    const confirmed = window.confirm(`Remove lead ${lead.customerRef} from your panel? This cannot be undone.`);
    if (!confirmed) return;
    const result = await deletePartnerLead(data.bodyshop.id, lead.id);
    if (!result.ok) {
      window.alert(result.error || 'Could not remove lead.');
      return;
    }
    setData((prev) => ({
      ...prev,
      leads: prev.leads.filter((item) => item.id !== lead.id),
      respondedLeads: prev.respondedLeads.filter((item) => item.id !== lead.id),
      bookedJobs: prev.bookedJobs.filter((item) => item.id !== lead.id),
      completedJobs: prev.completedJobs.filter((item) => item.id !== lead.id),
    }));
    if (selectedTableLeadId === lead.id) setSelectedTableLeadId(null);
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
    const pdrValue = Number(draft?.pdr || lead.aiPdrEstimateMax || lead.aiEstimateMax || 0);
    const paintValue = Number(draft?.paint || 0);
    if (!pdrValue && !paintValue) return;
    const totalValue = pdrValue + paintValue;
    const breakdownNote =
      paintValue > 0
        ? `PDR $${pdrValue} + Paint $${paintValue} = $${totalValue}${draft?.note ? ` — ${draft.note}` : ''}`
        : draft?.note || '';

    mutateLead(lead.id, (current) => ({
      ...current,
      status: 'quoted',
      quoteMin: totalValue,
      quoteMax: totalValue,
      quotePdrMin: pdrValue,
      quotePdrMax: pdrValue,
      quotePaintMin: paintValue || undefined,
      quotePaintMax: paintValue || undefined,
      quoteNote: breakdownNote,
      respondedAt: new Date().toISOString(),
    }));

    if (data.bodyshop.id) {
      void submitPartnerLeadResponse(
        data.bodyshop.id,
        lead.id,
        'quoted',
        totalValue,
        totalValue,
        breakdownNote,
        pdrValue,
        paintValue || undefined,
      );
    }

    setAdjustOpen(null);
  };

  const savePartnerSettings = () => {
    if (!data.bodyshop.id) return;
    void updatePartnerSettings(data.bodyshop.id, data.settings);
    void updatePartnerOnlineStatus(data.bodyshop.id, data.settings.acceptingLeads);
    setData((prev) => ({
      ...prev,
      bodyshop: {
        ...prev.bodyshop,
        name: prev.settings.businessName,
        logoUrl: prev.settings.logoUrl,
        phone: prev.settings.phone,
        address: prev.settings.address,
        website: prev.settings.website,
        shopEmail: prev.settings.email,
      },
    }));
  };

  const handleLogoUpload = async (file: File) => {
    if (!data.bodyshop.id) return;
    setLogoUploading(true);
    const result = await uploadBodyshopLogo(data.bodyshop.id, file);
    setLogoUploading(false);
    if (!result.ok || !result.url) {
      window.alert(result.error || 'Could not upload logo.');
      return;
    }
    setData((prev) => ({
      ...prev,
      bodyshop: {
        ...prev.bodyshop,
        name: prev.settings.businessName,
        logoUrl: result.url,
      },
      settings: { ...prev.settings, logoUrl: result.url },
    }));
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
    if (key === 'soundEnabled') {
      setPartnerSoundEnabled(value);
    }
    setData((prev) => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        [key]: value,
      },
    }));
  };

  const saveNotificationSettings = async () => {
    setPartnerSoundEnabled(data.notificationSettings.soundEnabled);
    setNotificationFeedback('');
    if (!data.bodyshop.id) return;
    await updatePartnerNotificationSettings(data.bodyshop.id, data.notificationSettings);
    setNotificationFeedback('Preferences saved.');
  };

  const handleTestSound = () => {
    void playLeadAlertSound();
  };

  const handleTestWhatsApp = async () => {
    if (!data.bodyshop.id) return;
    if (!data.notificationSettings.whatsappPhone.trim()) {
      setNotificationFeedback('Add a WhatsApp number first, then save or test.');
      return;
    }

    setWhatsappTesting(true);
    setNotificationFeedback('');
    await updatePartnerNotificationSettings(data.bodyshop.id, data.notificationSettings);

    const result = await testPartnerWhatsApp({
      bodyshopId: data.bodyshop.id,
      phone: data.notificationSettings.whatsappPhone.trim(),
      messageTemplate: data.notificationSettings.whatsappMessageTemplate,
    });

    setWhatsappTesting(false);

    if (result.ok && result.sent) {
      setNotificationFeedback(
        result.message || `Test sent to ${result.phone || data.notificationSettings.whatsappPhone}. Check WhatsApp.`,
      );
      return;
    }

    const parts = [
      result.error || result.reason || 'WhatsApp test failed.',
      result.hint,
    ].filter(Boolean);
    setNotificationFeedback(parts.join(' '));
  };

  const handleEnablePush = async () => {
    if (!data.bodyshop.id) return;
    setPushRegistering(true);
    setPushMessage('');
    const result = await registerPartnerPush(data.bodyshop.id);
    setPushRegistering(false);
    if (result.ok) {
      setPushMessage('Push alerts enabled on this device.');
      setData((prev) => {
        const nextSettings = { ...prev.notificationSettings, pushEnabled: true };
        void updatePartnerNotificationSettings(prev.bodyshop.id, nextSettings);
        return { ...prev, notificationSettings: nextSettings };
      });
    } else {
      setPushMessage(result.error || 'Could not enable push on this device.');
    }
  };

  const sectionHeading = (() => {
    if (parsedRoute.section === 'dashboard') return 'Dashboard';
    if (parsedRoute.section === 'leads') return 'New Leads';
    if (parsedRoute.section === 'quoted') return 'Quoted';
    if (parsedRoute.section === 'booked') return 'Booked Jobs';
    if (parsedRoute.section === 'complete') return 'Complete Jobs';
    if (parsedRoute.section === 'performance') return 'Performance';
    if (parsedRoute.section === 'notifications') return 'Notifications';
    return 'Settings';
  })();

  const pendingCompletionCount = data.bookedJobs.length;

  const commissionStatementEntries = useMemo(
    () => data.commission.entries.filter((e) => e.status === 'earned' || e.status === 'invoiced' || e.status === 'paid'),
    [data.commission.entries],
  );

  const renderCompleteJobsLink = () => {
    if (!pendingCompletionCount) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-4 py-3 text-sm">
        <p className="text-[#475569]">
          You have <strong className="text-[#111827]">{pendingCompletionCount}</strong> booked repair{pendingCompletionCount === 1 ? '' : 's'} ready to mark complete.
        </p>
        <button
          type="button"
          onClick={() => (window.location.hash = '#/partner/complete')}
          className="rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#273548]"
        >
          Complete Jobs →
        </button>
      </div>
    );
  };

  const renderLeadCard = (lead: PartnerLead) => {
    const timer = getLeadTimeLeft(lead.responseDeadlineAt);
    const draft = quoteDraft[lead.id] || {
      pdr: String(lead.aiPdrEstimateMax || lead.aiEstimateMax || ''),
      paint: '',
      note: '',
    };
    const draftPdr = Number(draft.pdr || 0);
    const draftPaint = Number(draft.paint || 0);
    const draftTotal = draftPdr + draftPaint;
    const photoSlots = Array.from({ length: 4 }, (_, index) => lead.photoUrls[index] || null);
    const expired = lead.status === 'expired';

    return (
      <article key={lead.id} className="relative rounded-2xl border border-[#e4e9f8] bg-white p-4 shadow-[0_15px_35px_-28px_rgba(15,23,42,0.8)]">
        {expired ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/72">
            <p className="-rotate-12 text-lg font-extrabold tracking-[0.2em] text-[#94a3b8]">EXPIRED LEAD · INFO HIDDEN</p>
          </div>
        ) : null}
        <PartnerAssignmentBadge lead={lead} shopName={data.bodyshop.name} />
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
            <div className="flex flex-wrap items-center gap-2">
              {lead.isNew ? <span className="rounded-full bg-[#5a4fff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">New</span> : null}
              {lead.paintRepairNeeded ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800">
                  Paint repair
                </span>
              ) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-800">
                  PDR only
                </span>
              )}
              <p className="text-lg font-extrabold text-[#111827]">{expired ? 'Lead details hidden' : lead.damageType}</p>
            </div>
            <p className="text-sm text-[#475569]">{expired ? 'SLA response window expired' : `${lead.panelLocation} · ${lead.dentCount} dent${lead.dentCount !== 1 ? 's' : ''}`}</p>
            <p className="mt-1 text-xs text-[#64748b]">{expired ? 'Customer and estimate info hidden in dashboard' : `${lead.distanceMiles.toFixed(1)} km away`}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
              {lead.paintRepairNeeded ? 'AI estimate · PDR (dent removal)' : 'AI estimate · PDR'}
            </p>
            <p className="text-2xl font-extrabold text-[#4f46e5]">
              {expired ? 'Hidden' : `$${lead.aiPdrEstimateMin ?? lead.aiEstimateMin} - $${lead.aiPdrEstimateMax ?? lead.aiEstimateMax}`}
            </p>
            {lead.paintRepairNeeded && !expired ? (
              <p className="mt-1 text-xs font-medium text-amber-800">
                Chipped paint detected — quote PDR and paint separately below.
              </p>
            ) : null}
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
            <p className="text-[11px] font-semibold text-[#475569] text-left lg:mt-2 lg:text-center">Respond within<br /><span className="text-[#fb923c]">{LEAD_RESPONSE_SLA_MINUTES} minutes</span></p>
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
          <button
            type="button"
            onClick={() => void handleDeleteLead(lead)}
            className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-semibold text-[#64748b] sm:col-span-2 xl:col-span-4"
          >
            Remove from panel
          </button>
        </div>

        {adjustOpen === lead.id ? (
          <div className="mt-3 rounded-xl border border-[#d8e2ff] bg-[#f8fbff] p-3">
            <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#64748b]">
              AI PDR (amassado): ${lead.aiPdrEstimateMin ?? lead.aiEstimateMin} - ${lead.aiPdrEstimateMax ?? lead.aiEstimateMax}
            </p>
            {lead.paintRepairNeeded ? (
              <p className="mt-1 text-xs text-amber-800">Pintura lascada — informe PDR e pintura separados.</p>
            ) : null}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#475569]">
                PDR / amassado ($)
                <input
                  type="number"
                  value={draft.pdr}
                  onChange={(event) =>
                    setQuoteDraft((prev) => ({
                      ...prev,
                      [lead.id]: { ...(prev[lead.id] || { pdr: '', paint: '', note: '' }), pdr: event.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#d1dbf8] px-3 py-2 text-sm"
                  placeholder="PDR quote"
                />
              </label>
              <label className="text-xs font-semibold text-[#475569]">
                Pintura ($) — opcional
                <input
                  type="number"
                  value={draft.paint}
                  onChange={(event) =>
                    setQuoteDraft((prev) => ({
                      ...prev,
                      [lead.id]: { ...(prev[lead.id] || { pdr: '', paint: '', note: '' }), paint: event.target.value },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#d1dbf8] px-3 py-2 text-sm"
                  placeholder="0 if PDR only"
                />
              </label>
            </div>
            {(draftPdr > 0 || draftPaint > 0) && (
              <p className="mt-2 text-sm font-bold text-[#111827]">
                Total: ${draftTotal}
                {draftPaint > 0 ? (
                  <span className="ml-2 text-xs font-semibold text-[#64748b]">
                    (PDR ${draftPdr} + Paint ${draftPaint})
                  </span>
                ) : null}
              </p>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={draft.note}
                onChange={(event) =>
                  setQuoteDraft((prev) => ({
                    ...prev,
                    [lead.id]: {
                      ...(prev[lead.id] || { pdr: '', paint: '', note: '' }),
                      note: event.target.value,
                    },
                  }))
                }
                className="rounded-lg border border-[#d1dbf8] px-3 py-2 text-sm"
                placeholder="Optional note to customer"
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
        {renderCompleteJobsLink()}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard href="#/partner/leads" title="New Leads Today" value={String(data.metrics.newLeadsToday)} hint="Live queue" tone="purple" icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 6 6 .8-4.5 4.4 1 6.8L12 17l-5.5 3 1-6.8L3 8.8 9 8l3-6z"/></svg>} />
          <MetricCard href="#/partner/leads" title="Pending Response" value={String(data.metrics.pendingResponse)} hint={`Respond within ${LEAD_RESPONSE_SLA_MINUTES} min`} tone="orange" icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>} />
          <MetricCard href="#/partner/booked" title="Booked Jobs" value={String(data.bookedJobs.length)} hint="Scheduled repairs" tone="blue" icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>} />
          <MetricCard href="#/partner/performance" title="Acceptance Rate" value={ratioPercent(data.metrics.acceptanceRate)} hint="Quotes to bookings" tone="green" icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-6M22 20V8"/></svg>} />
          <MetricCard href="#/partner/performance" title="Avg. Response" value={`${data.metrics.avgResponseMinutes} min`} hint={`Target under ${LEAD_RESPONSE_SLA_MINUTES} min`} tone="blue" icon={<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>} />
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
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleTestWhatsApp()}
                  disabled={whatsappTesting}
                  className="rounded-xl border-2 border-[#25D366] bg-[#dcfce7] py-2 text-sm font-extrabold text-[#166534] disabled:opacity-60"
                >
                  {whatsappTesting ? 'Sending…' : 'Test WhatsApp'}
                </button>
                <button
                  type="button"
                  onClick={() => (window.location.hash = '#/partner/notifications')}
                  className="rounded-xl border border-[#d3dcff] bg-[#f4f7ff] py-2 text-sm font-semibold text-[#4f46e5]"
                >
                  All settings
                </button>
              </div>
              {notificationFeedback && parsedRoute.section === 'dashboard' && (
                <p className="mt-2 text-xs text-[#15803d]">{notificationFeedback}</p>
              )}
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
                  <div className="flex items-center justify-between text-xs text-[#64748b]">
                    <span>
                      {lead.quotePaintMin
                        ? `PDR $${lead.quotePdrMin ?? lead.quoteMin} + Paint $${lead.quotePaintMin}`
                        : `$${lead.quoteMin || lead.aiEstimateMin}`}
                    </span>
                    <span>{formatRelativeTime(lead.respondedAt || lead.createdAt)}</span>
                  </div>
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
              {data.bookedJobs.length ? data.bookedJobs.slice(0, 3).map((lead) => (
                <div key={lead.id} className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] px-3 py-2">
                  <p className="text-sm font-semibold text-[#111827]">{lead.customerRef} · {lead.damageType}</p>
                  <div className="flex items-center justify-between text-xs text-[#64748b]">
                    <span>${lead.quoteMin || lead.aiEstimateMin}{lead.preferredDate ? ` · ${lead.preferredDate}` : ''}</span>
                    <span className="text-[#16a34a]">Booked</span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-[#64748b]">No scheduled jobs yet.</p>
              )}
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
            <p className="text-sm font-semibold text-[#111827]">{data.quickTip}</p>
            <button type="button" onClick={() => (window.location.hash = '#/partner/performance')} className="rounded-xl border border-[#cfd7ff] bg-white px-4 py-2 text-xs font-semibold text-[#4f46e5]">Improve Response Time</button>
          </div>
        </section>
      </div>
    );
  };

  const renderLeadsPage = () => (
    <div className="space-y-4">
      <PartnerLeadTable
        leads={data.leads}
        mode="leads"
        shopName={data.bodyshop.name}
        enableExport
        selectedLeadId={selectedTableLeadId}
        onSelectLead={(lead) => setSelectedTableLeadId((current) => (current === lead.id ? null : lead.id))}
        onPreview={(url, alt) => setPhotoPreview({ url, alt })}
        onDeleteLead={handleDeleteLead}
      />
      {liveLeadQueue.length > 0 ? (
        <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
          <h3 className="mb-3 text-lg font-extrabold text-[#111827]">Respond to new leads</h3>
          <div className="space-y-3">{liveLeadQueue.map((lead) => renderLeadCard(lead))}</div>
        </section>
      ) : (
        <p className="rounded-xl bg-white p-4 text-sm text-[#64748b]">No new leads waiting for response.</p>
      )}
    </div>
  );

  const renderQuotedPage = () => (
    <div className="space-y-4">
      {renderCompleteJobsLink()}
      <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
        <h3 className="text-lg font-extrabold text-[#111827]">Quoted leads</h3>
        <p className="mt-1 text-sm text-[#64748b]">Review damage photos and request history before your customer books.</p>
      </div>
      <PartnerLeadTable
        leads={data.respondedLeads}
        mode="quoted"
        shopName={data.bodyshop.name}
        enableExport
        selectedLeadId={selectedTableLeadId}
        onSelectLead={(lead) => setSelectedTableLeadId((current) => (current === lead.id ? null : lead.id))}
        onPreview={(url, alt) => setPhotoPreview({ url, alt })}
        onDeleteLead={handleDeleteLead}
      />
    </div>
  );

  const renderBookedPage = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e4e9f8] bg-white p-4">
        <div>
          <h3 className="text-lg font-extrabold text-[#111827]">Booked jobs</h3>
          <p className="text-sm text-[#64748b]">Your scheduled repairs — calendar and customer contact details.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingCompletionCount ? (
            <button
              type="button"
              onClick={() => (window.location.hash = '#/partner/complete')}
              className="rounded-lg border border-[#111827] px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-[#f8fafc]"
            >
              Finished a repair? Complete Jobs →
            </button>
          ) : null}
          <div className="flex rounded-xl border border-[#d7dff5] p-1">
            <button
              type="button"
              onClick={() => setBookedView('calendar')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${bookedView === 'calendar' ? 'bg-[#273548] text-white' : 'text-[#475569]'}`}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setBookedView('table')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${bookedView === 'table' ? 'bg-[#273548] text-white' : 'text-[#475569]'}`}
            >
              Table
            </button>
          </div>
        </div>
      </div>
      {bookedView === 'calendar' ? (
        <>
          <PartnerBookingCalendar
            leads={data.bookedJobs}
            selectedLeadId={selectedTableLeadId}
            onSelectLead={(lead) => setSelectedTableLeadId((current) => (current === lead.id ? null : lead.id))}
            onPreview={(url, alt) => setPhotoPreview({ url, alt })}
          />
          {selectedTableLeadId && data.bookedJobs.some((l) => l.id === selectedTableLeadId) ? (
            <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
              <PartnerLeadDetailPanel
                lead={data.bookedJobs.find((l) => l.id === selectedTableLeadId)!}
                onPreview={(url, alt) => setPhotoPreview({ url, alt })}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {bookedView === 'table' ? (
        <PartnerLeadTable
          leads={data.bookedJobs}
          mode="booked"
          shopName={data.bodyshop.name}
          enableExport
          selectedLeadId={selectedTableLeadId}
          onSelectLead={(lead) => setSelectedTableLeadId((current) => (current === lead.id ? null : lead.id))}
          onPreview={(url, alt) => setPhotoPreview({ url, alt })}
          onDeleteLead={handleDeleteLead}
        />
      ) : null}
      {!data.bookedJobs.length ? (
        <p className="rounded-2xl border border-[#e4e9f8] bg-white p-8 text-center text-sm text-[#64748b]">
          No booked jobs yet. When a customer accepts your quote, the job appears here.
        </p>
      ) : null}
    </div>
  );

  const renderCompletePage = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e4e9f8] bg-white p-5">
        <h3 className="text-lg font-extrabold text-[#111827]">When you've finished the repair</h3>
        <p className="mt-1 max-w-2xl text-sm text-[#64748b]">
          Mark each job complete after the work is done. We'll email your customer to confirm the service — that keeps your shop in good standing and adds the job to your monthly platform fee statement.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-[#111827]">Your open tasks</h3>
            <p className="text-xs text-[#64748b]">{pendingCompletionCount} repair{pendingCompletionCount === 1 ? '' : 's'} waiting for completion</p>
          </div>
        </div>
        <PartnerJobTaskList
          leads={data.bookedJobs}
          onComplete={handleCompleteJob}
          onPreview={(url, alt) => setPhotoPreview({ url, alt })}
          selectedLeadId={selectedTableLeadId}
          onSelectLead={(lead) => setSelectedTableLeadId((current) => (current === lead.id ? null : lead.id))}
          emptyMessage="No repairs to complete. Booked jobs appear here after your customer schedules."
        />
        {selectedTableLeadId && data.bookedJobs.some((l) => l.id === selectedTableLeadId) ? (
          <div className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
            <PartnerLeadDetailPanel
              lead={data.bookedJobs.find((l) => l.id === selectedTableLeadId)!}
              onPreview={(url, alt) => setPhotoPreview({ url, alt })}
            />
          </div>
        ) : null}
        {data.bookedJobs.length ? (
          <PartnerLeadExportBar leads={data.bookedJobs} shopName={data.bodyshop.name} label="Export open tasks" />
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-extrabold text-[#111827]">Completed jobs & platform fees</h3>
          <p className="text-xs text-[#64748b]">Your 10% platform fee is invoiced monthly — not charged to your customer.</p>
        </div>
        <PartnerCommissionReport
          completedJobs={data.completedJobs}
          commissionEntries={commissionStatementEntries}
          totalDue={data.commission.totalDue}
          paidTotal={data.commission.paidCommission}
          nextInvoiceDate={nextMonthlyInvoiceDate()}
        />
        {data.completedJobs.length ? (
          <PartnerLeadTable
            leads={data.completedJobs}
            mode="booked"
            shopName={data.bodyshop.name}
            enableExport
            selectedLeadId={selectedTableLeadId}
            onSelectLead={(lead) => setSelectedTableLeadId((current) => (current === lead.id ? null : lead.id))}
            onPreview={(url, alt) => setPhotoPreview({ url, alt })}
            showCommission
          />
        ) : null}
      </section>
    </div>
  );

  const renderPerformancePage = () => (
    <div className="grid gap-4 lg:grid-cols-2">
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
        <p className="mt-4 rounded-xl border border-[#d3dcff] bg-[#f3f7ff] px-3 py-2 text-sm text-[#475569]">Tip: Respond within {LEAD_RESPONSE_SLA_MINUTES} minutes to rank higher for new leads in your area.</p>
      </section>
    </div>
  );

  const renderNotificationsPage = () => (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
        <h3 className="text-lg font-extrabold text-[#111827]">Notification Preferences</h3>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleTestWhatsApp()}
            disabled={whatsappTesting}
            className="rounded-xl border-2 border-[#25D366] bg-[#dcfce7] py-3 text-sm font-extrabold text-[#166534] disabled:opacity-60"
          >
            {whatsappTesting ? 'Sending…' : 'Test WhatsApp'}
          </button>
          <button
            type="button"
            onClick={handleTestSound}
            className="rounded-xl border border-[#cfd9ff] bg-[#eef2ff] py-3 text-sm font-extrabold text-[#4338ca]"
          >
            Test sound
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between"><p>WhatsApp alerts</p><Toggle checked={data.notificationSettings.whatsappEnabled} onChange={(next) => setNotificationSetting('whatsappEnabled', next)} /></div>
          <div className="flex items-center justify-between"><p>Push Notifications</p><Toggle checked={data.notificationSettings.pushEnabled} onChange={(next) => setNotificationSetting('pushEnabled', next)} /></div>
          <div className="flex items-center justify-between"><p>Email (backup)</p><Toggle checked={data.notificationSettings.emailEnabled} onChange={(next) => setNotificationSetting('emailEnabled', next)} /></div>
          <div className="flex items-center justify-between"><p>Sound Alerts</p><Toggle checked={data.notificationSettings.soundEnabled} onChange={(next) => setNotificationSetting('soundEnabled', next)} /></div>
        </div>

        <div className="mt-5 space-y-3 rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
          <p className="text-sm font-semibold text-[#111827]">WhatsApp message</p>
          <p className="text-xs text-[#64748b]">Sent to your mobile when a new lead arrives. Placeholders: {'{{region}}'}, {'{{damage}}'}, {'{{estimate}}'}, {'{{link}}'}, {'{{customer}}'}.</p>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">WhatsApp number</label>
            <input
              value={data.notificationSettings.whatsappPhone}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  notificationSettings: { ...prev.notificationSettings, whatsappPhone: e.target.value },
                }))
              }
              placeholder="+61 4xx xxx xxx"
              className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Message template</label>
            <textarea
              value={data.notificationSettings.whatsappMessageTemplate}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  notificationSettings: { ...prev.notificationSettings, whatsappMessageTemplate: e.target.value },
                }))
              }
              rows={5}
              className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        {isPushSupported() && (
          <button
            type="button"
            onClick={() => void handleEnablePush()}
            disabled={pushRegistering}
            className="mt-4 w-full rounded-xl border border-[#cfd9ff] bg-[#eef2ff] py-2 text-sm font-semibold text-[#4338ca] disabled:opacity-60"
          >
            {pushRegistering ? 'Enabling push…' : 'Enable push on this device (PWA)'}
          </button>
        )}
        {pushMessage && <p className="mt-2 text-xs text-[#64748b]">{pushMessage}</p>}
        {notificationFeedback && (
          <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
            notificationFeedback.toLowerCase().includes('failed')
            || notificationFeedback.toLowerCase().includes('twilio')
            || notificationFeedback.includes('Add a')
              ? 'border-[#fcd34d] bg-[#fffbeb] text-[#92400e]'
              : 'border-[#86efac] bg-[#ecfdf3] text-[#166534]'
          }`}>
            {notificationFeedback}
          </p>
        )}

        <button type="button" onClick={() => void saveNotificationSettings()} className="mt-4 w-full rounded-xl bg-[#273548] py-2 text-sm font-semibold text-white">Save Preferences</button>
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
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
        <h3 className="text-lg font-extrabold text-[#111827]">Your shop profile</h3>
        <p className="mt-1 text-sm text-[#64748b]">This information appears on your customer quotes and booking confirmations.</p>

        <div className="mt-4 flex flex-wrap items-start gap-5">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-[#dbe4ff] bg-[#f8fbff]">
              {data.settings.logoUrl ? (
                <img src={data.settings.logoUrl} alt="Shop logo" className="h-full w-full object-contain p-2" />
              ) : (
                <span className="text-2xl font-extrabold text-[#94a3b8]">{data.bodyshop.avatarInitials}</span>
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-[#cfd9ff] bg-white px-3 py-1.5 text-xs font-semibold text-[#273548] hover:bg-[#f3f6ff]">
              {logoUploading ? 'Uploading…' : 'Upload logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={logoUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogoUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div className="grid min-w-[280px] flex-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Business name</label>
              <input
                value={data.settings.businessName}
                onChange={(e) => setData((prev) => ({ ...prev, settings: { ...prev.settings, businessName: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Address</label>
              <input
                value={data.settings.address}
                onChange={(e) => setData((prev) => ({ ...prev, settings: { ...prev.settings, address: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                placeholder="e.g. 12 Industrial Ave, Maroochydore QLD"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Phone</label>
              <input
                value={data.settings.phone}
                onChange={(e) => setData((prev) => ({ ...prev, settings: { ...prev.settings, phone: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                placeholder="04xx xxx xxx"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Shop email</label>
              <input
                type="email"
                value={data.settings.email}
                onChange={(e) => setData((prev) => ({ ...prev, settings: { ...prev.settings, email: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                placeholder="hello@yourshop.com.au"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Website</label>
              <input
                value={data.settings.website}
                onChange={(e) => setData((prev) => ({ ...prev, settings: { ...prev.settings, website: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                placeholder="https://yourshop.com.au"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Postcode</label>
              <input
                value={data.settings.postalCode}
                onChange={(e) => setData((prev) => ({ ...prev, settings: { ...prev.settings, postalCode: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-[#d3dcff] px-3 py-2 text-sm"
                placeholder="4558"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e4e9f8] bg-white p-4">
      <h3 className="text-lg font-extrabold text-[#111827]">Lead & booking settings</h3>
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

        <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[#111827]">PDR (dent removal)</p>
              <p className="text-xs text-[#64748b]">Accept paintless dent repair jobs.</p>
            </div>
            <Toggle
              checked={data.settings.acceptsPdr}
              onChange={(next) =>
                setData((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, acceptsPdr: next },
                }))
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[#111827]">Paint repair</p>
              <p className="text-xs text-[#64748b]">Accept jobs with chipped or damaged paint (quote PDR + paint).</p>
            </div>
            <Toggle
              checked={data.settings.acceptsPaintRepair}
              onChange={(next) =>
                setData((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, acceptsPaintRepair: next },
                }))
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Service region</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{data.settings.regionLabel}</p>
        </div>

        <div className="rounded-xl border border-[#e5eaf8] bg-[#f8fbff] p-3 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Accepted repair types</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['PDR Dent', 'Hail Damage', 'Crease Dent', 'Paint Repair'].map((type) => {
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

      <div className="mt-4">
        <PartnerAvailabilityEditor
          slots={availabilitySlots}
          loading={availabilityLoading}
          saving={availabilitySaving}
          onToggle={handleToggleAvailability}
          onRefresh={() => void refreshAvailability()}
        />
      </div>

      <button type="button" onClick={savePartnerSettings} className="rounded-xl bg-[#273548] px-4 py-2 text-sm font-semibold text-white">
        Save settings
      </button>
      </section>
    </div>
  );

  const shopLogoUrl = data.settings.logoUrl || data.bodyshop.logoUrl;

  const renderShopAvatar = (size: 'md' | 'sm' = 'md') => {
    const dim = size === 'md' ? 'h-12 w-12' : 'h-8 w-8';
    const text = size === 'md' ? 'text-sm' : 'text-xs';
    if (shopLogoUrl) {
      return (
        <div className={`mx-auto flex ${dim} items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white p-1`}>
          <img src={shopLogoUrl} alt={`${data.bodyshop.name} logo`} className="h-full w-full object-contain" />
        </div>
      );
    }
    return (
      <div className={`mx-auto flex ${dim} items-center justify-center rounded-full bg-gradient-to-br from-[#6c63ff] to-[#4f87ff] font-bold ${text}`}>
        {data.bodyshop.avatarInitials}
      </div>
    );
  };

  const renderSection = () => {
    if (parsedRoute.section === 'dashboard') return renderDashboard();
    if (parsedRoute.section === 'leads') return renderLeadsPage();
    if (parsedRoute.section === 'quoted') return renderQuotedPage();
    if (parsedRoute.section === 'booked') return renderBookedPage();
    if (parsedRoute.section === 'complete') return renderCompletePage();
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
              {renderShopAvatar('md')}
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
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <div>
                  <h1 className="text-lg font-extrabold text-[#111827] sm:text-2xl">Good morning, {data.bodyshop.ownerName.split(' ')[0]}</h1>
                  <p className="text-xs text-[#64748b] sm:text-sm">Here&apos;s what&apos;s happening with your leads today.</p>
                </div>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <button type="button" onClick={() => (window.location.hash = '#/partner/notifications')} className="relative rounded-xl border border-[#d7dff5] bg-white px-3 py-2 text-sm">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5"/><path d="M9 17a3 3 0 006 0"/></svg>
                  <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[10px] text-white">{data.activity.length}</span>
                </button>
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

import { supabase } from './supabaseClient';

export type PartnerRouteSection =
  | 'dashboard'
  | 'leads'
  | 'quoted'
  | 'booked'
  | 'performance'
  | 'notifications'
  | 'settings';

export type PartnerLeadStatus = 'new' | 'quoted' | 'inspection' | 'booked' | 'declined' | 'expired';

export interface PartnerIdentity {
  isAuthenticated: boolean;
  isPartner: boolean;
  userId?: string;
  email?: string;
  bodyshopId?: string;
  bodyshopName?: string;
  ownerName?: string;
  region?: string;
  source?: 'profiles' | 'bodyshop_owner' | 'env_fallback' | 'none';
  error?: string;
}

export interface PartnerNotificationSettings {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
}

export interface PartnerPerformance {
  acceptanceRate: number;
  leadsReceived: number;
  quotesSent: number;
  jobsBooked: number;
  averageResponseMinutes: number;
}

export interface PartnerLead {
  id: string;
  customerRef: string;
  customerContact?: string;
  photoUrl: string;
  photoUrls: string[];
  damageType: string;
  panelLocation: string;
  dentCount: number;
  aiEstimateMin: number;
  aiEstimateMax: number;
  distanceMiles: number;
  createdAt: string;
  responseDeadlineAt: string;
  status: PartnerLeadStatus;
  quoteMin?: number;
  quoteMax?: number;
  quoteNote?: string;
  respondedAt?: string;
  bookedAt?: string;
  isNew: boolean;
}

export interface PartnerActivityItem {
  id: string;
  text: string;
  kind: 'new' | 'booked' | 'expired' | 'quoted';
  at: string;
}

export interface PartnerSettings {
  acceptingLeads: boolean;
  serviceRadiusKm: number;
  acceptedRepairTypes: string[];
  operatingHours: string;
  regionLabel: string;
}

export interface PartnerDataBundle {
  bodyshop: {
    id: string;
    name: string;
    region: string;
    avatarInitials: string;
    online: boolean;
    acceptingLeads: boolean;
    supportLabel: string;
    ownerName: string;
    ownerEmail: string;
  };
  metrics: {
    newLeadsToday: number;
    pendingResponse: number;
    bookedJobs: number;
    acceptanceRate: number;
    avgResponseMinutes: number;
  };
  leads: PartnerLead[];
  respondedLeads: PartnerLead[];
  bookedJobs: PartnerLead[];
  performance: PartnerPerformance;
  notificationSettings: PartnerNotificationSettings;
  activity: PartnerActivityItem[];
  quickTip: string;
  settings: PartnerSettings;
}

const parsePhotoUrls = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4);
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];

    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4);
        }
      } catch {
        return [];
      }
    }

    if (raw.includes(',')) {
      return raw.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4);
    }

    return [raw];
  }

  return [];
};

const envBag = (import.meta as any).env || {};

const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1607861716497-e65ab29fc7ac?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1486496572940-2bb2341fdbdf?auto=format&fit=crop&w=1200&q=80',
];

const minutesAgoISO = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();
const secondsFromNowISO = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

const toInitials = (name: string) => {
  const pieces = name.split(' ').filter(Boolean);
  if (!pieces.length) return 'DV';
  return pieces.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
};

const partnerEmails = () => {
  const raw = String(envBag.VITE_PARTNER_EMAILS || '');
  return raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
};

const safeSelectRows = async (table: string): Promise<any[] | null> => {
  try {
    const { data, error } = await supabase.from(table as any).select('*');
    if (error) return null;
    return data || [];
  } catch {
    return null;
  }
};

const getMockBundle = (identity?: PartnerIdentity): PartnerDataBundle => {
  const bodyshopName = identity?.bodyshopName || 'Northside Dent Lab';
  const ownerName = identity?.ownerName || 'Liam Baker';
  const region = identity?.region || 'Brisbane, QLD';
  const ownerEmail = identity?.email || 'liam@northsidedentlab.au';
  const bodyshopId = identity?.bodyshopId || 'shop-brisbane-north';

  const leads: PartnerLead[] = [
    {
      id: 'lead-p-1001',
      customerRef: 'Mia T.',
      photoUrl: DEMO_PHOTOS[0],
      photoUrls: [DEMO_PHOTOS[0], DEMO_PHOTOS[1], DEMO_PHOTOS[2], DEMO_PHOTOS[3]],
      damageType: 'Minor Dent',
      panelLocation: 'Door Panel',
      dentCount: 2,
      aiEstimateMin: 320,
      aiEstimateMax: 380,
      distanceMiles: 0.4,
      createdAt: minutesAgoISO(1),
      responseDeadlineAt: secondsFromNowISO(47),
      status: 'new',
      isNew: true,
    },
    {
      id: 'lead-p-1002',
      customerRef: 'Noah C.',
      photoUrl: DEMO_PHOTOS[1],
      photoUrls: [DEMO_PHOTOS[1], DEMO_PHOTOS[0]],
      damageType: 'Hail Damage',
      panelLocation: 'Rear Quarter Panel',
      dentCount: 6,
      aiEstimateMin: 450,
      aiEstimateMax: 600,
      distanceMiles: 1.2,
      createdAt: minutesAgoISO(2),
      responseDeadlineAt: secondsFromNowISO(52),
      status: 'new',
      isNew: true,
    },
    {
      id: 'lead-p-1003',
      customerRef: 'Sofia N.',
      photoUrl: DEMO_PHOTOS[2],
      photoUrls: [DEMO_PHOTOS[2]],
      damageType: 'Minor Dent',
      panelLocation: 'Front Fender',
      dentCount: 1,
      aiEstimateMin: 280,
      aiEstimateMax: 350,
      distanceMiles: 2.7,
      createdAt: minutesAgoISO(3),
      responseDeadlineAt: secondsFromNowISO(58),
      status: 'new',
      isNew: true,
    },
    {
      id: 'lead-p-1004',
      customerRef: 'Emma D.',
      customerContact: 'Phone visible after booking confirmation',
      photoUrl: DEMO_PHOTOS[3],
      photoUrls: [DEMO_PHOTOS[3], DEMO_PHOTOS[1], DEMO_PHOTOS[0]],
      damageType: 'Minor Dent',
      panelLocation: 'Rear Door',
      dentCount: 2,
      aiEstimateMin: 290,
      aiEstimateMax: 340,
      distanceMiles: 1.9,
      createdAt: minutesAgoISO(18),
      responseDeadlineAt: secondsFromNowISO(-1),
      status: 'quoted',
      quoteMin: 330,
      quoteMax: 330,
      respondedAt: minutesAgoISO(15),
      isNew: false,
    },
    {
      id: 'lead-p-1005',
      customerRef: 'Jack W.',
      customerContact: '+61 412 888 211',
      photoUrl: DEMO_PHOTOS[0],
      photoUrls: [DEMO_PHOTOS[0], DEMO_PHOTOS[1], DEMO_PHOTOS[2], DEMO_PHOTOS[3]],
      damageType: 'Hail Damage',
      panelLocation: 'Roof + Bonnet',
      dentCount: 9,
      aiEstimateMin: 500,
      aiEstimateMax: 720,
      distanceMiles: 0.9,
      createdAt: minutesAgoISO(70),
      responseDeadlineAt: secondsFromNowISO(-1),
      status: 'booked',
      quoteMin: 640,
      quoteMax: 640,
      respondedAt: minutesAgoISO(66),
      bookedAt: minutesAgoISO(58),
      isNew: false,
    },
  ];

  const respondedLeads = leads.filter((lead) => lead.status === 'quoted').slice(0, 4);
  const bookedJobs = leads.filter((lead) => lead.status === 'booked').slice(0, 4);

  return {
    bodyshop: {
      id: bodyshopId,
      name: bodyshopName,
      region,
      avatarInitials: toInitials(bodyshopName),
      online: true,
      acceptingLeads: true,
      supportLabel: 'Contact Support',
      ownerName,
      ownerEmail,
    },
    metrics: {
      newLeadsToday: leads.filter((lead) => lead.status === 'new').length,
      pendingResponse: leads.filter((lead) => lead.status === 'new').length,
      bookedJobs: bookedJobs.length,
      acceptanceRate: 0.68,
      avgResponseMinutes: 7,
    },
    leads,
    respondedLeads,
    bookedJobs,
    performance: {
      acceptanceRate: 0.68,
      leadsReceived: 24,
      quotesSent: 16,
      jobsBooked: 4,
      averageResponseMinutes: 7,
    },
    notificationSettings: {
      pushEnabled: true,
      smsEnabled: true,
      emailEnabled: true,
      soundEnabled: true,
    },
    activity: [
      { id: 'act-1', text: 'New lead from Mia T. · Door dent · $320 estimate', kind: 'new', at: minutesAgoISO(2) },
      { id: 'act-2', text: 'Emma D. booked your quote · Mazda 3 · $320', kind: 'booked', at: minutesAgoISO(5) },
      { id: 'act-3', text: 'Lead expired · no response sent in 1 minute', kind: 'expired', at: minutesAgoISO(15) },
      { id: 'act-4', text: 'Quote sent to Noah C. · Hail repair', kind: 'quoted', at: minutesAgoISO(22) },
    ],
    quickTip: 'Shops with response times under 5 minutes get 2x more booked jobs.',
    settings: {
      acceptingLeads: true,
      serviceRadiusKm: 20,
      acceptedRepairTypes: ['Minor Dent', 'Hail Damage', 'Crease Dent'],
      operatingHours: 'Mon-Sat 08:00-18:00',
      regionLabel: region,
    },
  };
};

const cloneBundle = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const mapLeadRowsForPartner = (leadRows: any[], matchRows: any[], bodyshopId: string): PartnerLead[] => {
  const rowsById = new Map<string, any>();
  leadRows.forEach((row) => rowsById.set(String(row.id), row));

  const matches = matchRows.filter((match) => String(match.bodyshop_id) === bodyshopId);
  if (!matches.length) return [];

  return matches.map((match, index) => {
    const lead = rowsById.get(String(match.lead_id));
    const statusValue = String(match.status || 'new');
    const status: PartnerLeadStatus =
      statusValue === 'booked'
        ? 'booked'
        : statusValue === 'inspection'
          ? 'inspection'
        : statusValue === 'declined'
          ? 'declined'
          : statusValue === 'expired'
            ? 'expired'
            : statusValue === 'quoted'
              ? 'quoted'
              : 'new';

    const createdAt = lead?.created_at || match.created_at || minutesAgoISO(120);
    const responseDeadlineAt = match.response_deadline || new Date(new Date(createdAt).getTime() + 60 * 1000).toISOString();
    const photoUrls = parsePhotoUrls((lead as any)?.photo_urls || (lead as any)?.photoUrls || lead?.photo_url);
    const fallbackPhoto = lead?.photo_url || DEMO_PHOTOS[index % DEMO_PHOTOS.length];

    return {
      id: String(lead?.id || match.lead_id || `lead-${index + 1}`),
      customerRef: lead?.customer_name ? `${String(lead.customer_name).split(' ')[0]} ${String(lead.customer_name).split(' ')[1]?.[0] || ''}.` : 'Customer',
      customerContact:
        status === 'booked'
          ? [lead?.customer_phone, lead?.customer_email].filter(Boolean).join(' · ') || 'Contact unlocked after booking'
          : undefined,
      photoUrl: photoUrls[0] || fallbackPhoto,
      photoUrls: (photoUrls.length ? photoUrls : [fallbackPhoto]).slice(0, 4),
      damageType: lead?.ai_damage_category || 'Dent Repair',
      panelLocation: lead?.damage_location || 'Panel pending',
      dentCount: Number(lead?.dent_count || 1),
      aiEstimateMin: Number(match.ai_estimate_min || lead?.ai_estimate_min || 0),
      aiEstimateMax: Number(match.ai_estimate_max || lead?.ai_estimate_max || 0),
      distanceMiles: Number(match.distance_miles || 1.3),
      createdAt,
      responseDeadlineAt,
      status,
      quoteMin: typeof match.shop_price_min === 'number' ? match.shop_price_min : undefined,
      quoteMax: typeof match.shop_price_max === 'number' ? match.shop_price_max : undefined,
      quoteNote: match.shop_note || undefined,
      respondedAt: match.responded_at || undefined,
      bookedAt: status === 'booked' ? match.responded_at || match.created_at : undefined,
      isNew: new Date(createdAt).getTime() > Date.now() - 4 * 60 * 1000,
    };
  });
};

const computeMetrics = (leads: PartnerLead[]) => {
  const newLeadsToday = leads.filter((lead) => lead.status === 'new').length;
  const pendingResponse = leads.filter((lead) => lead.status === 'new').length;
  const bookedJobs = leads.filter((lead) => lead.status === 'booked').length;
  const quotesSent = leads.filter((lead) => lead.status === 'quoted' || lead.status === 'inspection' || lead.status === 'booked').length;
  const acceptanceRate = leads.length > 0 ? bookedJobs / Math.max(1, quotesSent) : 0;
  return {
    newLeadsToday,
    pendingResponse,
    bookedJobs,
    acceptanceRate,
    avgResponseMinutes: 7,
  };
};

export const getPartnerIdentity = async (): Promise<PartnerIdentity> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return {
        isAuthenticated: false,
        isPartner: false,
        source: 'none',
        error: error.message,
      };
    }

    if (!session?.user) {
      return {
        isAuthenticated: false,
        isPartner: false,
        source: 'none',
      };
    }

    const user = session.user;
    const email = user.email || '';

    const { data: profile } = await supabase
      .from('profiles' as any)
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const ownerByUser = await supabase
      .from('bodyshop_owners' as any)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    let owner = ownerByUser.data;

    if (!owner && email) {
      const ownerByEmail = await supabase
        .from('bodyshop_owners' as any)
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (!ownerByEmail.error) owner = ownerByEmail.data;
    }

    if (owner?.bodyshop_id) {
      const { data: shop } = await supabase
        .from('bodyshops' as any)
        .select('id,business_name,region')
        .eq('id', owner.bodyshop_id)
        .maybeSingle();

      return {
        isAuthenticated: true,
        isPartner: true,
        userId: user.id,
        email,
        bodyshopId: String(owner.bodyshop_id),
        bodyshopName: shop?.business_name || 'Bodyshop Partner',
        ownerName: owner.name || 'Partner Owner',
        region: shop?.region || 'Unassigned Region',
        source: 'bodyshop_owner',
      };
    }

    if (profile?.role === 'bodyshop') {
      return {
        isAuthenticated: true,
        isPartner: true,
        userId: user.id,
        email,
        ownerName: email.split('@')[0] || 'Partner',
        bodyshopName: 'Bodyshop Partner',
        region: 'Unassigned Region',
        source: 'profiles',
      };
    }

    if (email && partnerEmails().includes(email.toLowerCase())) {
      return {
        isAuthenticated: true,
        isPartner: true,
        userId: user.id,
        email,
        ownerName: email.split('@')[0] || 'Partner',
        bodyshopName: 'Bodyshop Partner',
        region: 'Unassigned Region',
        source: 'env_fallback',
      };
    }

    return {
      isAuthenticated: true,
      isPartner: false,
      userId: user.id,
      email,
      source: 'none',
      error: 'Authenticated user is not mapped as bodyshop partner.',
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      isPartner: false,
      source: 'none',
      error: error instanceof Error ? error.message : 'Unknown auth error',
    };
  }
};

export const signInPartner = async (email: string, password: string): Promise<PartnerIdentity> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      isAuthenticated: false,
      isPartner: false,
      source: 'none',
      error: error.message,
    };
  }
  return getPartnerIdentity();
};

export const signUpPartner = async (email: string, password: string, ownerName?: string): Promise<PartnerIdentity> => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        owner_name: ownerName || '',
      },
    },
  });

  if (error) {
    return {
      isAuthenticated: false,
      isPartner: false,
      source: 'none',
      error: error.message,
    };
  }

  return {
    isAuthenticated: false,
    isPartner: false,
    source: 'none',
    error: 'Account created. Confirm your email to complete activation.',
  };
};

export const signOutPartner = async () => {
  await supabase.auth.signOut();
};

export const loadPartnerDataBundle = async (identity: PartnerIdentity): Promise<PartnerDataBundle> => {
  const mock = getMockBundle(identity);
  if (!identity.bodyshopId) return cloneBundle(mock);

  const [leadRows, matchRows, shopRows, notificationRows] = await Promise.all([
    safeSelectRows('lead_requests'),
    safeSelectRows('shop_lead_matches'),
    safeSelectRows('bodyshops'),
    safeSelectRows('notification_settings'),
  ]);

  if (!leadRows || !matchRows || !shopRows) return cloneBundle(mock);

  const partnerLeads = mapLeadRowsForPartner(leadRows, matchRows, identity.bodyshopId);
  if (!partnerLeads.length) return cloneBundle(mock);

  const shop = shopRows.find((row) => String(row.id) === identity.bodyshopId);
  const metrics = computeMetrics(partnerLeads);
  const notificationRow = (notificationRows || []).find((row) => String(row.bodyshop_id) === identity.bodyshopId);

  const bundle: PartnerDataBundle = {
    bodyshop: {
      id: identity.bodyshopId,
      name: shop?.business_name || identity.bodyshopName || mock.bodyshop.name,
      region: shop?.region || identity.region || mock.bodyshop.region,
      avatarInitials: toInitials(shop?.business_name || identity.bodyshopName || mock.bodyshop.name),
      online: shop?.active_status !== false,
      acceptingLeads: shop?.notification_enabled !== false,
      supportLabel: 'Contact Support',
      ownerName: identity.ownerName || mock.bodyshop.ownerName,
      ownerEmail: identity.email || mock.bodyshop.ownerEmail,
    },
    metrics,
    leads: partnerLeads,
    respondedLeads: partnerLeads.filter((lead) => lead.status === 'quoted' || lead.status === 'inspection').slice(0, 8),
    bookedJobs: partnerLeads.filter((lead) => lead.status === 'booked').slice(0, 8),
    performance: {
      acceptanceRate: metrics.acceptanceRate,
      leadsReceived: partnerLeads.length,
      quotesSent: partnerLeads.filter((lead) => lead.status === 'quoted' || lead.status === 'inspection' || lead.status === 'booked').length,
      jobsBooked: metrics.bookedJobs,
      averageResponseMinutes: metrics.avgResponseMinutes,
    },
    notificationSettings: {
      pushEnabled: notificationRow?.push_enabled !== false,
      smsEnabled: !!notificationRow?.sms_enabled,
      emailEnabled: notificationRow?.email_enabled !== false,
      soundEnabled: true,
    },
    activity: [
      {
        id: 'live-1',
        text: `New lead queue updated for ${shop?.business_name || 'your shop'}`,
        kind: 'new',
        at: new Date().toISOString(),
      },
      ...partnerLeads.slice(0, 5).map((lead, index) => ({
        id: `live-${index + 2}`,
        text:
          lead.status === 'booked'
            ? `${lead.customerRef} booked your quote`
            : lead.status === 'quoted'
              ? `Quote sent for ${lead.customerRef}`
              : `New lead from ${lead.customerRef}`,
        kind: (lead.status === 'booked' ? 'booked' : lead.status === 'quoted' ? 'quoted' : 'new') as
          | 'new'
          | 'quoted'
          | 'booked'
          | 'expired',
        at: lead.respondedAt || lead.createdAt,
      })),
    ],
    quickTip: 'Shops with response times under 5 minutes get 2x more booked jobs.',
    settings: {
      acceptingLeads: shop?.notification_enabled !== false,
      serviceRadiusKm: Number(shop?.service_radius || 20),
      acceptedRepairTypes: ['Minor Dent', 'Hail Damage', 'Crease Dent'],
      operatingHours: 'Mon-Sat 08:00-18:00',
      regionLabel: shop?.region || identity.region || 'Unassigned Region',
    },
  };

  return cloneBundle(bundle);
};

export const updatePartnerOnlineStatus = async (bodyshopId: string, online: boolean) => {
  try {
    await supabase
      .from('bodyshops' as any)
      .update({
        active_status: online,
        notification_enabled: online,
      })
      .eq('id', bodyshopId);
  } catch {
    return;
  }
};

export const updatePartnerNotificationSettings = async (
  bodyshopId: string,
  settings: PartnerNotificationSettings
) => {
  try {
    const { data: existing } = await supabase
      .from('notification_settings' as any)
      .select('id')
      .eq('bodyshop_id', bodyshopId)
      .maybeSingle();

    const payload = {
      bodyshop_id: bodyshopId,
      push_enabled: settings.pushEnabled,
      sms_enabled: settings.smsEnabled,
      email_enabled: settings.emailEnabled,
      dashboard_enabled: true,
      primary_channel: settings.pushEnabled ? 'push' : settings.smsEnabled ? 'sms' : 'email',
      backup_channel: settings.emailEnabled ? 'email' : 'dashboard',
      response_deadline_seconds: 60,
      retry_logic: '1 reminder at 60s, then route next bodyshop',
      notification_radius: 20,
      lead_categories_accepted: ['minor', 'medium', 'hail'],
    };

    if (existing?.id) {
      await supabase.from('notification_settings' as any).update(payload).eq('id', existing.id);
    } else {
      await supabase.from('notification_settings' as any).insert(payload);
    }
  } catch {
    return;
  }
};

export const submitPartnerLeadResponse = async (
  bodyshopId: string,
  leadId: string,
  status: 'quoted' | 'inspection' | 'declined',
  quoteMin?: number,
  quoteMax?: number,
  note?: string
) => {
  try {
    const { data: existing } = await supabase
      .from('shop_lead_matches' as any)
      .select('id')
      .eq('bodyshop_id', bodyshopId)
      .eq('lead_id', leadId)
      .maybeSingle();

    const payload = {
      bodyshop_id: bodyshopId,
      lead_id: leadId,
      status,
      shop_price_min: quoteMin ?? null,
      shop_price_max: quoteMax ?? null,
      shop_note: note || null,
      responded_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from('shop_lead_matches' as any).update(payload).eq('id', existing.id);
    } else {
      await supabase.from('shop_lead_matches' as any).insert(payload);
    }
  } catch {
    return;
  }
};

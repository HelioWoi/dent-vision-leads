import { supabase } from './supabaseClient';
import { CommissionSummary, fetchCommissionLedger } from './commissionService';
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATE } from './partnerNotificationService';
import { getPartnerSoundEnabled } from './notificationSound';

export const normalizeWhatsAppTemplate = (template: string) =>
  template.replace(/Respond within 5 min/gi, 'Respond within 3 min');
import { LEAD_RESPONSE_SLA_SECONDS } from './leadSla';

export type PartnerRouteSection =
  | 'dashboard'
  | 'leads'
  | 'quoted'
  | 'booked'
  | 'complete'
  | 'performance'
  | 'notifications'
  | 'settings';

export type PartnerLeadStatus = 'new' | 'quoted' | 'inspection' | 'booked' | 'completed' | 'declined' | 'expired' | 'removed';

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
  whatsappEnabled: boolean;
  whatsappPhone: string;
  whatsappMessageTemplate: string;
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
  customerName: string;
  customerContact?: string;
  photoUrl: string;
  photoUrls: string[];
  damageType: string;
  panelLocation: string;
  dentCount: number;
  aiEstimateMin: number;
  aiEstimateMax: number;
  /** AI dent (PDR) estimate — same as aiEstimate when no split stored */
  aiPdrEstimateMin?: number;
  aiPdrEstimateMax?: number;
  paintRepairNeeded?: boolean;
  distanceMiles: number;
  createdAt: string;
  responseDeadlineAt: string;
  status: PartnerLeadStatus;
  quoteMin?: number;
  quoteMax?: number;
  quotePdrMin?: number;
  quotePdrMax?: number;
  quotePaintMin?: number;
  quotePaintMax?: number;
  quoteNote?: string;
  respondedAt?: string;
  bookedAt?: string;
  isNew: boolean;
  customerComment?: string;
  vehicleRego?: string;
  preferredDate?: string;
  preferredTime?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerPostalCode?: string;
  history: PartnerLeadEvent[];
  matchId?: string;
  assignedBodyshopId?: string;
  assignedBodyshopName?: string;
  completedAt?: string;
  commissionAmount?: number;
  commissionStatus?: 'pending' | 'earned' | 'invoiced' | 'paid' | 'cancelled';
  serviceReviewRating?: number;
  serviceReviewSubmitted?: boolean;
}

export interface PartnerLeadEvent {
  id: string;
  type: string;
  message: string;
  at: string;
}

export interface PartnerActivityItem {
  id: string;
  text: string;
  kind: 'new' | 'booked' | 'expired' | 'quoted';
  at: string;
}

export interface PartnerSettings {
  businessName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  postalCode: string;
  acceptingLeads: boolean;
  serviceRadiusKm: number;
  acceptedRepairTypes: string[];
  operatingHours: string;
  regionLabel: string;
  acceptsPdr: boolean;
  acceptsPaintRepair: boolean;
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
    logoUrl?: string;
    phone?: string;
    address?: string;
    website?: string;
    shopEmail?: string;
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
  completedJobs: PartnerLead[];
  commission: CommissionSummary;
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
  const bodyshopName = identity?.bodyshopName || 'Sunshine Coast PDR Co.';
  const ownerName = identity?.ownerName || 'Demo Owner';
  const region = identity?.region || 'Sunshine Coast, QLD';
  const ownerEmail = identity?.email || 'heliocwoi@gmail.com';
  const bodyshopId = identity?.bodyshopId || '550e8400-e29b-41d4-a716-446655440001';

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
      smsEnabled: false,
      emailEnabled: true,
      soundEnabled: true,
      whatsappEnabled: true,
      whatsappPhone: '',
      whatsappMessageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
    },
    activity: [],
    quickTip: 'Respond within 3 minutes to maximise booking conversion on Sunshine Coast leads.',
    settings: {
      businessName: bodyshopName,
      logoUrl: undefined,
      address: '',
      phone: '',
      email: ownerEmail,
      website: '',
      postalCode: '',
      acceptingLeads: true,
      serviceRadiusKm: 35,
      acceptedRepairTypes: ['PDR Dent', 'Hail Damage', 'Crease Dent'],
      operatingHours: 'Mon-Fri 07:30-17:30, Sat 08:00-12:00',
      regionLabel: region,
      acceptsPdr: true,
      acceptsPaintRepair: true,
    },
  };
};

const cloneBundle = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const buildCustomerRef = (name?: string | null) => {
  if (!name || name === 'Customer') return 'Customer';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0] || 'Customer';
  const lastInitial = parts[1]?.[0];
  return lastInitial ? `${first} ${lastInitial}.` : first;
};

const buildCustomerContact = (lead: any, status: PartnerLeadStatus) => {
  if (status === 'expired' || status === 'removed') return undefined;
  const name = lead?.customer_name ? String(lead.customer_name) : undefined;
  const email = lead?.customer_email ? String(lead.customer_email) : undefined;
  const phone = lead?.customer_phone ? String(lead.customer_phone) : undefined;
  const postal = lead?.postal_code ? String(lead.postal_code) : undefined;
  const parts = [name, email, phone, postal ? `Postcode ${postal}` : undefined].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
};

const mapMatchRowsToLeads = (matches: any[], bodyshopName?: string): PartnerLead[] =>
  matches.map((match, index) => {
    const lead = match.lead_requests || match.lead || {};
    const statusValue = String(match.status || 'new');
    const status: PartnerLeadStatus =
      statusValue === 'completed' ? 'completed'
      : statusValue === 'booked' ? 'booked'
      : statusValue === 'inspection' ? 'inspection'
      : statusValue === 'declined' ? 'declined'
      : statusValue === 'expired' ? 'expired'
      : statusValue === 'removed' ? 'removed'
      : statusValue === 'quoted' ? 'quoted'
      : 'new';

    const customerName = lead?.customer_name ? String(lead.customer_name) : 'Customer';

    const createdAt = lead?.created_at || match.created_at || minutesAgoISO(120);
    const responseDeadlineAt = match.response_deadline || new Date(new Date(createdAt).getTime() + LEAD_RESPONSE_SLA_SECONDS * 1000).toISOString();
    const photoUrls = parsePhotoUrls(lead?.photo_urls || lead?.photo_url);
    const fallbackPhoto = DEMO_PHOTOS[index % DEMO_PHOTOS.length];
    const paintRepairNeeded = !!lead?.paint_repair_needed;
    const pdrMin = Number(lead?.ai_pdr_estimate_min ?? lead?.ai_estimate_min ?? match.ai_estimate_min ?? 0);
    const pdrMax = Number(lead?.ai_pdr_estimate_max ?? lead?.ai_estimate_max ?? match.ai_estimate_max ?? 0);

    return {
      id: String(lead?.id || match.lead_id || `lead-${index + 1}`),
      customerName,
      customerRef: buildCustomerRef(customerName),
      customerContact: buildCustomerContact(lead, status),
      photoUrl: photoUrls[0] || fallbackPhoto,
      photoUrls: (photoUrls.length ? photoUrls : [fallbackPhoto]).slice(0, 4),
      damageType: lead?.ai_damage_category || 'Dent Repair',
      panelLocation: lead?.damage_location || 'Panel pending',
      dentCount: Number(lead?.dent_count || 1),
      aiEstimateMin: pdrMin,
      aiEstimateMax: pdrMax,
      aiPdrEstimateMin: pdrMin,
      aiPdrEstimateMax: pdrMax,
      paintRepairNeeded,
      distanceMiles: Number(match.distance_miles || 1.3),
      createdAt,
      responseDeadlineAt,
      status,
      quoteMin: typeof match.shop_price_min === 'number' ? match.shop_price_min : undefined,
      quoteMax: typeof match.shop_price_max === 'number' ? match.shop_price_max : undefined,
      quotePdrMin: typeof match.quote_pdr_min === 'number' ? match.quote_pdr_min : undefined,
      quotePdrMax: typeof match.quote_pdr_max === 'number' ? match.quote_pdr_max : undefined,
      quotePaintMin: typeof match.quote_paint_min === 'number' ? match.quote_paint_min : undefined,
      quotePaintMax: typeof match.quote_paint_max === 'number' ? match.quote_paint_max : undefined,
      quoteNote: match.shop_note || undefined,
      respondedAt: match.responded_at || undefined,
      bookedAt: lead?.booked_at || match.booked_at || (status === 'booked' || status === 'completed' ? match.responded_at || match.created_at : undefined),
      completedAt: lead?.completed_at || match.completed_at || undefined,
      isNew: status === 'new' && new Date(createdAt).getTime() > Date.now() - 10 * 60 * 1000,
      customerComment: lead?.customer_comment || undefined,
      vehicleRego: lead?.vehicle_rego || undefined,
      preferredDate: lead?.preferred_date || undefined,
      preferredTime: lead?.preferred_time || undefined,
      customerEmail: lead?.customer_email || undefined,
      customerPhone: lead?.customer_phone || undefined,
      customerPostalCode: lead?.postal_code ? String(lead.postal_code) : undefined,
      history: [],
      matchId: match?.id ? String(match.id) : undefined,
      assignedBodyshopId: match?.bodyshop_id ? String(match.bodyshop_id) : undefined,
      assignedBodyshopName: bodyshopName || undefined,
    };
  });

const fetchLeadEvents = async (leadIds: string[]): Promise<Map<string, PartnerLeadEvent[]>> => {
  const grouped = new Map<string, PartnerLeadEvent[]>();
  if (!leadIds.length) return grouped;

  try {
    const { data, error } = await supabase
      .from('lead_events' as any)
      .select('id,lead_id,event_type,message,created_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: true });

    if (error || !data) return grouped;

    for (const row of data) {
      const leadId = String(row.lead_id);
      const list = grouped.get(leadId) || [];
      list.push({
        id: String(row.id),
        type: String(row.event_type || 'note'),
        message: String(row.message || row.event_type || 'Update'),
        at: String(row.created_at),
      });
      grouped.set(leadId, list);
    }
  } catch {
    return grouped;
  }

  return grouped;
};

const attachLeadHistory = (leads: PartnerLead[], eventsByLead: Map<string, PartnerLeadEvent[]>): PartnerLead[] =>
  leads.map((lead) => {
    const dbEvents = eventsByLead.get(lead.id) || [];
    const synthetic: PartnerLeadEvent[] = [
      { id: `${lead.id}-created`, type: 'lead_created', message: 'Customer submitted damage request', at: lead.createdAt },
    ];
    if (lead.respondedAt) {
      synthetic.push({
        id: `${lead.id}-quoted`,
        type: lead.status === 'inspection' ? 'inspection_requested' : 'quote_sent',
        message: lead.quoteNote || `Shop responded (${lead.status})`,
        at: lead.respondedAt,
      });
    }
    if (lead.bookedAt) {
      synthetic.push({
        id: `${lead.id}-booked`,
        type: 'booking_confirmed',
        message: lead.preferredDate
          ? `Booking scheduled for ${lead.preferredDate}${lead.preferredTime ? ` · ${lead.preferredTime}` : ''}`
          : 'Customer confirmed booking',
        at: lead.bookedAt,
      });
    }
    if (lead.completedAt) {
      synthetic.push({
        id: `${lead.id}-completed`,
        type: 'service_completed',
        message: 'Service marked as delivered — customer review requested',
        at: lead.completedAt,
      });
    }

    const merged = [...synthetic];
    for (const event of dbEvents) {
      if (!merged.some((item) => item.id === event.id)) merged.push(event);
    }
    merged.sort((a, b) => +new Date(a.at) - +new Date(b.at));

    return { ...lead, history: merged };
  });

const fetchPartnerMatches = async (bodyshopId: string): Promise<any[] | null> => {
  try {
    const { data, error } = await supabase
      .from('shop_lead_matches' as any)
      .select('*, lead_requests(*)')
      .eq('bodyshop_id', bodyshopId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[partner] fetchPartnerMatches error', error.message);
      return null;
    }
    return data || [];
  } catch (err) {
    console.warn('[partner] fetchPartnerMatches exception', err);
    return null;
  }
};

const mapLeadRowsForPartner = (leadRows: any[], matchRows: any[], bodyshopId: string): PartnerLead[] => {
  const rowsById = new Map<string, any>();
  leadRows.forEach((row) => rowsById.set(String(row.id), row));

  const matches = matchRows.filter((match) => String(match.bodyshop_id) === bodyshopId);
  if (!matches.length) return [];

  return matches.map((match, index) => {
    const lead = rowsById.get(String(match.lead_id));
    const statusValue = String(match.status || 'new');
    const status: PartnerLeadStatus =
      statusValue === 'completed'
        ? 'completed'
        : statusValue === 'booked'
        ? 'booked'
        : statusValue === 'inspection'
          ? 'inspection'
        : statusValue === 'declined'
          ? 'declined'
          : statusValue === 'expired'
            ? 'expired'
            : statusValue === 'removed'
              ? 'removed'
            : statusValue === 'quoted'
              ? 'quoted'
              : 'new';

    const createdAt = lead?.created_at || match.created_at || minutesAgoISO(120);
    const responseDeadlineAt = match.response_deadline || new Date(new Date(createdAt).getTime() + 60 * 1000).toISOString();
    const photoUrls = parsePhotoUrls((lead as any)?.photo_urls || (lead as any)?.photoUrls || lead?.photo_url);
    const fallbackPhoto = lead?.photo_url || DEMO_PHOTOS[index % DEMO_PHOTOS.length];

    const paintRepairNeeded = !!(lead as any)?.paint_repair_needed;
    const pdrMin = Number((lead as any)?.ai_pdr_estimate_min ?? lead?.ai_estimate_min ?? 0);
    const pdrMax = Number((lead as any)?.ai_pdr_estimate_max ?? lead?.ai_estimate_max ?? 0);

    const customerName = lead?.customer_name ? String(lead.customer_name) : 'Customer';

    return {
      id: String(lead?.id || match.lead_id || `lead-${index + 1}`),
      customerName,
      customerRef: buildCustomerRef(customerName),
      customerContact: buildCustomerContact(lead, status),
      photoUrl: photoUrls[0] || fallbackPhoto,
      photoUrls: (photoUrls.length ? photoUrls : [fallbackPhoto]).slice(0, 4),
      damageType: lead?.ai_damage_category || 'Dent Repair',
      panelLocation: lead?.damage_location || 'Panel pending',
      dentCount: Number(lead?.dent_count || 1),
      aiEstimateMin: pdrMin,
      aiEstimateMax: pdrMax,
      aiPdrEstimateMin: pdrMin,
      aiPdrEstimateMax: pdrMax,
      paintRepairNeeded,
      distanceMiles: Number(match.distance_miles || 1.3),
      createdAt,
      responseDeadlineAt,
      status,
      quoteMin: typeof match.shop_price_min === 'number' ? match.shop_price_min : undefined,
      quoteMax: typeof match.shop_price_max === 'number' ? match.shop_price_max : undefined,
      quotePdrMin: typeof match.quote_pdr_min === 'number' ? match.quote_pdr_min : undefined,
      quotePdrMax: typeof match.quote_pdr_max === 'number' ? match.quote_pdr_max : undefined,
      quotePaintMin: typeof match.quote_paint_min === 'number' ? match.quote_paint_min : undefined,
      quotePaintMax: typeof match.quote_paint_max === 'number' ? match.quote_paint_max : undefined,
      quoteNote: match.shop_note || undefined,
      respondedAt: match.responded_at || undefined,
      bookedAt: lead?.booked_at || match.booked_at || (status === 'booked' || status === 'completed' ? match.responded_at || match.created_at : undefined),
      completedAt: lead?.completed_at || match.completed_at || undefined,
      isNew: status === 'new' && new Date(createdAt).getTime() > Date.now() - 10 * 60 * 1000,
      customerComment: lead?.customer_comment || undefined,
      vehicleRego: lead?.vehicle_rego || undefined,
      preferredDate: lead?.preferred_date || undefined,
      preferredTime: lead?.preferred_time || undefined,
      customerEmail: lead?.customer_email || undefined,
      customerPhone: lead?.customer_phone || undefined,
      customerPostalCode: lead?.postal_code ? String(lead.postal_code) : undefined,
      history: [],
    };
  });
};

const attachCommissionData = (leads: PartnerLead[], commission: CommissionSummary): PartnerLead[] => {
  const byMatch = new Map(commission.entries.map((entry) => [entry.matchId, entry]));
  return leads.map((lead) => {
    if (!lead.matchId) return lead;
    const entry = byMatch.get(lead.matchId);
    if (!entry) return lead;
    return {
      ...lead,
      commissionAmount: entry.commissionAmount,
      commissionStatus: entry.status,
      serviceReviewRating: entry.serviceReviewRating,
      serviceReviewSubmitted: entry.serviceReviewSubmitted,
    };
  });
};

const computeMetrics = (leads: PartnerLead[]) => {
  const newLeadsToday = leads.filter((lead) => lead.status === 'new').length;
  const pendingResponse = leads.filter((lead) => lead.status === 'new').length;
  const bookedJobs = leads.filter((lead) => lead.status === 'booked' || lead.status === 'completed').length;
  const quotesSent = leads.filter((lead) => lead.status === 'quoted' || lead.status === 'inspection' || lead.status === 'booked' || lead.status === 'completed').length;
  const acceptanceRate = leads.length > 0 ? bookedJobs / Math.max(1, quotesSent) : 0;
  return {
    newLeadsToday,
    pendingResponse,
    bookedJobs,
    acceptanceRate,
    avgResponseMinutes: 7,
  };
};

const linkOwnerUserId = async (owner: any, userId: string) => {
  if (!owner?.id || owner.user_id === userId) return;
  try {
    await supabase
      .from('bodyshop_owners' as any)
      .update({ user_id: userId, last_login: new Date().toISOString() })
      .eq('id', owner.id);
  } catch {
    // non-blocking
  }
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
      await linkOwnerUserId(owner, user.id);
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
      const ownerByEmail = await supabase
        .from('bodyshop_owners' as any)
        .select('id,bodyshop_id,name')
        .eq('email', email)
        .maybeSingle();

      if (ownerByEmail.data?.id) {
        await linkOwnerUserId(ownerByEmail.data, user.id);
      }

      let shopName = 'Sunshine Coast PDR Co.';
      let region = 'Sunshine Coast, QLD';
      const shopId = ownerByEmail.data?.bodyshop_id
        ? String(ownerByEmail.data.bodyshop_id)
        : '550e8400-e29b-41d4-a716-446655440001';

      if (ownerByEmail.data?.bodyshop_id) {
        const { data: shop } = await supabase
          .from('bodyshops' as any)
          .select('business_name,region')
          .eq('id', ownerByEmail.data.bodyshop_id)
          .maybeSingle();
        shopName = shop?.business_name || shopName;
        region = shop?.region || region;
      }

      return {
        isAuthenticated: true,
        isPartner: true,
        userId: user.id,
        email,
        bodyshopId: shopId,
        bodyshopName: shopName,
        ownerName: ownerByEmail.data?.name || email.split('@')[0] || 'Partner',
        region,
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
  const bodyshopId = identity.bodyshopId || mock.bodyshop.id;

  const [matches, shopRow, notificationRows] = await Promise.all([
    fetchPartnerMatches(bodyshopId),
    supabase.from('bodyshops' as any).select('*').eq('id', bodyshopId).maybeSingle(),
    supabase.from('notification_settings' as any).select('*').eq('bodyshop_id', bodyshopId).maybeSingle(),
  ]);

  const shop = shopRow.data;
  const notificationRow = notificationRows.data;

  if (matches === null) return cloneBundle(mock);

  let partnerLeads = mapMatchRowsToLeads(
    matches,
    shop?.business_name || identity.bodyshopName || mock.bodyshop.name,
  ).filter((lead) => lead.status !== 'removed');
  const [eventsByLead, commission] = await Promise.all([
    fetchLeadEvents(partnerLeads.map((lead) => lead.id)),
    fetchCommissionLedger(bodyshopId),
  ]);
  partnerLeads = attachLeadHistory(partnerLeads, eventsByLead);
  partnerLeads = attachCommissionData(partnerLeads, commission);
  const metrics = computeMetrics(partnerLeads);
  const repairTypes = Array.isArray(notificationRow?.lead_categories_accepted)
    ? notificationRow.lead_categories_accepted.map((t: string) => String(t))
    : mock.settings.acceptedRepairTypes;

  const bundle: PartnerDataBundle = {
    bodyshop: {
      id: bodyshopId,
      name: shop?.business_name || identity.bodyshopName || mock.bodyshop.name,
      region: shop?.region || identity.region || mock.bodyshop.region,
      avatarInitials: toInitials(shop?.business_name || identity.bodyshopName || mock.bodyshop.name),
      online: shop?.active_status !== false,
      acceptingLeads: shop?.notification_enabled !== false,
      supportLabel: 'Contact Support',
      ownerName: identity.ownerName || mock.bodyshop.ownerName,
      ownerEmail: identity.email || mock.bodyshop.ownerEmail,
      logoUrl: shop?.logo_url || undefined,
      phone: shop?.phone || undefined,
      address: shop?.address || undefined,
      website: shop?.website || undefined,
      shopEmail: shop?.email || undefined,
    },
    metrics,
    leads: partnerLeads,
    respondedLeads: partnerLeads.filter((lead) =>
      lead.status === 'quoted'
      || lead.status === 'inspection'
      || lead.status === 'booked'
      || lead.status === 'completed'
    ),
    bookedJobs: partnerLeads.filter((lead) => lead.status === 'booked'),
    completedJobs: partnerLeads.filter((lead) => lead.status === 'completed'),
    commission,
    performance: {
      acceptanceRate: metrics.acceptanceRate,
      leadsReceived: partnerLeads.length,
      quotesSent: partnerLeads.filter((lead) => lead.status === 'quoted' || lead.status === 'inspection' || lead.status === 'booked' || lead.status === 'completed').length,
      jobsBooked: metrics.bookedJobs,
      averageResponseMinutes: metrics.avgResponseMinutes,
    },
    notificationSettings: {
      pushEnabled: notificationRow?.push_enabled !== false,
      smsEnabled: !!notificationRow?.sms_enabled,
      emailEnabled: notificationRow?.email_enabled !== false,
      soundEnabled: getPartnerSoundEnabled(),
      whatsappEnabled: notificationRow?.whatsapp_enabled !== false,
      whatsappPhone: notificationRow?.whatsapp_phone ? String(notificationRow.whatsapp_phone) : '',
      whatsappMessageTemplate: normalizeWhatsAppTemplate(
        notificationRow?.whatsapp_message_template
          ? String(notificationRow.whatsapp_message_template)
          : DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
      ),
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
          lead.status === 'completed'
            ? `${lead.customerRef} service completed`
            : lead.status === 'booked'
            ? `${lead.customerRef} booked your quote`
            : lead.status === 'quoted'
              ? `Quote sent for ${lead.customerRef}`
              : `New lead from ${lead.customerRef}`,
        kind: (lead.status === 'completed' || lead.status === 'booked' ? 'booked' : lead.status === 'quoted' ? 'quoted' : 'new') as
          | 'new'
          | 'quoted'
          | 'booked'
          | 'expired',
        at: lead.respondedAt || lead.createdAt,
      })),
    ],
    quickTip: partnerLeads.length
      ? 'Review paint-repair flags before quoting — customers see your PDR + paint breakdown.'
      : 'Waiting for customer leads. Run a test estimate flow to dispatch a lead here.',
    settings: {
      businessName: shop?.business_name || identity.bodyshopName || mock.bodyshop.name,
      logoUrl: shop?.logo_url || undefined,
      address: shop?.address || '',
      phone: shop?.phone || '',
      email: shop?.email || identity.email || '',
      website: shop?.website || '',
      postalCode: shop?.postal_code || '',
      acceptingLeads: shop?.notification_enabled !== false,
      serviceRadiusKm: Number(shop?.service_radius || 35),
      acceptedRepairTypes: repairTypes,
      operatingHours: shop?.operating_hours || 'Mon-Fri 07:30-17:30, Sat 08:00-12:00',
      regionLabel: shop?.region || identity.region || 'Sunshine Coast, QLD',
      acceptsPdr: shop?.accepts_pdr !== false,
      acceptsPaintRepair: shop?.accepts_paint_repair !== false,
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
      whatsapp_enabled: settings.whatsappEnabled,
      whatsapp_phone: settings.whatsappPhone.trim() || null,
      whatsapp_message_template: settings.whatsappMessageTemplate.trim() || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
      dashboard_enabled: true,
      primary_channel: settings.whatsappEnabled ? 'whatsapp' : settings.pushEnabled ? 'push' : settings.emailEnabled ? 'email' : 'dashboard',
      backup_channel: settings.emailEnabled ? 'email' : 'dashboard',
      response_deadline_seconds: LEAD_RESPONSE_SLA_SECONDS,
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

export const updatePartnerSettings = async (
  bodyshopId: string,
  settings: PartnerSettings,
) => {
  try {
    await supabase
      .from('bodyshops' as any)
      .update({
        business_name: settings.businessName.trim(),
        logo_url: settings.logoUrl || null,
        address: settings.address.trim() || null,
        phone: settings.phone.trim() || null,
        email: settings.email.trim() || null,
        website: settings.website.trim() || null,
        postal_code: settings.postalCode.trim() || null,
        active_status: settings.acceptingLeads,
        notification_enabled: settings.acceptingLeads,
        service_radius: settings.serviceRadiusKm,
        operating_hours: settings.operatingHours,
        accepts_pdr: settings.acceptsPdr,
        accepts_paint_repair: settings.acceptsPaintRepair,
      })
      .eq('id', bodyshopId);

    const { data: existing } = await supabase
      .from('notification_settings' as any)
      .select('id')
      .eq('bodyshop_id', bodyshopId)
      .maybeSingle();

    const categories = [
      ...(settings.acceptsPdr ? ['pdr', 'hail', 'crease'] : []),
      ...(settings.acceptsPaintRepair ? ['paint'] : []),
    ];

    const payload = {
      bodyshop_id: bodyshopId,
      notification_radius: settings.serviceRadiusKm,
      lead_categories_accepted: categories.length ? categories : settings.acceptedRepairTypes,
    };

    if (existing?.id) {
      await supabase.from('notification_settings' as any).update(payload).eq('id', existing.id);
    } else {
      await supabase.from('notification_settings' as any).insert({
        ...payload,
        push_enabled: true,
        email_enabled: true,
        dashboard_enabled: true,
        response_deadline_seconds: LEAD_RESPONSE_SLA_SECONDS,
      });
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
  note?: string,
  quotePdr?: number,
  quotePaint?: number,
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
      quote_pdr_min: quotePdr ?? null,
      quote_pdr_max: quotePdr ?? null,
      quote_paint_min: quotePaint ?? null,
      quote_paint_max: quotePaint ?? null,
      shop_note: note || null,
      responded_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from('shop_lead_matches' as any).update(payload).eq('id', existing.id);
    } else {
      await supabase.from('shop_lead_matches' as any).insert(payload);
    }

    const eventType = status === 'quoted' ? 'quote_sent' : status === 'inspection' ? 'inspection_requested' : 'lead_declined';
    const eventMessage = note
      || (status === 'quoted' ? `Quote sent: $${quoteMin ?? ''}${quoteMax && quoteMax !== quoteMin ? `–$${quoteMax}` : ''}` : `Shop marked lead as ${status}`);

    await supabase.rpc('append_lead_event' as any, {
      p_lead_id: leadId,
      p_bodyshop_id: bodyshopId,
      p_event_type: eventType,
      p_message: eventMessage,
      p_payload: {
        quote_min: quoteMin ?? null,
        quote_max: quoteMax ?? null,
        quote_pdr: quotePdr ?? null,
        quote_paint: quotePaint ?? null,
      },
    });
  } catch {
    return;
  }
};

export const deletePartnerLead = async (bodyshopId: string, leadId: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc('delete_partner_lead' as any, {
      p_bodyshop_id: bodyshopId,
      p_lead_id: leadId,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not remove lead.',
    };
  }
};

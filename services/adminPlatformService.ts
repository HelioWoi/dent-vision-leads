import { supabase } from './supabaseClient';

export type UserRole = 'admin' | 'bodyshop' | 'customer';

export type LeadStatus =
  | 'new'
  | 'ai_analyzed'
  | 'sent_to_bodyshops'
  | 'bodyshop_reviewing'
  | 'quoted'
  | 'booked'
  | 'no_response'
  | 'rejected_by_shops'
  | 'manual_review'
  | 'expired';

export type ResponseStatus = 'reviewing' | 'quoted' | 'rejected' | 'missed';

export interface AdminIdentity {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userId?: string;
  email?: string;
  role?: UserRole;
  source?: 'profiles' | 'admin_users' | 'env_fallback' | 'none';
  error?: string;
}

export interface LeadResponse {
  bodyshopId: string;
  bodyshopName: string;
  status: ResponseStatus;
  quoteMin?: number;
  quoteMax?: number;
  note?: string;
  respondedAt?: string;
}

export interface LeadTimelineEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
}

export interface LeadRecord {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  postalCode: string;
  region: string;
  photoUrls: string[];
  aiEstimateMin: number;
  aiEstimateMax: number;
  aiDamageCategory: string;
  dentCount: number;
  dentSize: string;
  damageLocation: string;
  confidenceScore: number;
  matchedBodyshopIds: string[];
  responses: LeadResponse[];
  status: LeadStatus;
  createdAt: string;
  internalNotes: string[];
  archived: boolean;
}

export interface BodyshopRecord {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  serviceRadius: number;
  region: string;
  latitude: number;
  longitude: number;
  verifiedStatus: boolean;
  activeStatus: boolean;
  notificationEnabled: boolean;
  responsePerformance: 'excellent' | 'good' | 'needs_attention';
  totalLeadsReceived: number;
  acceptanceRate: number;
  averageResponseTimeMinutes: number;
  online: boolean;
}

export interface BodyshopOwnerRecord {
  id: string;
  userId?: string;
  bodyshopId: string;
  name: string;
  email: string;
  phone: string;
  role: 'owner' | 'manager' | 'staff';
  notificationPreference: 'push' | 'sms' | 'email' | 'dashboard';
  lastLogin: string;
  activeStatus: boolean;
}

export interface NotificationSettingRecord {
  id: string;
  bodyshopId: string;
  ownerId: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  dashboardEnabled: boolean;
  primaryChannel: 'push' | 'sms' | 'email' | 'dashboard';
  backupChannel: 'push' | 'sms' | 'email' | 'dashboard';
  responseDeadlineSeconds: number;
  retryLogic: string;
  notificationRadiusKm: number;
  leadCategoriesAccepted: string[];
}

export interface NotificationLogRecord {
  id: string;
  bodyshopId: string;
  ownerId: string;
  leadId: string;
  channel: 'push' | 'sms' | 'email' | 'whatsapp' | 'dashboard';
  status: 'sent' | 'delivered' | 'failed' | 'queued';
  message: string;
  sentAt: string;
  deliveredAt?: string;
  failedReason?: string;
}

export interface ManualReviewRecord {
  id: string;
  leadId: string;
  reason: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminNote: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface PricingRegionRecord {
  id: string;
  regionName: string;
  postalCodes: string[];
  state: string;
  country: string;
  activeStatus: boolean;
  linkedBodyshops: string[];
  pricingRuleReference: string;
}

export interface AlertRecord {
  id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
}

export interface AdminDataBundle {
  leads: LeadRecord[];
  bodyshops: BodyshopRecord[];
  owners: BodyshopOwnerRecord[];
  notificationSettings: NotificationSettingRecord[];
  notificationLogs: NotificationLogRecord[];
  manualReviews: ManualReviewRecord[];
  pricingRegions: PricingRegionRecord[];
  alerts: AlertRecord[];
  aiRuleInfo: {
    activeVersion: string;
    confidenceThreshold: string;
    pdrCompatibility: string;
    pricingLogic: string;
    status: string;
    connected: boolean;
  };
}

const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
];

const minutesAgoISO = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

const getMockData = (): AdminDataBundle => {
  const bodyshops: BodyshopRecord[] = [
    {
      id: 'shop-brisbane-north',
      businessName: 'Northside Dent Lab',
      ownerName: 'Liam Baker',
      email: 'northside@dentlab.au',
      phone: '+61 400 111 201',
      address: '27 Fleet St, Brisbane QLD',
      postalCode: '4006',
      serviceRadius: 22,
      region: 'Brisbane North',
      latitude: -27.4471,
      longitude: 153.0281,
      verifiedStatus: true,
      activeStatus: true,
      notificationEnabled: true,
      responsePerformance: 'excellent',
      totalLeadsReceived: 124,
      acceptanceRate: 0.68,
      averageResponseTimeMinutes: 7,
      online: true,
    },
    {
      id: 'shop-gold-coast-central',
      businessName: 'Gold Coast PDR Studio',
      ownerName: 'Chloe Martin',
      email: 'hello@gcpdr.com.au',
      phone: '+61 400 223 772',
      address: '15 Marine Pde, Southport QLD',
      postalCode: '4215',
      serviceRadius: 30,
      region: 'Gold Coast',
      latitude: -27.971,
      longitude: 153.411,
      verifiedStatus: true,
      activeStatus: true,
      notificationEnabled: true,
      responsePerformance: 'good',
      totalLeadsReceived: 89,
      acceptanceRate: 0.59,
      averageResponseTimeMinutes: 12,
      online: true,
    },
    {
      id: 'shop-ipswich-mobile',
      businessName: 'Ipswich Mobile Dent Repair',
      ownerName: 'Ethan Wright',
      email: 'ops@ipswichmobile.au',
      phone: '+61 400 787 119',
      address: '92 Ellenborough St, Ipswich QLD',
      postalCode: '4305',
      serviceRadius: 25,
      region: 'Ipswich',
      latitude: -27.616,
      longitude: 152.764,
      verifiedStatus: false,
      activeStatus: true,
      notificationEnabled: true,
      responsePerformance: 'needs_attention',
      totalLeadsReceived: 47,
      acceptanceRate: 0.4,
      averageResponseTimeMinutes: 21,
      online: false,
    },
  ];

  const owners: BodyshopOwnerRecord[] = [
    {
      id: 'owner-1',
      userId: 'uid-owner-1',
      bodyshopId: 'shop-brisbane-north',
      name: 'Liam Baker',
      email: 'liam@dentlab.au',
      phone: '+61 401 111 909',
      role: 'owner',
      notificationPreference: 'push',
      lastLogin: minutesAgoISO(12),
      activeStatus: true,
    },
    {
      id: 'owner-2',
      userId: 'uid-owner-2',
      bodyshopId: 'shop-gold-coast-central',
      name: 'Chloe Martin',
      email: 'chloe@gcpdr.com.au',
      phone: '+61 401 551 223',
      role: 'owner',
      notificationPreference: 'sms',
      lastLogin: minutesAgoISO(51),
      activeStatus: true,
    },
    {
      id: 'owner-3',
      userId: 'uid-owner-3',
      bodyshopId: 'shop-ipswich-mobile',
      name: 'Ethan Wright',
      email: 'ethan@ipswichmobile.au',
      phone: '+61 401 771 887',
      role: 'manager',
      notificationPreference: 'email',
      lastLogin: minutesAgoISO(260),
      activeStatus: true,
    },
  ];

  const leads: LeadRecord[] = [
    {
      id: 'lead-1001',
      customerName: 'Mia Thompson',
      customerEmail: 'mia.thompson@email.com',
      customerPhone: '+61 412 100 321',
      postalCode: '4006',
      region: 'Brisbane North',
      photoUrls: [DEMO_PHOTOS[0]],
      aiEstimateMin: 280,
      aiEstimateMax: 460,
      aiDamageCategory: 'Single dent - door panel',
      dentCount: 1,
      dentSize: '2.5 cm',
      damageLocation: 'Front left door',
      confidenceScore: 0.94,
      matchedBodyshopIds: ['shop-brisbane-north', 'shop-gold-coast-central'],
      responses: [
        {
          bodyshopId: 'shop-brisbane-north',
          bodyshopName: 'Northside Dent Lab',
          status: 'quoted',
          quoteMin: 320,
          quoteMax: 390,
          note: 'Can complete same-day if dropped before noon.',
          respondedAt: minutesAgoISO(7),
        },
      ],
      status: 'quoted',
      createdAt: minutesAgoISO(14),
      internalNotes: ['Customer requested Saturday availability.'],
      archived: false,
    },
    {
      id: 'lead-1002',
      customerName: 'Noah Collins',
      customerEmail: 'noah.c@example.com',
      customerPhone: '+61 422 778 118',
      postalCode: '4215',
      region: 'Gold Coast',
      photoUrls: [DEMO_PHOTOS[1]],
      aiEstimateMin: 520,
      aiEstimateMax: 860,
      aiDamageCategory: 'Multiple dents - bonnet and guard',
      dentCount: 4,
      dentSize: '3-6 cm',
      damageLocation: 'Bonnet + front right guard',
      confidenceScore: 0.72,
      matchedBodyshopIds: ['shop-gold-coast-central', 'shop-ipswich-mobile'],
      responses: [
        {
          bodyshopId: 'shop-gold-coast-central',
          bodyshopName: 'Gold Coast PDR Studio',
          status: 'reviewing',
          note: 'Requested one extra angle photo.',
        },
      ],
      status: 'bodyshop_reviewing',
      createdAt: minutesAgoISO(28),
      internalNotes: [],
      archived: false,
    },
    {
      id: 'lead-1003',
      customerName: 'Sofia Nguyen',
      customerEmail: 'sofia.nguyen@mail.au',
      customerPhone: '+61 403 200 005',
      postalCode: '4305',
      region: 'Ipswich',
      photoUrls: [DEMO_PHOTOS[2]],
      aiEstimateMin: 0,
      aiEstimateMax: 0,
      aiDamageCategory: 'Low confidence / possible non-PDR',
      dentCount: 2,
      dentSize: '8-10 cm',
      damageLocation: 'Rear quarter panel',
      confidenceScore: 0.48,
      matchedBodyshopIds: ['shop-ipswich-mobile'],
      responses: [],
      status: 'manual_review',
      createdAt: minutesAgoISO(52),
      internalNotes: ['Potential paint damage around edge; review required.'],
      archived: false,
    },
    {
      id: 'lead-1004',
      customerName: 'Jack Wilson',
      customerEmail: 'jack.w@example.com',
      customerPhone: '+61 421 019 490',
      postalCode: '4001',
      region: 'Brisbane Central',
      photoUrls: [DEMO_PHOTOS[0]],
      aiEstimateMin: 310,
      aiEstimateMax: 510,
      aiDamageCategory: 'Roof dent',
      dentCount: 2,
      dentSize: '2-4 cm',
      damageLocation: 'Roof centerline',
      confidenceScore: 0.88,
      matchedBodyshopIds: ['shop-brisbane-north'],
      responses: [
        {
          bodyshopId: 'shop-brisbane-north',
          bodyshopName: 'Northside Dent Lab',
          status: 'missed',
          note: 'No response inside SLA.',
        },
      ],
      status: 'no_response',
      createdAt: minutesAgoISO(85),
      internalNotes: [],
      archived: false,
    },
  ];

  const notificationSettings: NotificationSettingRecord[] = [
    {
      id: 'notify-1',
      bodyshopId: 'shop-brisbane-north',
      ownerId: 'owner-1',
      pushEnabled: true,
      smsEnabled: true,
      emailEnabled: true,
      whatsappEnabled: false,
      dashboardEnabled: true,
      primaryChannel: 'push',
      backupChannel: 'sms',
      responseDeadlineSeconds: 60,
      retryLogic: '1 reminder at 60s, then route next bodyshop',
      notificationRadiusKm: 18,
      leadCategoriesAccepted: ['minor', 'medium'],
    },
    {
      id: 'notify-2',
      bodyshopId: 'shop-gold-coast-central',
      ownerId: 'owner-2',
      pushEnabled: true,
      smsEnabled: true,
      emailEnabled: true,
      whatsappEnabled: false,
      dashboardEnabled: true,
      primaryChannel: 'sms',
      backupChannel: 'push',
      responseDeadlineSeconds: 90,
      retryLogic: '2 reminders every 45s',
      notificationRadiusKm: 25,
      leadCategoriesAccepted: ['minor', 'medium', 'complex'],
    },
    {
      id: 'notify-3',
      bodyshopId: 'shop-ipswich-mobile',
      ownerId: 'owner-3',
      pushEnabled: false,
      smsEnabled: true,
      emailEnabled: true,
      whatsappEnabled: false,
      dashboardEnabled: true,
      primaryChannel: 'email',
      backupChannel: 'sms',
      responseDeadlineSeconds: 120,
      retryLogic: 'Escalate to admin queue after first miss',
      notificationRadiusKm: 20,
      leadCategoriesAccepted: ['minor'],
    },
  ];

  const notificationLogs: NotificationLogRecord[] = [
    {
      id: 'nlog-1',
      bodyshopId: 'shop-brisbane-north',
      ownerId: 'owner-1',
      leadId: 'lead-1001',
      channel: 'push',
      status: 'delivered',
      message: 'New dent lead nearby. AI Estimate: $280-$460. Respond within 1 minute.',
      sentAt: minutesAgoISO(13),
      deliveredAt: minutesAgoISO(13),
    },
    {
      id: 'nlog-2',
      bodyshopId: 'shop-gold-coast-central',
      ownerId: 'owner-2',
      leadId: 'lead-1002',
      channel: 'sms',
      status: 'sent',
      message: 'You have a pending Dent-Vision AI lead waiting for response.',
      sentAt: minutesAgoISO(24),
    },
    {
      id: 'nlog-3',
      bodyshopId: 'shop-ipswich-mobile',
      ownerId: 'owner-3',
      leadId: 'lead-1004',
      channel: 'email',
      status: 'failed',
      message: 'New dent lead nearby. AI Estimate: $310-$510. Respond within 1 minute.',
      sentAt: minutesAgoISO(78),
      failedReason: 'SMTP timeout',
    },
  ];

  const manualReviews: ManualReviewRecord[] = [
    {
      id: 'mreview-1',
      leadId: 'lead-1003',
      reason: 'Low AI confidence and possible paint damage',
      status: 'open',
      adminNote: 'Need close-up image and bodyline assessment.',
      createdAt: minutesAgoISO(51),
    },
  ];

  const pricingRegions: PricingRegionRecord[] = [
    {
      id: 'region-brisbane',
      regionName: 'Brisbane Metro',
      postalCodes: ['4000', '4001', '4006', '4010'],
      state: 'QLD',
      country: 'Australia',
      activeStatus: true,
      linkedBodyshops: ['shop-brisbane-north'],
      pricingRuleReference: 'RULE-QLD-BRISBANE-V1',
    },
    {
      id: 'region-gold-coast',
      regionName: 'Gold Coast',
      postalCodes: ['4215', '4217', '4220'],
      state: 'QLD',
      country: 'Australia',
      activeStatus: true,
      linkedBodyshops: ['shop-gold-coast-central'],
      pricingRuleReference: 'RULE-QLD-GC-V1',
    },
  ];

  const alerts: AlertRecord[] = [
    {
      id: 'alert-1',
      level: 'warning',
      message: '5 leads waiting for response',
    },
    {
      id: 'alert-2',
      level: 'critical',
      message: '2 bodyshops have missed response deadlines',
    },
    {
      id: 'alert-3',
      level: 'warning',
      message: '1 lead requires manual review',
    },
    {
      id: 'alert-4',
      level: 'info',
      message: 'Brisbane region has low response coverage',
    },
  ];

  return {
    leads,
    bodyshops,
    owners,
    notificationSettings,
    notificationLogs,
    manualReviews,
    pricingRegions,
    alerts,
    aiRuleInfo: {
      activeVersion: 'Pending Owner Rule Sync',
      confidenceThreshold: 'Placeholder - connect existing AI logic',
      pdrCompatibility: 'Placeholder - uses existing analysis output when available',
      pricingLogic: 'Existing Dent-Vision AI pricing logic will be connected',
      status: 'Integration-ready',
      connected: false,
    },
  };
};

const cloneBundle = (bundle: AdminDataBundle): AdminDataBundle => JSON.parse(JSON.stringify(bundle));

const envAdminEmails = () => {
  const envBag = (import.meta as any).env || {};
  const envValue = (envBag.VITE_ADMIN_EMAILS || '') as string;
  return envValue
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const mapRole = (value: unknown): UserRole | null => {
  if (value === 'admin' || value === 'bodyshop' || value === 'customer') return value;
  return null;
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

const mapBodyshopsFromRows = (rows: any[]): BodyshopRecord[] =>
  rows.map((row, index) => ({
    id: String(row.id || `shop-${index + 1}`),
    businessName: row.business_name || 'Unnamed Bodyshop',
    ownerName: row.owner_name || 'Owner pending',
    email: row.email || 'owner@pending.local',
    phone: row.phone || '-',
    address: row.address || '-',
    postalCode: row.postal_code || '-',
    serviceRadius: Number(row.service_radius || 15),
    region: row.region || 'Unassigned',
    latitude: Number(row.latitude || 0),
    longitude: Number(row.longitude || 0),
    verifiedStatus: !!row.verified_status,
    activeStatus: row.active_status !== false,
    notificationEnabled: row.notification_enabled !== false,
    responsePerformance: 'good',
    totalLeadsReceived: Number(row.total_leads_received || 0),
    acceptanceRate: Number(row.acceptance_rate || 0),
    averageResponseTimeMinutes: Number(row.average_response_time || 0),
    online: row.active_status !== false,
  }));

const mapOwnersFromRows = (rows: any[]): BodyshopOwnerRecord[] =>
  rows.map((row, index) => ({
    id: String(row.id || `owner-${index + 1}`),
    userId: row.user_id ? String(row.user_id) : undefined,
    bodyshopId: String(row.bodyshop_id || 'unassigned-shop'),
    name: row.name || 'Unnamed Owner',
    email: row.email || 'owner@pending.local',
    phone: row.phone || '-',
    role: row.role === 'manager' || row.role === 'staff' ? row.role : 'owner',
    notificationPreference:
      row.notification_preference === 'sms' || row.notification_preference === 'email' || row.notification_preference === 'dashboard'
        ? row.notification_preference
        : 'push',
    lastLogin: row.last_login || minutesAgoISO(999),
    activeStatus: row.active_status !== false,
  }));

const mapLeadsFromRows = (rows: any[], bodyshops: BodyshopRecord[]): LeadRecord[] => {
  const fallbackShops = bodyshops.slice(0, 2).map((shop) => shop.id);
  return rows.map((row, index) => ({
    id: String(row.id || `lead-${index + 1}`),
    customerName: row.customer_name || 'Unknown Customer',
    customerEmail: row.customer_email || 'unknown@email.local',
    customerPhone: row.customer_phone || '-',
    postalCode: row.postal_code || '-',
    region: row.region || 'Unknown Region',
    photoUrls: row.photo_url ? [String(row.photo_url)] : [DEMO_PHOTOS[index % DEMO_PHOTOS.length]],
    aiEstimateMin: Number(row.ai_estimate_min || 0),
    aiEstimateMax: Number(row.ai_estimate_max || 0),
    aiDamageCategory: row.ai_damage_category || 'Pending AI categorization',
    dentCount: Number(row.dent_count || 0),
    dentSize: row.dent_size || 'N/A',
    damageLocation: row.damage_location || 'Unknown panel',
    confidenceScore: Number(row.ai_confidence_score || 0),
    matchedBodyshopIds: fallbackShops,
    responses: [],
    status: (row.status || 'new') as LeadStatus,
    createdAt: row.created_at || minutesAgoISO(1000),
    internalNotes: [],
    archived: false,
  }));
};

const buildAlerts = (bundle: AdminDataBundle): AlertRecord[] => {
  const pending = bundle.leads.filter((lead) => lead.status === 'sent_to_bodyshops' || lead.status === 'bodyshop_reviewing').length;
  const missed = bundle.leads.filter((lead) => lead.status === 'no_response').length;
  const manual = bundle.leads.filter((lead) => lead.status === 'manual_review').length;

  const coverage = bundle.bodyshops.filter((shop) => shop.activeStatus && shop.notificationEnabled).length;
  const alerts: AlertRecord[] = [
    { id: 'runtime-1', level: pending > 4 ? 'warning' : 'info', message: `${pending} leads waiting for response` },
    { id: 'runtime-2', level: missed > 1 ? 'critical' : 'warning', message: `${missed} bodyshop response misses detected` },
    { id: 'runtime-3', level: manual > 0 ? 'warning' : 'info', message: `${manual} leads require manual review` },
    { id: 'runtime-4', level: coverage < 3 ? 'warning' : 'info', message: `Active response coverage: ${coverage} bodyshops online` },
  ];

  return alerts;
};

export const getAdminIdentity = async (): Promise<AdminIdentity> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        source: 'none',
        error: error.message,
      };
    }

    if (!session?.user) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        source: 'none',
      };
    }

    const user = session.user;
    const email = user.email || '';

    const { data: profile, error: profileError } = await supabase
      .from('profiles' as any)
      .select('role,email')
      .eq('id', user.id)
      .maybeSingle();

    if (!profileError) {
      const role = mapRole(profile?.role);
      if (role === 'admin') {
        return {
          isAuthenticated: true,
          isAdmin: true,
          userId: user.id,
          email,
          role,
          source: 'profiles',
        };
      }
      if (role) {
        return {
          isAuthenticated: true,
          isAdmin: false,
          userId: user.id,
          email,
          role,
          source: 'profiles',
        };
      }
    }

    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users' as any)
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminError && adminUser?.role === 'admin') {
      return {
        isAuthenticated: true,
        isAdmin: true,
        userId: user.id,
        email,
        role: 'admin',
        source: 'admin_users',
      };
    }

    const allowed = envAdminEmails();
    if (email && allowed.includes(email.toLowerCase())) {
      return {
        isAuthenticated: true,
        isAdmin: true,
        userId: user.id,
        email,
        role: 'admin',
        source: 'env_fallback',
      };
    }

    return {
      isAuthenticated: true,
      isAdmin: false,
      userId: user.id,
      email,
      role: 'customer',
      source: 'none',
      error: 'Authenticated user is not mapped as admin.',
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      source: 'none',
      error: error instanceof Error ? error.message : 'Unknown auth error',
    };
  }
};

export const signInAdmin = async (email: string, password: string): Promise<AdminIdentity> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      source: 'none',
      error: error.message,
    };
  }

  return getAdminIdentity();
};

export const signOutAdmin = async () => {
  await supabase.auth.signOut();
};

export const loadAdminDataBundle = async (): Promise<AdminDataBundle> => {
  const seed = getMockData();

  const [leadRows, bodyshopRows, ownerRows, notificationSettingRows, notificationLogRows, manualReviewRows, pricingRegionRows] =
    await Promise.all([
      safeSelectRows('lead_requests'),
      safeSelectRows('bodyshops'),
      safeSelectRows('bodyshop_owners'),
      safeSelectRows('notification_settings'),
      safeSelectRows('notification_logs'),
      safeSelectRows('manual_reviews'),
      safeSelectRows('pricing_regions'),
    ]);

  let bodyshops = seed.bodyshops;
  if (bodyshopRows && bodyshopRows.length) {
    bodyshops = mapBodyshopsFromRows(bodyshopRows);
  }

  let owners = seed.owners;
  if (ownerRows && ownerRows.length) {
    owners = mapOwnersFromRows(ownerRows);
  }

  let leads = seed.leads;
  if (leadRows && leadRows.length) {
    leads = mapLeadsFromRows(leadRows, bodyshops);
  }

  const notificationSettings =
    notificationSettingRows && notificationSettingRows.length
      ? notificationSettingRows.map((row: any, index: number): NotificationSettingRecord => ({
          id: String(row.id || `notify-${index + 1}`),
          bodyshopId: String(row.bodyshop_id || bodyshops[0]?.id || 'unknown-shop'),
          ownerId: String(row.owner_id || owners[0]?.id || 'unknown-owner'),
          pushEnabled: row.push_enabled !== false,
          smsEnabled: !!row.sms_enabled,
          emailEnabled: row.email_enabled !== false,
          whatsappEnabled: !!row.whatsapp_enabled,
          dashboardEnabled: row.dashboard_enabled !== false,
          primaryChannel:
            row.primary_channel === 'sms' || row.primary_channel === 'email' || row.primary_channel === 'dashboard' ? row.primary_channel : 'push',
          backupChannel:
            row.backup_channel === 'push' || row.backup_channel === 'sms' || row.backup_channel === 'dashboard' ? row.backup_channel : 'email',
          responseDeadlineSeconds: Number(row.response_deadline_seconds || 60),
          retryLogic: row.retry_logic || 'Reminder + reroute',
          notificationRadiusKm: Number(row.notification_radius || 20),
          leadCategoriesAccepted: Array.isArray(row.lead_categories_accepted) ? row.lead_categories_accepted : ['minor', 'medium'],
        }))
      : seed.notificationSettings;

  const notificationLogs =
    notificationLogRows && notificationLogRows.length
      ? notificationLogRows.map((row: any, index: number): NotificationLogRecord => ({
          id: String(row.id || `nlog-${index + 1}`),
          bodyshopId: String(row.bodyshop_id || bodyshops[0]?.id || 'unknown-shop'),
          ownerId: String(row.owner_id || owners[0]?.id || 'unknown-owner'),
          leadId: String(row.lead_id || leads[0]?.id || 'unknown-lead'),
          channel:
            row.channel === 'sms' || row.channel === 'email' || row.channel === 'whatsapp' || row.channel === 'dashboard' ? row.channel : 'push',
          status: row.status === 'delivered' || row.status === 'failed' || row.status === 'queued' ? row.status : 'sent',
          message: row.message || 'Notification event',
          sentAt: row.sent_at || minutesAgoISO(60),
          deliveredAt: row.delivered_at || undefined,
          failedReason: row.failed_reason || undefined,
        }))
      : seed.notificationLogs;

  const manualReviews =
    manualReviewRows && manualReviewRows.length
      ? manualReviewRows.map((row: any, index: number): ManualReviewRecord => ({
          id: String(row.id || `mreview-${index + 1}`),
          leadId: String(row.lead_id || leads[0]?.id || 'unknown-lead'),
          reason: row.reason || 'Manual review required',
          status: row.status === 'resolved' || row.status === 'in_progress' ? row.status : 'open',
          adminNote: row.admin_note || '',
          createdAt: row.created_at || minutesAgoISO(120),
          resolvedAt: row.resolved_at || undefined,
        }))
      : seed.manualReviews;

  const pricingRegions =
    pricingRegionRows && pricingRegionRows.length
      ? pricingRegionRows.map((row: any, index: number): PricingRegionRecord => ({
          id: String(row.id || `region-${index + 1}`),
          regionName: row.region_name || 'Unnamed Region',
          postalCodes: Array.isArray(row.postal_codes) ? row.postal_codes : String(row.postal_codes || '').split(',').map((code: string) => code.trim()).filter(Boolean),
          state: row.state || '-',
          country: row.country || 'Australia',
          activeStatus: row.active_status !== false,
          linkedBodyshops: Array.isArray(row.linked_bodyshops)
            ? row.linked_bodyshops
            : bodyshops.filter((shop) => shop.region.toLowerCase().includes(String(row.region_name || '').toLowerCase())).map((shop) => shop.id),
          pricingRuleReference: row.pricing_rule_reference || 'Pending linkage',
        }))
      : seed.pricingRegions;

  const bundle: AdminDataBundle = {
    ...seed,
    leads,
    bodyshops,
    owners,
    notificationSettings,
    notificationLogs,
    manualReviews,
    pricingRegions,
  };

  bundle.alerts = buildAlerts(bundle);

  if (leadRows && leadRows.length) {
    bundle.aiRuleInfo = {
      activeVersion: 'Connected to existing AI outputs',
      confidenceThreshold: 'Read from current analysis output stream',
      pdrCompatibility: 'Derived from current AI flags',
      pricingLogic: 'Existing Dent-Vision AI pricing logic (no new rule created)',
      status: 'Partially connected',
      connected: true,
    };
  }

  return cloneBundle(bundle);
};

export const createInitialAdminData = (): AdminDataBundle => cloneBundle(getMockData());

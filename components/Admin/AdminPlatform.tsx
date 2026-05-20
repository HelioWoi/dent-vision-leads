import React, { useEffect, useMemo, useState } from 'react';
import {
  AdminDataBundle,
  AdminIdentity,
  LeadRecord,
  NotificationLogRecord,
  createInitialAdminData,
  getAdminIdentity,
  loadAdminDataBundle,
  signOutAdmin,
} from '../../services/adminPlatformService';
import AdminLogin from './AdminLogin';
import DashboardPage from './pages/DashboardPage';
import LiveLeadsPage from './pages/LiveLeadsPage';
import BodyshopsPage from './pages/BodyshopsPage';
import OwnersPage from './pages/OwnersPage';
import NotificationsPage from './pages/NotificationsPage';
import AiRulesPage from './pages/AiRulesPage';
import PricingRegionsPage from './pages/PricingRegionsPage';
import ManualReviewsPage from './pages/ManualReviewsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import { AdminActionApi } from './AdminTypes';
import { NAV_ITEMS, ParsedAdminRoute, parseAdminRoute } from './adminUi';
import LeadDetailPage from './pages/LeadDetailPage';

type AdminPlatformProps = {
  route: string;
};

const initialIdentity: AdminIdentity = {
  isAuthenticated: false,
  isAdmin: false,
  source: 'none',
};

const AdminPlatform: React.FC<AdminPlatformProps> = ({ route }) => {
  const parsedRoute = parseAdminRoute(route);
  const [identity, setIdentity] = useState<AdminIdentity>(initialIdentity);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [data, setData] = useState<AdminDataBundle>(createInitialAdminData());

  const refreshIdentity = async () => {
    setIdentityLoading(true);
    const next = await getAdminIdentity();
    setIdentity(next);
    setIdentityLoading(false);
    return next;
  };

  const refreshData = async () => {
    setBusy(true);
    const bundle = await loadAdminDataBundle();
    setData(bundle);
    setBusy(false);
  };

  useEffect(() => {
    if (!parsedRoute.isAdminPath) return;
    void refreshIdentity();
  }, [parsedRoute.isAdminPath]);

  useEffect(() => {
    if (!parsedRoute.isAdminPath || parsedRoute.isLogin || !identity.isAdmin) return;
    void refreshData();
  }, [parsedRoute.isAdminPath, parsedRoute.isLogin, identity.isAdmin]);

  useEffect(() => {
    if (!parsedRoute.isAdminPath) return;
    if (identityLoading) return;

    if (!parsedRoute.isLogin && !identity.isAuthenticated) {
      window.location.hash = '#/admin/login';
      return;
    }

    if (parsedRoute.isLogin && identity.isAuthenticated && identity.isAdmin) {
      window.location.hash = '#/admin/dashboard';
    }
  }, [parsedRoute, identityLoading, identity]);

  useEffect(() => {
    setMobileOpen(false);
  }, [route]);

  const bodyshopMap = useMemo(() => {
    const map: Record<string, (typeof data.bodyshops)[number]> = {};
    data.bodyshops.forEach((shop) => {
      map[shop.id] = shop;
    });
    return map;
  }, [data.bodyshops]);

  const ownerMap = useMemo(() => {
    const map: Record<string, (typeof data.owners)[number]> = {};
    data.owners.forEach((owner) => {
      map[owner.id] = owner;
    });
    return map;
  }, [data.owners]);

  const openSection = (section: string) => {
    window.location.hash = `#/admin/${section}`;
  };

  const openLead = (leadId: string) => {
    window.location.hash = `#/admin/leads/${leadId}`;
  };

  const mutateLead = (leadId: string, updater: (lead: LeadRecord) => LeadRecord) => {
    setData((prev) => ({
      ...prev,
      leads: prev.leads.map((lead) => (lead.id === leadId ? updater(lead) : lead)),
    }));
  };

  const addNotificationLog = (entry: Omit<NotificationLogRecord, 'id' | 'sentAt'>) => {
    setData((prev) => ({
      ...prev,
      notificationLogs: [
        {
          id: `nlog-${Math.random().toString(36).slice(2, 8)}`,
          sentAt: new Date().toISOString(),
          ...entry,
        },
        ...prev.notificationLogs,
      ],
    }));
  };

  const sendLeadNotification = (lead: LeadRecord) => {
    const primaryShop = lead.matchedBodyshopIds[0] || data.bodyshops[0]?.id;
    const primaryOwner =
      data.notificationSettings.find((setting) => setting.bodyshopId === primaryShop)?.ownerId || data.owners[0]?.id || 'owner-missing';
    const channel = data.notificationSettings.find((setting) => setting.bodyshopId === primaryShop)?.primaryChannel || 'push';

    addNotificationLog({
      bodyshopId: primaryShop || 'shop-missing',
      ownerId: primaryOwner,
      leadId: lead.id,
      channel,
      status: 'sent',
      message: `New dent lead nearby. AI Estimate: $${lead.aiEstimateMin}-${lead.aiEstimateMax}. Respond within 1 minute.`,
    });

    mutateLead(lead.id, (current) => ({ ...current, status: 'sent_to_bodyshops' }));
  };

  const moveToManualReview = (lead: LeadRecord, reason = 'Admin moved to manual review') => {
    mutateLead(lead.id, (current) => ({ ...current, status: 'manual_review' }));
    setData((prev) => {
      if (prev.manualReviews.some((review) => review.leadId === lead.id && review.status !== 'resolved')) {
        return prev;
      }
      return {
        ...prev,
        manualReviews: [
          {
            id: `mreview-${Math.random().toString(36).slice(2, 8)}`,
            leadId: lead.id,
            reason,
            status: 'open',
            adminNote: '',
            createdAt: new Date().toISOString(),
          },
          ...prev.manualReviews,
        ],
      };
    });
  };

  const markLeadResolved = (lead: LeadRecord) => {
    mutateLead(lead.id, (current) => ({ ...current, status: 'booked' }));
  };

  const archiveLead = (lead: LeadRecord) => {
    mutateLead(lead.id, (current) => ({ ...current, archived: true }));
  };

  const assignLeadToTopShop = (lead: LeadRecord) => {
    const preferred = data.bodyshops.find((shop) => shop.activeStatus && shop.notificationEnabled) || data.bodyshops[0];
    if (!preferred) return;

    mutateLead(lead.id, (current) => {
      const matched = current.matchedBodyshopIds.includes(preferred.id)
        ? current.matchedBodyshopIds
        : [preferred.id, ...current.matchedBodyshopIds];
      return {
        ...current,
        matchedBodyshopIds: matched,
        status: 'sent_to_bodyshops',
      };
    });
  };

  const addInternalNote = (leadId: string, note: string) => {
    if (!note.trim()) return;
    mutateLead(leadId, (current) => ({
      ...current,
      internalNotes: [...current.internalNotes, note.trim()],
    }));
  };

  const actions: AdminActionApi = {
    openSection,
    openLead,
    mutateLead,
    sendLeadNotification,
    moveToManualReview,
    markLeadResolved,
    archiveLead,
    assignLeadToTopShop,
    addInternalNote,
    addNotificationLog,
    setData,
    refresh: refreshData,
  };

  const selectedLead = useMemo(() => data.leads.find((lead) => lead.id === parsedRoute.leadId), [data.leads, parsedRoute.leadId]);

  const renderSection = (routeInfo: ParsedAdminRoute) => {
    if (routeInfo.section === 'dashboard') return <DashboardPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    if (routeInfo.section === 'leads') {
      if (routeInfo.leadId) {
        return <LeadDetailPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} lead={selectedLead} />;
      }
      return <LiveLeadsPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    }
    if (routeInfo.section === 'bodyshops') return <BodyshopsPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    if (routeInfo.section === 'owners') return <OwnersPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    if (routeInfo.section === 'notifications') return <NotificationsPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    if (routeInfo.section === 'ai-rules') return <AiRulesPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    if (routeInfo.section === 'pricing-regions') return <PricingRegionsPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    if (routeInfo.section === 'manual-reviews') return <ManualReviewsPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    if (routeInfo.section === 'analytics') return <AnalyticsPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
    return <SettingsPage data={data} actions={actions} bodyshopMap={bodyshopMap} ownerMap={ownerMap} />;
  };

  if (!parsedRoute.isAdminPath) return null;

  if (parsedRoute.isLogin) return <AdminLogin />;

  if (identityLoading) {
    return (
      <div className="min-h-screen bg-[#ebf0ff] flex items-center justify-center text-[#273548] font-semibold">
        Verifying admin access...
      </div>
    );
  }

  if (!identity.isAuthenticated) return <AdminLogin />;

  if (!identity.isAdmin) {
    return (
      <div className="min-h-screen bg-[#ebf0ff] flex items-center justify-center px-4">
        <div className="max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-xl">
          <h2 className="text-xl font-bold text-[#111827]">Access Restricted</h2>
          <p className="mt-2 text-sm text-[#475569]">
            This account is authenticated but does not have admin permissions. Only users with role `admin` in `profiles` or `admin_users` can access this area.
          </p>
          <p className="mt-2 text-xs text-[#64748b]">{identity.error || 'Contact your system administrator to grant access.'}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await signOutAdmin();
                window.location.hash = '#/admin/login';
              }}
              className="rounded-lg bg-[#273548] px-4 py-2 text-sm font-semibold text-white"
            >
              Sign out
            </button>
            <a href="#/" className="rounded-lg border border-[#d7dff5] px-4 py-2 text-sm font-semibold text-[#273548]">
              Back to public flow
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef2ff]">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#273548] text-white p-5 transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="border-b border-white/15 pb-4">
            <p className="text-[11px] tracking-[0.22em] uppercase text-[#c8d4ff] font-semibold">Dent-Vision AI</p>
            <h1 className="mt-2 text-xl font-extrabold">Admin Mission Control</h1>
            <p className="mt-1 text-xs text-[#d8e2ff]">AI Operations Dashboard</p>
          </div>

          <nav className="mt-5 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = parsedRoute.section === item.key && !(parsedRoute.leadId && item.key === 'dashboard');
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => (window.location.hash = item.href)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-white text-[#273548]' : 'text-[#d6dffb] hover:bg-white/10 hover:text-white'}`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-[#d6dffb]">
            <p className="font-semibold">Logged in</p>
            <p className="mt-1 break-all">{identity.email}</p>
            <button
              type="button"
              onClick={async () => {
                await signOutAdmin();
                window.location.hash = '#/admin/login';
              }}
              className="mt-3 rounded-lg bg-white px-3 py-1.5 font-semibold text-[#273548]"
            >
              Sign Out
            </button>
          </div>
        </aside>

        <div className="flex-1 lg:ml-72">
          <header className="sticky top-0 z-30 border-b border-[#d9e2ff] bg-white/95 backdrop-blur px-4 py-3 lg:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-[#d7dff5] px-2 py-1 text-sm font-semibold text-[#273548] lg:hidden"
                  onClick={() => setMobileOpen((prev) => !prev)}
                >
                  ☰
                </button>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#64748b] font-bold">Admin Area</p>
                  <h2 className="text-base font-bold text-[#111827]">
                    {parsedRoute.leadId ? `Lead Detail · ${parsedRoute.leadId}` : NAV_ITEMS.find((item) => item.key === parsedRoute.section)?.label || 'Dashboard'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-[#d7dff5] px-3 py-1.5 text-sm font-semibold text-[#273548] hover:bg-[#f3f6ff]"
                onClick={() => refreshData()}
              >
                {busy ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </header>

          <main className="p-4 lg:p-6">{renderSection(parsedRoute)}</main>
        </div>
      </div>
    </div>
  );
};

export default AdminPlatform;

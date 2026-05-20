import React, { useMemo } from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, StatCard, capitalizeWords, formatTime, levelClassName, statusClassName } from '../adminUi';

const DashboardPage: React.FC<CommonPageProps> = ({ data, actions }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const leadsToday = data.leads.filter((lead) => {
      const created = new Date(lead.createdAt);
      return (
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth() &&
        created.getDate() === now.getDate()
      );
    }).length;

    const pending = data.leads.filter((lead) => ['new', 'ai_analyzed', 'sent_to_bodyshops', 'bodyshop_reviewing'].includes(lead.status)).length;
    const online = data.bodyshops.filter((shop) => shop.online).length;

    const responseTimes = data.bodyshops.map((shop) => shop.averageResponseTimeMinutes).filter((value) => value > 0);
    const averageResponse = responseTimes.length
      ? `${Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)} min`
      : '—';

    const quotesAccepted = data.leads.filter((lead) => lead.status === 'booked').length;
    const noResponses = data.leads.filter((lead) => lead.status === 'no_response').length;
    const manualReviews = data.leads.filter((lead) => lead.status === 'manual_review').length;

    const repairVolume = data.leads.reduce((sum, lead) => sum + lead.aiEstimateMax, 0);

    return {
      leadsToday,
      pending,
      online,
      averageResponse,
      quotesAccepted,
      noResponses,
      manualReviews,
      repairVolume,
    };
  }, [data]);

  const latestLeads = useMemo(
    () => [...data.leads].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6),
    [data.leads]
  );

  const recentResponses = useMemo(
    () =>
      data.leads
        .flatMap((lead) =>
          lead.responses.map((response) => ({
            leadId: lead.id,
            customerName: lead.customerName,
            ...response,
          }))
        )
        .slice(0, 6),
    [data.leads]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Leads Today" value={String(stats.leadsToday)} />
        <StatCard label="Pending Leads" value={String(stats.pending)} hint="Awaiting response or review" />
        <StatCard label="Bodyshops Online" value={String(stats.online)} />
        <StatCard label="Average Response Time" value={stats.averageResponse} />
        <StatCard label="Quotes Accepted" value={String(stats.quotesAccepted)} />
        <StatCard label="No Response Leads" value={String(stats.noResponses)} />
        <StatCard label="Manual Review Leads" value={String(stats.manualReviews)} />
        <StatCard label="Estimated Repair Volume" value={`$${stats.repairVolume.toLocaleString('en-AU')}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <PanelCard title="Recent Lead Activity">
          <div className="space-y-3">
            {latestLeads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => actions.openLead(lead.id)}
                className="w-full rounded-xl border border-[#e6ebff] bg-[#f9fbff] p-3 text-left hover:border-[#c9d5ff] transition-colors"
              >
                <p className="text-sm font-semibold text-[#111827]">{lead.customerName} · {lead.region}</p>
                <p className="mt-1 text-xs text-[#64748b]">{lead.id} · {formatTime(lead.createdAt)}</p>
                <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassName(lead.status)}`}>
                  {capitalizeWords(lead.status)}
                </span>
              </button>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Recent Bodyshop Responses">
          <div className="space-y-3">
            {recentResponses.length === 0 ? <p className="text-sm text-[#64748b]">No responses captured yet.</p> : null}
            {recentResponses.map((entry, index) => (
              <div key={`${entry.leadId}-${entry.bodyshopId}-${index}`} className="rounded-xl border border-[#e6ebff] p-3">
                <p className="text-sm font-semibold text-[#111827]">{entry.bodyshopName}</p>
                <p className="text-xs text-[#64748b]">Lead {entry.leadId} · {entry.customerName}</p>
                <p className="mt-1 text-xs text-[#273548]">Status: {capitalizeWords(entry.status)}</p>
                {typeof entry.quoteMin === 'number' && typeof entry.quoteMax === 'number' ? (
                  <p className="text-xs text-[#4f46e5] font-semibold">Quote: ${entry.quoteMin} - ${entry.quoteMax}</p>
                ) : null}
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="System Alerts">
          <div className="space-y-3">
            {data.alerts.map((alert) => (
              <div key={alert.id} className={`rounded-xl border px-3 py-2 text-sm font-medium ${levelClassName(alert.level)}`}>
                {alert.message}
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </div>
  );
};

export default DashboardPage;

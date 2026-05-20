import React from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, StatCard, percent } from '../adminUi';

const AnalyticsPage: React.FC<CommonPageProps> = ({ data }) => {
  const totalLeads = data.leads.length;
  const quoted = data.leads.filter((lead) => lead.status === 'quoted' || lead.status === 'booked').length;
  const booked = data.leads.filter((lead) => lead.status === 'booked').length;
  const noResponse = data.leads.filter((lead) => lead.status === 'no_response').length;
  const manualReview = data.leads.filter((lead) => lead.status === 'manual_review').length;

  const avgAiEstimate = totalLeads
    ? Math.round(data.leads.reduce((sum, lead) => sum + (lead.aiEstimateMin + lead.aiEstimateMax) / 2, 0) / totalLeads)
    : 0;

  const quotes = data.leads.flatMap((lead) => lead.responses.map((response) => ({ lead, response })));
  const quoteValues = quotes
    .filter((item) => typeof item.response.quoteMin === 'number' && typeof item.response.quoteMax === 'number')
    .map((item) => ((item.response.quoteMin || 0) + (item.response.quoteMax || 0)) / 2);
  const avgFinalQuote = quoteValues.length ? Math.round(quoteValues.reduce((sum, value) => sum + value, 0) / quoteValues.length) : 0;

  const bodyshopPerformance = [...data.bodyshops].sort((a, b) => b.acceptanceRate - a.acceptanceRate);
  const fastestBodyshops = [...data.bodyshops]
    .filter((shop) => shop.averageResponseTimeMinutes > 0)
    .sort((a, b) => a.averageResponseTimeMinutes - b.averageResponseTimeMinutes);

  const regionCounts = data.leads.reduce<Record<string, number>>((acc, lead) => {
    acc[lead.region] = (acc[lead.region] || 0) + 1;
    return acc;
  }, {});

  const rejectedReasons = {
    noResponse,
    nonPdr: data.leads.filter((lead) => lead.aiDamageCategory.toLowerCase().includes('non-pdr') || lead.aiDamageCategory.toLowerCase().includes('low confidence')).length,
    rejectedByShops: data.leads.filter((lead) => lead.status === 'rejected_by_shops').length,
  };

  const maxRegionCount = Math.max(1, ...Object.values(regionCounts));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Leads" value={String(totalLeads)} />
        <StatCard label="Quote Response Rate" value={totalLeads ? percent(quoted / totalLeads) : '0%'} />
        <StatCard label="Booking Conversion" value={totalLeads ? percent(booked / totalLeads) : '0%'} />
        <StatCard label="No-Response Rate" value={totalLeads ? percent(noResponse / totalLeads) : '0%'} />
        <StatCard label="Average AI Estimate" value={`$${avgAiEstimate}`} />
        <StatCard label="Average Final Quote" value={`$${avgFinalQuote}`} />
        <StatCard label="Manual Review Volume" value={String(manualReview)} />
        <StatCard label="Active Regions" value={String(Object.keys(regionCounts).length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <PanelCard title="Best Performing Bodyshops">
          <div className="space-y-3">
            {bodyshopPerformance.slice(0, 5).map((shop) => (
              <div key={shop.id} className="rounded-xl border border-[#e2e8f0] p-3">
                <p className="text-sm font-semibold text-[#111827]">{shop.businessName}</p>
                <p className="text-xs text-[#64748b]">Acceptance rate {percent(shop.acceptanceRate)}</p>
                <div className="mt-1 h-2 rounded-full bg-[#e6ebff]">
                  <div className="h-2 rounded-full bg-gradient-to-r from-[#4f46e5] to-[#22c55e]" style={{ width: `${Math.round(shop.acceptanceRate * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Fastest Responding Bodyshops">
          <div className="space-y-3">
            {fastestBodyshops.slice(0, 5).map((shop) => (
              <div key={shop.id} className="rounded-xl border border-[#e2e8f0] p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{shop.businessName}</p>
                  <p className="text-xs text-[#64748b]">{shop.region}</p>
                </div>
                <p className="text-sm font-bold text-[#4f46e5]">{shop.averageResponseTimeMinutes} min</p>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Region Coverage">
          <div className="space-y-3">
            {Object.entries(regionCounts).map(([region, count]) => (
              <div key={region}>
                <div className="flex items-center justify-between text-sm text-[#334155]">
                  <span>{region}</span>
                  <span>{count} leads</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#e6ebff]">
                  <div className="h-2 rounded-full bg-gradient-to-r from-[#4f46e5] to-[#f59e0b]" style={{ width: `${Math.round((count / maxRegionCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      <PanelCard title="Rejected Lead Reasons">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm">
            <p className="font-semibold text-[#111827]">No response from shops</p>
            <p className="text-2xl font-extrabold text-[#4f46e5] mt-1">{rejectedReasons.noResponse}</p>
          </div>
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm">
            <p className="font-semibold text-[#111827]">Non-PDR / low confidence</p>
            <p className="text-2xl font-extrabold text-[#4f46e5] mt-1">{rejectedReasons.nonPdr}</p>
          </div>
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm">
            <p className="font-semibold text-[#111827]">Rejected by shops</p>
            <p className="text-2xl font-extrabold text-[#4f46e5] mt-1">{rejectedReasons.rejectedByShops}</p>
          </div>
        </div>
      </PanelCard>
    </div>
  );
};

export default AnalyticsPage;

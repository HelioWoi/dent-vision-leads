import React, { useMemo, useState } from 'react';
import { LeadStatus } from '../../../services/adminPlatformService';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, STATUS_ORDER, capitalizeWords, percent, statusClassName } from '../adminUi';

const LiveLeadsPage: React.FC<CommonPageProps> = ({ data, actions, bodyshopMap }) => {
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | LeadStatus>('all');

  const filteredLeads = useMemo(() => {
    return data.leads
      .filter((lead) => !lead.archived)
      .filter((lead) => (leadStatusFilter === 'all' ? true : lead.status === leadStatusFilter))
      .filter((lead) => {
        if (!leadSearch.trim()) return true;
        const query = leadSearch.toLowerCase();
        return (
          lead.customerName.toLowerCase().includes(query) ||
          lead.customerEmail.toLowerCase().includes(query) ||
          lead.id.toLowerCase().includes(query) ||
          lead.postalCode.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [data.leads, leadSearch, leadStatusFilter]);

  return (
    <div className="space-y-6">
      <PanelCard
        title="Live Lead Management"
        action={
          <button
            type="button"
            className="rounded-lg border border-[#d9e2ff] px-3 py-1.5 text-xs font-semibold text-[#273548] hover:bg-[#f3f6ff]"
            onClick={() => actions.refresh()}
          >
            Refresh
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm outline-none focus:border-[#4f46e5]"
            placeholder="Search customer, email, lead id"
          />
          <select
            value={leadStatusFilter}
            onChange={(e) => setLeadStatusFilter(e.target.value as 'all' | LeadStatus)}
            className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm outline-none focus:border-[#4f46e5]"
          >
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{capitalizeWords(status)}</option>
            ))}
          </select>
          <div className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm text-[#64748b] flex items-center">
            {filteredLeads.length} active leads
          </div>
        </div>
      </PanelCard>

      <div className="overflow-hidden rounded-2xl border border-[#d9e2ff] bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.8)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-[#f3f6ff] text-xs uppercase tracking-[0.08em] text-[#475569]">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">AI Estimate</th>
                <th className="px-4 py-3">Damage</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Matched Shops</th>
                <th className="px-4 py-3">Responses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-t border-[#eef2ff] align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#111827]">{lead.id}</p>
                    <p className="text-xs text-[#64748b]">{new Date(lead.createdAt).toLocaleString('en-AU')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#111827]">{lead.customerName}</p>
                    <p className="text-xs text-[#64748b]">{lead.customerEmail}</p>
                    <p className="text-xs text-[#64748b]">{lead.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-[#334155]">
                    <p>{lead.region}</p>
                    <p className="text-xs text-[#64748b]">{lead.postalCode}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#111827]">${lead.aiEstimateMin} - ${lead.aiEstimateMax}</td>
                  <td className="px-4 py-3">
                    <p className="text-[#111827]">{lead.aiDamageCategory}</p>
                    <p className="text-xs text-[#64748b]">{lead.dentCount} dents · {lead.damageLocation}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-2 w-28 rounded-full bg-[#e5eafc]">
                      <div className="h-2 rounded-full bg-gradient-to-r from-[#4f46e5] to-[#f59e0b]" style={{ width: `${Math.round(lead.confidenceScore * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#334155]">{percent(lead.confidenceScore)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#475569]">
                    {lead.matchedBodyshopIds.map((shopId) => bodyshopMap[shopId]?.businessName || shopId).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#475569]">{lead.responses.length} responses</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassName(lead.status)}`}>
                      {capitalizeWords(lead.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => actions.openLead(lead.id)} className="rounded-md bg-[#273548] px-2.5 py-1 text-xs font-semibold text-white">View</button>
                      <button type="button" onClick={() => actions.sendLeadNotification(lead)} className="rounded-md border border-[#cfd9ff] px-2.5 py-1 text-xs font-semibold text-[#273548]">Resend</button>
                      <button type="button" onClick={() => actions.assignLeadToTopShop(lead)} className="rounded-md border border-[#cfd9ff] px-2.5 py-1 text-xs font-semibold text-[#273548]">Assign</button>
                      <button type="button" onClick={() => actions.moveToManualReview(lead, 'Escalated by admin from live leads')} className="rounded-md border border-[#f5c98f] bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#9a3412]">Manual</button>
                      <button type="button" onClick={() => actions.markLeadResolved(lead)} className="rounded-md border border-[#9ae6b4] bg-[#ecfdf3] px-2.5 py-1 text-xs font-semibold text-[#166534]">Resolved</button>
                      <button type="button" onClick={() => actions.archiveLead(lead)} className="rounded-md border border-[#e2e8f0] px-2.5 py-1 text-xs font-semibold text-[#475569]">Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LiveLeadsPage;

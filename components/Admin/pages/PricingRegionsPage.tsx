import React from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard } from '../adminUi';

const PricingRegionsPage: React.FC<CommonPageProps> = ({ data, actions, bodyshopMap }) => {
  return (
    <div className="space-y-6">
      <PanelCard
        title="Pricing Regions"
        action={
          <button
            type="button"
            onClick={() => {
              const regionName = window.prompt('Region name');
              if (!regionName) return;
              actions.setData((prev) => ({
                ...prev,
                pricingRegions: [
                  {
                    id: `region-${Math.random().toString(36).slice(2, 8)}`,
                    regionName,
                    postalCodes: [],
                    state: 'QLD',
                    country: 'Australia',
                    activeStatus: true,
                    linkedBodyshops: [],
                    pricingRuleReference: 'Pending reference',
                  },
                  ...prev.pricingRegions,
                ],
              }));
            }}
            className="rounded-lg bg-[#273548] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Create Region
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#f3f6ff] text-xs uppercase tracking-[0.08em] text-[#475569]">
              <tr>
                <th className="px-3 py-2">Region</th>
                <th className="px-3 py-2">Postal Codes</th>
                <th className="px-3 py-2">State/Country</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Linked Bodyshops</th>
                <th className="px-3 py-2">Rule Ref</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.pricingRegions.map((region) => (
                <tr key={region.id} className="border-t border-[#eef2ff]">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-[#111827]">{region.regionName}</p>
                    <p className="text-xs text-[#64748b]">{region.id}</p>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{region.postalCodes.length ? region.postalCodes.join(', ') : '—'}</td>
                  <td className="px-3 py-3 text-[#334155]">{region.state}, {region.country}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${region.activeStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {region.activeStatus ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{region.linkedBodyshops.map((id) => bodyshopMap[id]?.businessName || id).join(', ') || 'None'}</td>
                  <td className="px-3 py-3 text-[#334155]">{region.pricingRuleReference}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => actions.setData((prev) => ({ ...prev, pricingRegions: prev.pricingRegions.map((item) => item.id === region.id ? { ...item, activeStatus: !item.activeStatus } : item) }))} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Edit</button>
                      <button type="button" onClick={() => actions.setData((prev) => ({ ...prev, pricingRegions: prev.pricingRegions.map((item) => item.id === region.id ? { ...item, linkedBodyshops: prev.bodyshops.slice(0, 2).map((shop) => shop.id) } : item) }))} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Link Bodyshops</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
};

export default PricingRegionsPage;

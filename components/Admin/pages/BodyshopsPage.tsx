import React from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, percent } from '../adminUi';

const BodyshopsPage: React.FC<CommonPageProps> = ({ data, actions }) => {
  return (
    <div className="space-y-6">
      <PanelCard
        title="Bodyshops"
        action={
          <button
            type="button"
            onClick={() => {
              const name = window.prompt('Business name');
              if (!name) return;
              actions.setData((prev) => ({
                ...prev,
                bodyshops: [
                  {
                    id: `shop-${Math.random().toString(36).slice(2, 8)}`,
                    businessName: name,
                    ownerName: 'Unassigned',
                    email: 'pending@shop.local',
                    phone: '-',
                    address: '-',
                    postalCode: '-',
                    serviceRadius: 15,
                    region: 'Unassigned',
                    latitude: 0,
                    longitude: 0,
                    verifiedStatus: false,
                    activeStatus: true,
                    notificationEnabled: true,
                    responsePerformance: 'good',
                    totalLeadsReceived: 0,
                    acceptanceRate: 0,
                    averageResponseTimeMinutes: 0,
                    online: false,
                  },
                  ...prev.bodyshops,
                ],
              }));
            }}
            className="rounded-lg bg-[#273548] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Create Bodyshop
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-[#f3f6ff] text-xs uppercase tracking-[0.08em] text-[#475569]">
              <tr>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">Region</th>
                <th className="px-3 py-2">Verified</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Performance</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.bodyshops.map((shop) => (
                <tr key={shop.id} className="border-t border-[#eef2ff]">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-[#111827]">{shop.businessName}</p>
                    <p className="text-xs text-[#64748b]">ID: {shop.id}</p>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{shop.ownerName}</td>
                  <td className="px-3 py-3 text-[#334155]">
                    <p>{shop.email}</p>
                    <p className="text-xs text-[#64748b]">{shop.phone}</p>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">
                    <p>{shop.address}</p>
                    <p className="text-xs text-[#64748b]">{shop.postalCode}</p>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{shop.region}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${shop.verifiedStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {shop.verifiedStatus ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${shop.activeStatus ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>
                      {shop.activeStatus ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">
                    <p className="text-xs">Leads: {shop.totalLeadsReceived}</p>
                    <p className="text-xs">Acceptance: {percent(shop.acceptanceRate)}</p>
                    <p className="text-xs">Avg response: {shop.averageResponseTimeMinutes} min</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => actions.setData((prev) => ({ ...prev, bodyshops: prev.bodyshops.map((item) => item.id === shop.id ? { ...item, verifiedStatus: true } : item) }))} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Verify</button>
                      <button type="button" onClick={() => actions.setData((prev) => ({ ...prev, bodyshops: prev.bodyshops.map((item) => item.id === shop.id ? { ...item, activeStatus: !item.activeStatus } : item) }))} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Deactivate</button>
                      <button type="button" onClick={() => actions.addNotificationLog({ bodyshopId: shop.id, ownerId: data.owners.find((owner) => owner.bodyshopId === shop.id)?.id || data.owners[0]?.id || 'unknown-owner', leadId: data.leads[0]?.id || 'test-lead', channel: 'push', status: 'sent', message: `Test notification sent to ${shop.businessName}` })} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Test Notification</button>
                      <button type="button" onClick={() => actions.openSection('owners')} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Assign Owner</button>
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

export default BodyshopsPage;

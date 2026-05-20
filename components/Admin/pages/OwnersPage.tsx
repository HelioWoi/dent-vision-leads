import React from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, capitalizeWords, formatTime } from '../adminUi';

const OwnersPage: React.FC<CommonPageProps> = ({ data, actions, bodyshopMap }) => {
  return (
    <div className="space-y-6">
      <PanelCard
        title="Bodyshop Owners"
        action={
          <button
            type="button"
            onClick={() => {
              const name = window.prompt('Owner name');
              const email = window.prompt('Owner email');
              if (!name || !email) return;
              actions.setData((prev) => ({
                ...prev,
                owners: [
                  {
                    id: `owner-${Math.random().toString(36).slice(2, 8)}`,
                    bodyshopId: prev.bodyshops[0]?.id || 'unassigned-shop',
                    name,
                    email,
                    phone: '-',
                    role: 'owner',
                    notificationPreference: 'push',
                    lastLogin: new Date().toISOString(),
                    activeStatus: true,
                  },
                  ...prev.owners,
                ],
              }));
            }}
            className="rounded-lg bg-[#273548] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Create Owner
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-[#f3f6ff] text-xs uppercase tracking-[0.08em] text-[#475569]">
              <tr>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Linked Bodyshop</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Preference</th>
                <th className="px-3 py-2">Last Login</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.owners.map((owner) => (
                <tr key={owner.id} className="border-t border-[#eef2ff]">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-[#111827]">{owner.name}</p>
                    <p className="text-xs text-[#64748b]">{owner.id}</p>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">
                    <p>{owner.email}</p>
                    <p className="text-xs text-[#64748b]">{owner.phone}</p>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{bodyshopMap[owner.bodyshopId]?.businessName || owner.bodyshopId}</td>
                  <td className="px-3 py-3 text-[#334155]">{capitalizeWords(owner.role)}</td>
                  <td className="px-3 py-3 text-[#334155]">{capitalizeWords(owner.notificationPreference)}</td>
                  <td className="px-3 py-3 text-[#334155]">{formatTime(owner.lastLogin)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${owner.activeStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {owner.activeStatus ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => actions.addNotificationLog({ bodyshopId: owner.bodyshopId, ownerId: owner.id, leadId: data.leads[0]?.id || 'invite-lead', channel: 'email', status: 'sent', message: `Invitation sent to ${owner.email}` })} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Invite</button>
                      <button type="button" onClick={() => actions.addNotificationLog({ bodyshopId: owner.bodyshopId, ownerId: owner.id, leadId: data.leads[0]?.id || 'access-reset', channel: 'email', status: 'sent', message: `Access reset email sent to ${owner.email}` })} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Reset Access</button>
                      <button type="button" onClick={() => actions.setData((prev) => ({ ...prev, owners: prev.owners.map((item) => item.id === owner.id ? { ...item, activeStatus: !item.activeStatus } : item) }))} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Deactivate</button>
                      <button type="button" onClick={() => actions.setData((prev) => ({ ...prev, owners: prev.owners.map((item) => item.id === owner.id ? { ...item, notificationPreference: item.notificationPreference === 'push' ? 'sms' : 'push' } : item) }))} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Update Preference</button>
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

export default OwnersPage;

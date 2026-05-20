import React from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard } from '../adminUi';

const SettingsPage: React.FC<CommonPageProps> = ({ actions }) => {
  return (
    <div className="space-y-6">
      <PanelCard title="Settings">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <p className="text-sm font-semibold text-[#111827]">Admin Profile</p>
            <input className="mt-2 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="Dent-Vision Ops Admin" />
            <input className="mt-2 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="ops@dentvision.ai" />
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <p className="text-sm font-semibold text-[#111827]">Company Settings</p>
            <input className="mt-2 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="Dent-Vision AI" />
            <input className="mt-2 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="Australia" />
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <p className="text-sm font-semibold text-[#111827]">Notification Defaults</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Push enabled</label>
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> SMS enabled</label>
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Email enabled</label>
              <label className="flex items-center gap-2"><input type="checkbox" /> WhatsApp placeholder</label>
            </div>
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <p className="text-sm font-semibold text-[#111827]">Operational Defaults</p>
            <label className="text-xs uppercase tracking-[0.1em] text-[#64748b]">Default response time (seconds)</label>
            <input className="mt-1 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="60" />
            <label className="mt-3 block text-xs uppercase tracking-[0.1em] text-[#64748b]">Lead expiry time (minutes)</label>
            <input className="mt-1 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="30" />
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 md:col-span-2">
            <p className="text-sm font-semibold text-[#111827]">Customer Disclaimer Text</p>
            <textarea rows={3} className="mt-2 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="AI estimate is a preliminary range and final pricing is confirmed by the selected bodyshop." />
            <p className="mt-3 text-sm font-semibold text-[#111827]">Footer Legal Text</p>
            <textarea rows={3} className="mt-2 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="Dent-Vision AI connects customers with repair partners. Terms and privacy apply." />
            <p className="mt-3 text-sm font-semibold text-[#111827]">Bodyshop Terms Text</p>
            <textarea rows={3} className="mt-2 w-full rounded-lg border border-[#d7dff5] px-3 py-2 text-sm" defaultValue="Bodyshops must respond within SLA and keep availability accurate." />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-lg bg-[#273548] px-4 py-2 text-sm font-semibold text-white">Save Settings</button>
          <button type="button" className="rounded-lg border border-[#d7dff5] px-4 py-2 text-sm font-semibold text-[#273548]">Reset Draft</button>
          <button type="button" onClick={() => actions.refresh()} className="rounded-lg border border-[#d7dff5] px-4 py-2 text-sm font-semibold text-[#273548]">Reload from source</button>
        </div>
      </PanelCard>
    </div>
  );
};

export default SettingsPage;

import React from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, capitalizeWords, formatTime } from '../adminUi';

const NotificationsPage: React.FC<CommonPageProps> = ({ data, actions, bodyshopMap, ownerMap }) => {
  return (
    <div className="space-y-6">
      <PanelCard title="Notification Control Center">
        <p className="text-sm text-[#475569] mb-4">
          Control channel delivery, priority routing, response SLA, and retries per bodyshop owner. Push/SMS/email integrations are integration-ready placeholders where providers are not configured.
        </p>

        <div className="grid gap-4 xl:grid-cols-2">
          {data.notificationSettings.map((setting) => {
            const owner = ownerMap[setting.ownerId];
            const bodyshop = bodyshopMap[setting.bodyshopId];

            return (
              <div key={setting.id} className="rounded-xl border border-[#dbe4ff] bg-[#f9fbff] p-4">
                <p className="text-sm font-semibold text-[#111827]">{bodyshop?.businessName || setting.bodyshopId}</p>
                <p className="text-xs text-[#64748b]">Owner: {owner?.name || setting.ownerId}</p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['Push', 'pushEnabled'],
                    ['SMS', 'smsEnabled'],
                    ['Email', 'emailEnabled'],
                    ['WhatsApp', 'whatsappEnabled'],
                    ['Dashboard', 'dashboardEnabled'],
                  ].map(([label, key]) => {
                    const typedKey = key as keyof typeof setting;
                    return (
                      <label key={key} className="flex items-center justify-between rounded-lg border border-[#d9e2ff] bg-white px-2 py-1.5">
                        <span>{label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(setting[typedKey])}
                          onChange={(event) =>
                            actions.setData((prev) => ({
                              ...prev,
                              notificationSettings: prev.notificationSettings.map((item) =>
                                item.id === setting.id ? { ...item, [typedKey]: event.target.checked } : item
                              ),
                            }))
                          }
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select
                    value={setting.primaryChannel}
                    onChange={(event) =>
                      actions.setData((prev) => ({
                        ...prev,
                        notificationSettings: prev.notificationSettings.map((item) =>
                          item.id === setting.id ? { ...item, primaryChannel: event.target.value as typeof item.primaryChannel } : item
                        ),
                      }))
                    }
                    className="rounded-lg border border-[#d7dff5] px-2 py-1.5 text-sm"
                  >
                    <option value="push">Primary: Push</option>
                    <option value="sms">Primary: SMS</option>
                    <option value="email">Primary: Email</option>
                    <option value="dashboard">Primary: Dashboard</option>
                  </select>
                  <select
                    value={setting.backupChannel}
                    onChange={(event) =>
                      actions.setData((prev) => ({
                        ...prev,
                        notificationSettings: prev.notificationSettings.map((item) =>
                          item.id === setting.id ? { ...item, backupChannel: event.target.value as typeof item.backupChannel } : item
                        ),
                      }))
                    }
                    className="rounded-lg border border-[#d7dff5] px-2 py-1.5 text-sm"
                  >
                    <option value="push">Backup: Push</option>
                    <option value="sms">Backup: SMS</option>
                    <option value="email">Backup: Email</option>
                    <option value="dashboard">Backup: Dashboard</option>
                  </select>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#475569]">
                  <div className="rounded-lg border border-[#e2e8f0] bg-white px-2 py-2">Response deadline: {setting.responseDeadlineSeconds}s</div>
                  <div className="rounded-lg border border-[#e2e8f0] bg-white px-2 py-2">Radius: {setting.notificationRadiusKm} km</div>
                </div>

                <p className="mt-2 text-xs text-[#64748b]">Retry logic: {setting.retryLogic}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      actions.addNotificationLog({
                        bodyshopId: setting.bodyshopId,
                        ownerId: setting.ownerId,
                        leadId: data.leads[0]?.id || 'test-lead',
                        channel: setting.primaryChannel,
                        status: 'sent',
                        message: `Test notification via ${setting.primaryChannel.toUpperCase()} channel.`,
                      })
                    }
                    className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]"
                  >
                    Send Test
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      actions.addNotificationLog({
                        bodyshopId: setting.bodyshopId,
                        ownerId: setting.ownerId,
                        leadId: data.leads[0]?.id || 'retry-lead',
                        channel: setting.backupChannel,
                        status: 'queued',
                        message: 'Lead notification resent from admin center.',
                      })
                    }
                    className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]"
                  >
                    Resend Lead Notification
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </PanelCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <PanelCard title="Notification Templates">
          <div className="space-y-3 text-sm text-[#334155]">
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <p className="font-semibold text-[#111827]">New Lead</p>
              <p>“New dent lead nearby. AI Estimate: $320. Respond within 1 minute.”</p>
            </div>
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <p className="font-semibold text-[#111827]">Reminder</p>
              <p>“You have a pending Dent-Vision AI lead waiting for response.”</p>
            </div>
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <p className="font-semibold text-[#111827]">Accepted</p>
              <p>“Your quote has been sent to the customer.”</p>
            </div>
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <p className="font-semibold text-[#111827]">Rejected</p>
              <p>“Lead rejected and removed from customer options.”</p>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Notification Logs & Delivery Status">
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {data.notificationLogs.slice(0, 30).map((log) => (
              <div key={log.id} className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm">
                <p className="font-semibold text-[#111827]">{log.channel.toUpperCase()} · {capitalizeWords(log.status)}</p>
                <p className="text-xs text-[#64748b]">Lead: {log.leadId} · {formatTime(log.sentAt)}</p>
                <p className="mt-1 text-xs text-[#334155]">{log.message}</p>
                {log.failedReason ? <p className="mt-1 text-xs text-rose-600">Failure: {log.failedReason}</p> : null}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#64748b]">TODO: connect OneSignal/Firebase/Twilio transport adapters when credentials are available.</p>
        </PanelCard>
      </div>
    </div>
  );
};

export default NotificationsPage;

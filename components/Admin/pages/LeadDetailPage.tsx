import React, { useState } from 'react';
import { LeadRecord } from '../../../services/adminPlatformService';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, STATUS_ORDER, capitalizeWords, percent, statusClassName } from '../adminUi';

type LeadDetailPageProps = CommonPageProps & {
  lead?: LeadRecord;
};

const LeadDetailPage: React.FC<LeadDetailPageProps> = ({ data, actions, lead }) => {
  const [noteDraft, setNoteDraft] = useState('');

  if (!lead) {
    return (
      <PanelCard title="Lead Detail">
        <p className="text-sm text-[#64748b]">Lead not found.</p>
        <button
          type="button"
          onClick={() => actions.openSection('leads')}
          className="mt-3 rounded-lg bg-[#273548] px-3 py-2 text-sm font-semibold text-white"
        >
          Back to Live Leads
        </button>
      </PanelCard>
    );
  }

  const quoteEntries = lead.responses.filter((response) => typeof response.quoteMin === 'number' && typeof response.quoteMax === 'number');

  return (
    <div className="space-y-6">
      <PanelCard
        title={`Lead Detail · ${lead.id}`}
        action={
          <button
            type="button"
            className="rounded-lg border border-[#d9e2ff] px-3 py-1.5 text-xs font-semibold text-[#273548]"
            onClick={() => actions.openSection('leads')}
          >
            Back to leads
          </button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[#e5ebff] bg-[#f8faff] p-4">
            <p className="text-xs font-bold tracking-[0.08em] text-[#4f46e5] uppercase">Customer</p>
            <p className="mt-2 text-sm font-semibold text-[#111827]">{lead.customerName}</p>
            <p className="text-sm text-[#475569]">{lead.customerEmail}</p>
            <p className="text-sm text-[#475569]">{lead.customerPhone}</p>
            <p className="mt-2 text-xs text-[#64748b]">{lead.region} · {lead.postalCode}</p>
          </div>

          <div className="rounded-xl border border-[#e5ebff] bg-[#f8faff] p-4">
            <p className="text-xs font-bold tracking-[0.08em] text-[#4f46e5] uppercase">AI Analysis</p>
            <p className="mt-2 text-sm text-[#111827]">Category: <span className="font-semibold">{lead.aiDamageCategory}</span></p>
            <p className="text-sm text-[#111827]">Estimate: <span className="font-semibold">${lead.aiEstimateMin} - ${lead.aiEstimateMax}</span></p>
            <p className="text-sm text-[#111827]">Dent quantity: <span className="font-semibold">{lead.dentCount}</span></p>
            <p className="text-sm text-[#111827]">Dent size: <span className="font-semibold">{lead.dentSize}</span></p>
            <p className="text-sm text-[#111827]">Panel location: <span className="font-semibold">{lead.damageLocation}</span></p>
            <p className="mt-1 text-xs text-[#64748b]">Confidence: {percent(lead.confidenceScore)}</p>
          </div>

          <div className="rounded-xl border border-[#e5ebff] bg-[#f8faff] p-4">
            <p className="text-xs font-bold tracking-[0.08em] text-[#4f46e5] uppercase">Current Outcome</p>
            <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClassName(lead.status)}`}>
              {capitalizeWords(lead.status)}
            </span>
            <p className="mt-2 text-sm text-[#475569]">Matched bodyshops: {lead.matchedBodyshopIds.length}</p>
            <p className="text-sm text-[#475569]">Bodyshop responses: {lead.responses.length}</p>
            <p className="text-sm text-[#475569]">Created: {new Date(lead.createdAt).toLocaleString('en-AU')}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {lead.photoUrls.map((url) => (
            <div key={url} className="overflow-hidden rounded-xl border border-[#dde5ff] bg-white">
              <img src={url} alt="Damage upload" className="h-44 w-full object-cover" />
            </div>
          ))}
        </div>
      </PanelCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <PanelCard title="Response Timeline">
          <div className="space-y-3">
            {lead.responses.length === 0 ? <p className="text-sm text-[#64748b]">No bodyshop response events yet.</p> : null}
            {lead.responses.map((response, index) => (
              <div key={`${response.bodyshopId}-${index}`} className="rounded-xl border border-[#e6ebff] p-3">
                <p className="text-sm font-semibold text-[#111827]">{response.bodyshopName}</p>
                <p className="text-xs text-[#64748b]">Status: {capitalizeWords(response.status)}</p>
                {response.respondedAt ? <p className="text-xs text-[#64748b]">Responded: {new Date(response.respondedAt).toLocaleString('en-AU')}</p> : null}
                {response.note ? <p className="mt-1 text-xs text-[#334155]">{response.note}</p> : null}
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Quote Comparison">
          {quoteEntries.length === 0 ? (
            <p className="text-sm text-[#64748b]">No quotes submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {quoteEntries.map((quote, index) => (
                <div key={`${quote.bodyshopId}-${index}`} className="rounded-xl border border-[#e6ebff] p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{quote.bodyshopName}</p>
                    <p className="text-xs text-[#64748b]">{quote.note || 'No note provided'}</p>
                  </div>
                  <p className="text-sm font-bold text-[#4f46e5]">${quote.quoteMin} - ${quote.quoteMax}</p>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      <PanelCard title="Admin Actions">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={() => actions.sendLeadNotification(lead)} className="rounded-xl border border-[#cfd9ff] px-3 py-2 text-sm font-semibold text-[#273548] hover:bg-[#f2f6ff]">Resend Notification</button>
          <button type="button" onClick={() => actions.assignLeadToTopShop(lead)} className="rounded-xl border border-[#cfd9ff] px-3 py-2 text-sm font-semibold text-[#273548] hover:bg-[#f2f6ff]">Manually Assign Shop</button>
          <button type="button" onClick={() => actions.moveToManualReview(lead, 'Admin escalation from lead detail')} className="rounded-xl border border-[#f5c98f] bg-[#fff7ed] px-3 py-2 text-sm font-semibold text-[#9a3412]">Move to Manual Review</button>
          <button type="button" onClick={() => actions.markLeadResolved(lead)} className="rounded-xl border border-[#9ae6b4] bg-[#ecfdf3] px-3 py-2 text-sm font-semibold text-[#166534]">Mark Resolved</button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[#d7dff5] px-3 py-2 text-sm outline-none focus:border-[#4f46e5]"
            placeholder="Add internal note"
          />
          <button
            type="button"
            onClick={() => {
              actions.addInternalNote(lead.id, noteDraft);
              setNoteDraft('');
            }}
            className="rounded-xl bg-[#273548] px-4 py-2 text-sm font-semibold text-white"
          >
            Add Note
          </button>
        </div>

        {lead.internalNotes.length > 0 ? (
          <div className="mt-4 space-y-2">
            {lead.internalNotes.map((note, index) => (
              <div key={`${lead.id}-note-${index}`} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#334155]">
                {note}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => actions.mutateLead(lead.id, (entry) => ({ ...entry, status }))}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(status)} hover:opacity-85`}
            >
              {capitalizeWords(status)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            actions.addNotificationLog({
              bodyshopId: lead.matchedBodyshopIds[0] || data.bodyshops[0]?.id || 'unknown-shop',
              ownerId: data.owners[0]?.id || 'unknown-owner',
              leadId: lead.id,
              channel: 'dashboard',
              status: 'queued',
              message: `Customer update requested by admin for ${lead.id}.`,
            });
          }}
          className="mt-4 rounded-xl border border-[#d7dff5] px-4 py-2 text-sm font-semibold text-[#273548] hover:bg-[#f3f6ff]"
        >
          Trigger Customer Update
        </button>
      </PanelCard>
    </div>
  );
};

export default LeadDetailPage;

import React from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, capitalizeWords, formatTime, percent } from '../adminUi';

const ManualReviewsPage: React.FC<CommonPageProps> = ({ data, actions }) => {
  const queue = data.manualReviews.filter((review) => review.status !== 'resolved');

  return (
    <div className="space-y-6">
      <PanelCard title="Manual Review Queue">
        {queue.length === 0 ? <p className="text-sm text-[#64748b]">No manual reviews pending.</p> : null}
        <div className="space-y-4">
          {queue.map((review) => {
            const lead = data.leads.find((item) => item.id === review.leadId);

            return (
              <div key={review.id} className="rounded-xl border border-[#dbe4ff] bg-[#f9fbff] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#111827]">{review.leadId}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{capitalizeWords(review.status)}</span>
                </div>
                <p className="mt-1 text-xs text-[#64748b]">{formatTime(review.createdAt)}</p>
                <p className="mt-2 text-sm text-[#334155]"><span className="font-semibold">Reason:</span> {review.reason}</p>
                <p className="mt-1 text-sm text-[#334155]"><span className="font-semibold">Admin note:</span> {review.adminNote || 'No note yet'}</p>
                {lead ? (
                  <p className="mt-2 text-xs text-[#475569]">Customer: {lead.customerName} · Category: {lead.aiDamageCategory} · Confidence: {percent(lead.confidenceScore)}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {lead ? (
                    <button type="button" onClick={() => actions.openLead(lead.id)} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Review Photos</button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      actions.setData((prev) => ({
                        ...prev,
                        manualReviews: prev.manualReviews.map((item) =>
                          item.id === review.id
                            ? { ...item, status: 'in_progress', adminNote: item.adminNote || 'Review started by admin.' }
                            : item
                        ),
                      }))
                    }
                    className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]"
                  >
                    Add Internal Note
                  </button>
                  {lead ? (
                    <button type="button" onClick={() => actions.sendLeadNotification(lead)} className="rounded-md border border-[#cfd9ff] px-2 py-1 text-xs font-semibold text-[#273548]">Resend to Shops</button>
                  ) : null}
                  {lead ? (
                    <button type="button" onClick={() => actions.mutateLead(lead.id, (entry) => ({ ...entry, aiDamageCategory: 'Marked non-PDR by admin', status: 'rejected_by_shops' }))} className="rounded-md border border-[#f5c98f] bg-[#fff7ed] px-2 py-1 text-xs font-semibold text-[#9a3412]">Mark Non-PDR</button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      actions.setData((prev) => ({
                        ...prev,
                        manualReviews: prev.manualReviews.map((item) =>
                          item.id === review.id ? { ...item, status: 'resolved', resolvedAt: new Date().toISOString() } : item
                        ),
                      }))
                    }
                    className="rounded-md border border-[#9ae6b4] bg-[#ecfdf3] px-2 py-1 text-xs font-semibold text-[#166534]"
                  >
                    Send Customer Update / Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
};

export default ManualReviewsPage;

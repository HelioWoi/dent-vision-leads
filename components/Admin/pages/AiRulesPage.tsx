import React from 'react';
import { CommonPageProps } from '../AdminTypes';
import { PanelCard, StatCard, percent } from '../adminUi';

const AiRulesPage: React.FC<CommonPageProps> = ({ data }) => {
  const sampleLead = data.leads[0];

  return (
    <div className="space-y-6">
      <PanelCard title="AI Rules (Integration Ready)">
        <div className="rounded-xl border border-[#cdd7ff] bg-gradient-to-r from-[#eef2ff] via-[#f8faff] to-[#fff6ec] px-4 py-3 text-sm text-[#334155]">
          AI business rules will be connected from the existing Dent-Vision AI analysis logic.
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Current AI Rule Version" value={data.aiRuleInfo.activeVersion} />
          <StatCard label="Damage Analysis Logic" value={data.aiRuleInfo.status} hint={data.aiRuleInfo.connected ? 'Connected to existing output' : 'Awaiting owner-provided rule binding'} />
          <StatCard label="Pricing Logic" value="Existing Rule Only" hint="No new AI pricing logic created" />
          <StatCard label="Confidence Threshold" value={data.aiRuleInfo.confidenceThreshold} />
          <StatCard label="PDR Compatibility" value={data.aiRuleInfo.pdrCompatibility} />
          <StatCard label="Regional Pricing Mapping" value="Placeholder Ready" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <button type="button" className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm font-semibold text-[#475569] cursor-not-allowed">View Active Rule Version</button>
          <button type="button" className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm font-semibold text-[#475569] cursor-not-allowed">Enable/Disable Rule Version (Later)</button>
          <button type="button" className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm font-semibold text-[#475569] cursor-not-allowed">Test Sample Photo (Later)</button>
          <button type="button" className="rounded-xl border border-[#d7dff5] px-3 py-2 text-sm font-semibold text-[#475569] cursor-not-allowed">View AI Output Logs (Later)</button>
        </div>
      </PanelCard>

      <PanelCard title="Current AI Output Preview">
        {!sampleLead ? (
          <p className="text-sm text-[#64748b]">No AI output records available yet.</p>
        ) : (
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm text-[#334155]">
            <p><span className="font-semibold text-[#111827]">Lead:</span> {sampleLead.id}</p>
            <p><span className="font-semibold text-[#111827]">Category:</span> {sampleLead.aiDamageCategory}</p>
            <p><span className="font-semibold text-[#111827]">Estimate:</span> ${sampleLead.aiEstimateMin} - ${sampleLead.aiEstimateMax}</p>
            <p><span className="font-semibold text-[#111827]">Confidence:</span> {percent(sampleLead.confidenceScore)}</p>
            <p className="mt-2 text-xs text-[#64748b]">This panel only visualizes existing output; rule logic itself is intentionally untouched.</p>
          </div>
        )}
      </PanelCard>
    </div>
  );
};

export default AiRulesPage;

import { PartnerLead } from './partnerPlatformService';

const csvEscape = (value: unknown) => {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const leadExportRow = (lead: PartnerLead) => ({
  'Lead ID': lead.id,
  'Customer name': lead.customerName || lead.customerRef,
  Email: lead.customerEmail || '',
  Phone: lead.customerPhone || '',
  'Postal code': lead.customerPostalCode || '',
  Status: lead.status,
  Damage: lead.damageType,
  Panel: lead.panelLocation,
  'Dent count': lead.dentCount,
  'AI estimate min': lead.aiEstimateMin,
  'AI estimate max': lead.aiEstimateMax,
  'Your quote': lead.quoteMin ?? '',
  'Vehicle rego': lead.vehicleRego || '',
  'Preferred date': lead.preferredDate || '',
  'Preferred time': lead.preferredTime || '',
  'Booked at': lead.bookedAt || '',
  'Completed at': lead.completedAt || '',
  'Customer note': lead.customerComment || '',
  'Created at': lead.createdAt,
});

export const exportLeadsToCsv = (leads: PartnerLead[], filename = 'dent-vision-leads.csv') => {
  if (!leads.length) return;

  const rows = leads.map(leadExportRow);
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key as keyof typeof row])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportLeadsToPdf = (leads: PartnerLead[], shopName: string) => {
  if (!leads.length) return;

  const rows = leads.map(leadExportRow);
  const headers = Object.keys(rows[0]);

  const tableRows = rows
    .map(
      (row) =>
        `<tr>${headers
          .map((key) => `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;">${String(row[key as keyof typeof row] ?? '').replace(/</g, '&lt;')}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${shopName} — Lead export</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { font-size: 12px; color: #64748b; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; }
    th { padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 10px; text-align: left; text-transform: uppercase; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${shopName.replace(/</g, '&lt;')}</h1>
  <p>Lead export · ${new Date().toLocaleString('en-AU')} · ${leads.length} record${leads.length === 1 ? '' : 's'}</p>
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
};

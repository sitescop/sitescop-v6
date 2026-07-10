/**
 * Refresh sitescop-cloud-signing pending JSON files from the local SiteScop DB.
 * Adds agentSigningAvailable, agent fields, and agentAuthoritySection for the portal picker.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const cloudPendingDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../sitescop-cloud-signing/agreements/pending',
);

function escapeLegalHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Re-export build uses escapeLegalHtml internally in TS; for mjs we duplicate minimal builder if import fails
const dbPath = path.join(process.env.APPDATA ?? '', 'sitescop-v6', 'sitescop-v6.db');

function buildAgentSection(ctx) {
  const agency = ctx.agencyName?.trim() || 'the listed real estate agency';
  const content = [
    'Agent Authority Declaration',
    '',
    `I confirm I am ${ctx.agentName} of ${agency} (the Agent).`,
    `I have express authority from ${ctx.clientName} for ${ctx.propertyAddress}.`,
  ].join('\n');
  const contentHtml =
    '<p>This declaration applies because a <strong>real estate agent</strong> is signing this Inspection Agreement on behalf of the purchaser/client named in this agreement.</p>' +
    '<div class="legal-callout legal-callout-warning"><p><strong>Important:</strong> Only sign if you are the Agent named below and you have the Client\'s express authority to accept this agreement on their behalf.</p></div>' +
    '<h3 class="legal-subhead">1. Identity</h3>' +
    `<p>I confirm I am <strong>${escapeLegalHtml(ctx.agentName)}</strong> of <strong>${escapeLegalHtml(agency)}</strong> (the <strong>Agent</strong>).</p>` +
    '<h3 class="legal-subhead">2. Authority to act</h3>' +
    `<p>I confirm I have the <strong>express authority</strong> of <strong>${escapeLegalHtml(ctx.clientName)}</strong> (the <strong>Client</strong>) to accept this SiteScop Inspection Agreement on the Client's behalf for the property at <strong>${escapeLegalHtml(ctx.propertyAddress)}</strong>.</p>`;
  return {
    id: 'agent-authority',
    title: 'Agent Authority Declaration',
    content,
    contentHtml,
  };
}

function stripAgentSections(sections) {
  return sections.filter((section) => section.id !== 'agent-authority');
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error('Database not found:', dbPath);
    process.exit(1);
  }
  if (!fs.existsSync(cloudPendingDir)) {
    console.error('Cloud pending dir not found:', cloudPendingDir);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const rows = db.exec(`
    SELECT
      a.access_token,
      a.agreement_number,
      a.client_name,
      a.property_address,
      a.agent_name,
      a.agency_name,
      a.agent_email,
      j.agent_name AS job_agent_name,
      j.real_estate AS job_agency_name,
      j.agent_email AS job_agent_email
    FROM agreements a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.access_token IS NOT NULL
      AND a.access_token != ''
      AND IFNULL(a.deleted_at, '') = ''
  `);

  const agreements = rows[0]?.values ?? [];
  let updated = 0;

  for (const row of agreements) {
    const [
      token,
      agreementNumber,
      clientName,
      propertyAddress,
      agentName,
      agencyName,
      agentEmail,
      jobAgentName,
      jobAgencyName,
      jobAgentEmail,
    ] = row.map((v) => (v == null ? '' : String(v)));

    const resolvedAgentName = (agentName || jobAgentName || '').trim();
    if (!resolvedAgentName) {
      console.log(`Skip ${agreementNumber} — no agent on file`);
      continue;
    }

    const pendingPath = path.join(cloudPendingDir, `${token}.json`);
    if (!fs.existsSync(pendingPath)) {
      console.log(`Skip ${agreementNumber} — no pending file for token`);
      continue;
    }

    const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    const pv = pending.publicView ?? {};
    const resolvedAgency = (agencyName || jobAgencyName || '').trim() || null;
    const resolvedAgentEmail = (agentEmail || jobAgentEmail || '').trim().toLowerCase() || null;

    pv.agentName = resolvedAgentName;
    pv.agencyName = resolvedAgency;
    pv.agentEmail = resolvedAgentEmail;
    pv.agentSigningAvailable = true;
    pv.signerRole = pv.signerRole === 'AGENT' ? 'AGENT' : 'CLIENT';
    pv.agentAuthoritySection = buildAgentSection({
      agentName: resolvedAgentName,
      agencyName: resolvedAgency,
      clientName: pv.clientName || clientName,
      propertyAddress: pv.propertyAddress || propertyAddress,
    });
    if (pv.legalSections?.sections) {
      pv.legalSections.sections = stripAgentSections(pv.legalSections.sections);
    }

    pending.publicView = pv;
    pending.sentAt = new Date().toISOString();
    fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
    console.log(`Updated ${agreementNumber} (${resolvedAgentName})`);
    updated += 1;
  }

  db.close();
  console.log(`Done. Updated ${updated} pending file(s).`);
}

await main();

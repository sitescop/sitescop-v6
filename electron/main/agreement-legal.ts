import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { InspectionType } from '../../shared/api-types.js';

export interface AgreementLegalSection {
  id: string;
  title: string;
  content: string;
  contentHtml?: string;
}

export interface AgreementLegalContent {
  sections: AgreementLegalSection[];
}

const LEGAL_FILES: Array<{ file: string; title: string }> = [
  { file: 'inspection-limitations.html', title: 'Inspection Limitations' },
  { file: 'scope.html', title: 'Scope of Inspection' },
  { file: 'terms-conditions.html', title: 'Terms and Conditions' },
  { file: 'privacy-policy.html', title: 'Privacy Policy' },
  { file: 'client-declaration.html', title: 'Client Declaration' },
];

let legalBasePath: string | null = null;

export function ensureAgreementLegalPath(): string {
  if (legalBasePath) return legalBasePath;
  legalBasePath = app.isPackaged
    ? join(process.resourcesPath, 'report-pdf', 'legal')
    : join(app.getAppPath(), 'shared/report-pdf/legal');
  return legalBasePath;
}

function htmlToSigningHtml(html: string): string {
  let body = extractBody(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<div\s+class=["']note["'][^>]*>/gi, '<div class="legal-callout legal-callout-note">')
    .replace(/<div\s+class=["']warning["'][^>]*>/gi, '<div class="legal-callout legal-callout-warning">')
    .replace(/<h2([^>]*)>/gi, '<h3 class="legal-subhead"$1>')
    .replace(/<\/h2>/gi, '</h3>')
    .replace(/\s+on\w+=["'][^"']*["']/gi, '')
    .replace(/<(?!(\/)?(p|ul|ol|li|strong|h3|div|br)\b)[^>]+>/gi, '')
    .trim();

  return body;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1]?.trim() ?? html;
}

export function loadLegalSectionsForType(type: InspectionType): AgreementLegalContent {
  const base = ensureAgreementLegalPath();
  const dir = join(base, legalKindForType(type));
  const sections: AgreementLegalSection[] = [];

  for (const { file, title } of LEGAL_FILES) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    const html = readFileSync(path, 'utf8');
    sections.push({
      id: file.replace('.html', ''),
      title,
      content: htmlToPlainText(extractBody(html)),
      contentHtml: htmlToSigningHtml(html),
    });
  }

  if (!sections.length) {
    sections.push({
      id: 'default',
      title: 'Inspection Agreement',
      content:
        'Standard SiteScop inspection terms apply. Contact info@sitescop.com.au if you have questions before signing.',
    });
  }

  return { sections };
}

function legalKindForType(type: InspectionType): 'building' | 'pest' {
  return type === 'PEST' ? 'pest' : 'building';
}

/** Fill in missing section text from current legal HTML files (e.g. after a file was empty). */
export function resolveLegalSections(
  stored: AgreementLegalContent,
  inspectionType: InspectionType,
): AgreementLegalContent {
  const fresh = loadLegalSectionsForType(inspectionType);
  const freshById = new Map(fresh.sections.map((section) => [section.id, section]));

  if (!stored.sections.length) {
    return fresh;
  }

  return {
    sections: stored.sections.map((section) => {
      const freshSection = freshById.get(section.id);
      const content = section.content?.trim()
        ? section.content
        : (freshSection?.content ?? '');
      return {
        ...section,
        content,
        contentHtml: freshSection?.contentHtml,
      };
    }),
  };
}

export function inspectionTypeLabel(type: InspectionType): string {
  switch (type) {
    case 'PEST':
      return 'Pest Inspection';
    case 'COMBINED':
      return 'Building & Pest Inspection';
    case 'BUILDING':
    default:
      return 'Building Inspection';
  }
}

export interface AgentAuthorityContext {
  agentName: string;
  agencyName?: string | null;
  clientName: string;
  propertyAddress: string;
}

export function buildAgentAuthoritySection(ctx: AgentAuthorityContext): AgreementLegalSection {
  const agency = ctx.agencyName?.trim() || 'the listed real estate agency';
  const content = [
    'Agent Authority Declaration',
    '',
    'This declaration applies because a real estate agent is signing this Inspection Agreement on behalf of the purchaser/client named in this agreement.',
    '',
    '1. Identity',
    `I confirm I am ${ctx.agentName} of ${agency} (the Agent).`,
    '',
    '2. Authority to act',
    `I confirm I have the express authority of ${ctx.clientName} (the Client) to accept this SiteScop Inspection Agreement on the Client's behalf for the property at ${ctx.propertyAddress}.`,
    '',
    '3. Client awareness',
    'I confirm I have explained to the Client (or will promptly provide the Client with) the Scope of Inspection, Inspection Limitations, Terms & Conditions and Privacy Policy forming part of this agreement; and that the Inspection Report is prepared for the Client only.',
    '',
    '4. Binding effect',
    'I understand my electronic signature has the same legal effect as a handwritten signature to the extent permitted by Australian law, and binds the Client to this agreement as their authorised representative.',
    '',
    '5. Agent responsibility',
    'SiteScop Pty Ltd relies on this declaration. The Agent accepts responsibility for ensuring they are authorised to sign for the Client. The Agent must not sign unless they hold that authority.',
    '',
    'IMPORTANT: Only sign if you are the Agent named above and you have the Client\'s authority to accept this agreement on their behalf.',
  ].join('\n');

  const contentHtml = [
    '<p>This declaration applies because a <strong>real estate agent</strong> is signing this Inspection Agreement on behalf of the purchaser/client named in this agreement.</p>',
    '<div class="legal-callout legal-callout-warning"><p><strong>Important:</strong> Only sign if you are the Agent named below and you have the Client\'s express authority to accept this agreement on their behalf.</p></div>',
    '<h3 class="legal-subhead">1. Identity</h3>',
    `<p>I confirm I am <strong>${escapeLegalHtml(ctx.agentName)}</strong> of <strong>${escapeLegalHtml(agency)}</strong> (the <strong>Agent</strong>).</p>`,
    '<h3 class="legal-subhead">2. Authority to act</h3>',
    `<p>I confirm I have the <strong>express authority</strong> of <strong>${escapeLegalHtml(ctx.clientName)}</strong> (the <strong>Client</strong>) to accept this SiteScop Inspection Agreement on the Client's behalf for the property at <strong>${escapeLegalHtml(ctx.propertyAddress)}</strong>.</p>`,
    '<h3 class="legal-subhead">3. Client awareness</h3>',
    '<p>I confirm I have explained to the Client (or will promptly provide the Client with) the Scope of Inspection, Inspection Limitations, Terms &amp; Conditions and Privacy Policy forming part of this agreement; and that the <strong>Inspection Report is prepared for the Client only</strong>.</p>',
    '<h3 class="legal-subhead">4. Binding effect</h3>',
    '<p>I understand my electronic signature has the same legal effect as a handwritten signature to the extent permitted by Australian law, and <strong>binds the Client</strong> to this agreement as their authorised representative.</p>',
    '<h3 class="legal-subhead">5. Agent responsibility</h3>',
    '<p>SiteScop Pty Ltd relies on this declaration. The Agent accepts responsibility for ensuring they are authorised to sign for the Client.</p>',
    '<div class="legal-callout legal-callout-note"><p>The Client remains the party to whom the inspection is provided. This agreement does not permit third parties to rely on the Inspection Report without SiteScop\'s written consent.</p></div>',
  ].join('\n');

  return {
    id: 'agent-authority',
    title: 'Agent Authority Declaration',
    content,
    contentHtml,
  };
}

function escapeLegalHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isClientDeclarationSection(section: AgreementLegalSection): boolean {
  return (
    section.id === 'client-declaration' ||
    section.title.toLowerCase().includes('client declaration')
  );
}

/** Legal sections shown during signing for the selected party. */
export function buildSectionsForSigningParty(
  sections: AgreementLegalSection[],
  party: 'CLIENT' | 'AGENT',
  agentSection?: AgreementLegalSection | null,
): AgreementLegalSection[] {
  const withoutAgent = sections.filter((section) => section.id !== 'agent-authority');
  if (party !== 'AGENT' || !agentSection) {
    return withoutAgent;
  }
  return [...withoutAgent.filter((section) => !isClientDeclarationSection(section)), agentSection];
}

/** Insert agent authority section after Privacy Policy (or at end). */
export function withAgentAuthoritySection(
  sections: AgreementLegalSection[],
  ctx: AgentAuthorityContext,
): AgreementLegalSection[] {
  const agentSection = buildAgentAuthoritySection(ctx);
  const withoutAgent = sections.filter((section) => section.id !== 'agent-authority');
  const privacyIndex = withoutAgent.findIndex(
    (section) =>
      section.id === 'privacy-policy' || section.title.toLowerCase().includes('privacy'),
  );
  if (privacyIndex < 0) {
    return [...withoutAgent, agentSection];
  }
  return [
    ...withoutAgent.slice(0, privacyIndex + 1),
    agentSection,
    ...withoutAgent.slice(privacyIndex + 1),
  ];
}

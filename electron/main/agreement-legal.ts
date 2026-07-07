import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { InspectionType } from '../../shared/api-types.js';

export interface AgreementLegalSection {
  id: string;
  title: string;
  content: string;
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
      if (section.content?.trim()) return section;
      const replacement = freshById.get(section.id);
      return replacement ? { ...section, content: replacement.content } : section;
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

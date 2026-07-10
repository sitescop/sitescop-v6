import {
  PDF_MARGIN_BOTTOM,
  PDF_MARGIN_LEFT,
  PDF_MARGIN_RIGHT,
  PDF_MARGIN_TOP,
  PDF_SECTION_MIN_REMAINING_MM,
} from './pdf-layout.js';

export function reportPrintStyles(primaryColor: string, secondaryColor: string): string {
  return `
@page {
  size: A4;
  margin: ${PDF_MARGIN_TOP} ${PDF_MARGIN_RIGHT} ${PDF_MARGIN_BOTTOM} ${PDF_MARGIN_LEFT};
}

* { box-sizing: border-box; }

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #222;
  margin: 0;
  max-width: 100%;
  orphans: 3;
  widows: 3;
}

/*
 * Printable content area per page (A4 minus margins). Footer is rendered by Puppeteer
 * inside the bottom margin band — body content must not extend into that band.
 */
.report-body {
  min-height: 0;
  max-height: none;
}

.cover-page {
  page-break-after: always;
  break-after: page;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.cover-title {
  font-size: 22pt;
  font-weight: 800;
  color: ${primaryColor};
  margin: 0 0 6px;
  letter-spacing: -0.02em;
  line-height: 1.25;
  max-width: 100%;
}

.cover-subtitle {
  font-size: 11pt;
  color: ${secondaryColor};
  font-weight: 600;
  margin: 0 0 20px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cover-header {
  margin-bottom: 24px;
  width: 100%;
}

.cover-company {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 18px;
  margin-bottom: 18px;
}

.cover-company-logo {
  flex-shrink: 0;
}

.cover-company-logo img {
  display: block;
  max-height: 110px;
  max-width: 200px;
  width: auto;
  height: auto;
  object-fit: contain;
}

.cover-company-details {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
  color: #333;
}

.cover-company-details p {
  margin: 2px 0;
}

.cover-company-name {
  font-size: 12pt;
  font-weight: bold;
  color: ${primaryColor};
  margin: 0 0 4px !important;
}

.cover-company-contact {
  font-size: 8pt;
  line-height: 1.35;
  color: #444;
}

.cover-company-contact p {
  margin: 1px 0;
}

.cover-company-contact a {
  color: ${secondaryColor};
  text-decoration: none;
}

.cover-property-photo {
  width: 100%;
}

.cover-property-photo-label {
  margin: 0 0 8px;
  font-size: 11pt;
  font-weight: 600;
  color: ${primaryColor};
}

.cover-property-photo img {
  width: 100%;
  height: 340px;
  object-fit: cover;
  border: 1px solid #ccc;
  display: block;
}

.cover-property-photo-placeholder {
  width: 100%;
  height: 340px;
  border: 1px dashed #ccc;
  background: #f7f7f7;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11pt;
  text-align: center;
  padding: 12px;
}

.cover-logo {
  max-height: 70px;
  max-width: 220px;
  margin-bottom: 24px;
}

.cover-meta {
  border-top: 1px solid #e5e7e6;
  padding-top: 14px;
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 20px;
}

.cover-meta p {
  margin: 4px 0;
  font-size: 10pt;
}

.cover-reference-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 20px 0 8px;
}

.cover-reference-card {
  background: ${primaryColor};
  color: #fff;
  border-radius: 8px;
  padding: 14px 16px;
  border-left: 5px solid ${secondaryColor};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.cover-reference-card-accent {
  background: linear-gradient(135deg, ${primaryColor} 0%, #2d6a4f 100%);
}

.cover-reference-label {
  display: block;
  font-size: 8.5pt;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.88;
  margin-bottom: 6px;
}

.cover-reference-value {
  display: block;
  font-size: 13pt;
  font-weight: 700;
  font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
  letter-spacing: 0.02em;
}

.report-part-heading {
  font-size: 13pt;
  font-weight: 700;
  color: ${primaryColor};
  margin: 0 0 12px;
  padding: 0 0 6px;
  border-bottom: 2px solid ${primaryColor};
  break-after: avoid-page;
  page-break-after: avoid;
}

.report-part-block {
  margin-bottom: 4px;
}

.report-part-block--page-after {
  break-after: page;
  page-break-after: always;
}

.report-part-lead-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0;
}

.report-part-lead-table td {
  border: none;
  padding: 0;
  vertical-align: top;
}

.report-part-lead-table--new-page {
  break-before: page;
  page-break-before: always;
}

.report-part-lead-table .report-part-heading {
  break-after: avoid-page;
  page-break-after: avoid;
}

.report-part-lead-table .report-section {
  break-before: avoid-page;
  page-break-before: avoid;
  margin-top: 0;
}

.report-part-lead--new-page {
  break-before: page;
  page-break-before: always;
}

.report-part-lead {
  break-inside: auto;
  page-break-inside: auto;
}

.report-part-lead > .report-part-heading,
.report-part-lead > .report-section:first-child {
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.report-part-lead > .report-part-heading {
  break-after: avoid-page;
  page-break-after: avoid;
}

.report-part-lead > .report-section {
  break-before: avoid-page;
  page-break-before: avoid;
  margin-top: 0;
}

.report-part-content > .report-section:first-child {
  margin-top: 0;
}

/* ~15% guard between sections inside the same major part (e.g. Site Conditions after Accessibility). */
.report-part-content > .report-section + .report-section::before {
  content: "";
  display: block;
  height: ${PDF_SECTION_MIN_REMAINING_MM}mm;
  margin-bottom: -${PDF_SECTION_MIN_REMAINING_MM}mm;
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.report-part-content > *:first-child,
.report-part-lead > *:first-child {
  break-before: avoid-page;
  page-break-before: avoid;
}

.report-part-heading-letter {
  margin-top: 0;
}

.report-part-num {
  display: inline-block;
  min-width: 22px;
  margin-right: 8px;
  padding: 1px 7px;
  font-size: 11pt;
  font-weight: 700;
  color: #fff;
  background: ${primaryColor};
  border-radius: 2px;
  text-align: center;
}

.report-section-heading {
  color: ${primaryColor};
  font-size: 11pt;
  font-weight: 700;
  border-left: 3px solid ${secondaryColor};
  padding: 4px 0 4px 10px;
  margin: 0 0 10px;
  background: #f7faf8;
}

.report-section h2 {
  color: ${primaryColor};
  font-size: 13pt;
  border-bottom: 2px solid ${primaryColor};
  padding-bottom: 4px;
  margin: 0 0 10px;
}

.report-section h3.report-section-heading {
  border-bottom: 1px solid ${secondaryColor};
  font-size: 12pt;
}

.report-heading-group {
  margin-bottom: 14px;
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.report-heading-group--splittable {
  break-inside: auto;
  page-break-inside: auto;
}

.report-heading-group > .report-section-heading,
.report-heading-group > h2 {
  break-after: avoid-page;
  page-break-after: avoid;
}

.report-heading-group > .field-table,
.report-heading-group > .comments,
.report-heading-group > .report-list,
.report-heading-group > .conclusion-narrative,
.report-heading-group > .pest-summary-risk,
.report-heading-group > .certification-statement,
.report-heading-group > p,
.report-heading-group > div:not(.conclusion-narrative) {
  break-before: avoid-page;
  page-break-before: avoid;
}

.report-heading-group--splittable > .field-table {
  break-before: avoid-page;
  page-break-before: avoid;
  break-inside: auto;
  page-break-inside: auto;
}

.report-heading-group--splittable > .report-supplement-block {
  break-before: avoid-page;
  page-break-before: avoid;
  break-inside: auto;
  page-break-inside: auto;
}

.report-heading-group > h2 {
  color: ${primaryColor};
  font-size: 13pt;
  border-bottom: 2px solid ${primaryColor};
  padding-bottom: 4px;
  margin: 0 0 10px;
}

.certification-statement {
  margin: 0 0 12px;
  line-height: 1.5;
  color: #333;
}

.report-section {
  margin-bottom: 18px;
  page-break-inside: auto;
  break-inside: auto;
}

.report-section-block {
  break-inside: auto;
  page-break-inside: auto;
}

.report-section-block > .report-section-heading {
  break-after: avoid-page;
  page-break-after: avoid;
}

.report-section-block > .field-table,
.report-section-block > .report-supplement-block {
  break-before: avoid-page;
  page-break-before: avoid;
}

.report-section-new-page {
  break-before: page;
  page-break-before: always;
}

.report-section h2 {
  color: ${primaryColor};
  font-size: 13pt;
  border-bottom: 2px solid ${primaryColor};
  padding-bottom: 4px;
  margin: 0 0 10px;
}

.field-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
  page-break-inside: auto;
  break-inside: auto;
}

.field-table .field-row-group:not(.field-row-group--with-photos) {
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.field-table .field-row-group--with-photos {
  break-inside: auto;
  page-break-inside: auto;
}

.field-table .field-row-group--with-photos > tr:not(.field-photo-row) {
  break-inside: avoid-page;
  page-break-inside: avoid;
  break-after: avoid-page;
  page-break-after: avoid;
}

.field-table tr.field-photo-row {
  break-inside: auto;
  page-break-inside: auto;
}

.field-table tr.field-photo-row--lead {
  break-before: avoid-page;
  page-break-before: avoid;
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.field-table tr.field-photo-row--cont {
  break-before: auto;
  page-break-before: auto;
}

.field-table tr:not(.field-photo-row) {
  page-break-inside: avoid;
  break-inside: avoid-page;
}

.field-table th,
.field-table td {
  border: 1px solid #ddd;
  padding: 6px 8px;
  vertical-align: top;
  text-align: left;
}

.field-table th {
  width: 34%;
  background: #eef4f1;
  color: ${primaryColor};
  font-weight: 700;
}

.comments {
  background: #fafafa;
  border-left: 4px solid ${secondaryColor};
  padding: 8px 12px;
  margin: 8px 0;
}

.report-supplement-block {
  margin-top: 8px;
  break-inside: auto;
  page-break-inside: auto;
}

.report-supplement-block > .comments {
  break-after: avoid-page;
  page-break-after: avoid;
  margin-bottom: 0;
}

.report-supplement-block > .photo-group--lead {
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.report-supplement-block > .comments + .photo-group--lead,
.report-supplement-block > .photo-group--lead:first-child {
  break-before: avoid-page;
  page-break-before: avoid;
}

.report-supplement-block > .photo-group--cont {
  break-inside: auto;
  page-break-inside: auto;
  break-before: auto;
  page-break-before: auto;
  margin-top: 0;
}

.report-section-block > .report-supplement-block {
  break-before: avoid-page;
  page-break-before: avoid;
}

.comments p {
  margin: 4px 0 0;
  white-space: pre-wrap;
}

.photo-grid {
  display: block;
  margin-top: 6px;
}

.photo-grid-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.photo-grid-row:last-child {
  margin-bottom: 0;
}

.photo {
  margin: 0;
  flex: 0 0 auto;
  max-width: calc(50% - 5px);
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.photo-group-label {
  display: block;
  margin-bottom: 6px;
  color: ${primaryColor};
}

.photo-caption {
  margin: 6px 0 0;
  font-size: 9pt;
  line-height: 1.35;
  color: #444;
  font-style: italic;
  max-width: 100%;
}

.field-table tr.field-photo-row td {
  padding-top: 4px;
  padding-bottom: 10px;
  border-top: none;
}

.field-table tr.field-photo-row + tr th,
.field-table tr.field-photo-row + tr td {
  border-top: 1px solid #ddd;
}

.photo img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 180px;
  object-fit: contain;
  object-position: left top;
  border: 1px solid #ccc;
}

.field-photo-row--lead .photo-group--lead,
.photo-group--lead {
  margin-top: 6px;
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.field-photo-row--cont .photo-group,
.photo-group--cont {
  margin-top: 0;
  break-inside: auto;
  page-break-inside: auto;
}

.photo-group {
  margin-top: 6px;
}

.photo-group strong,
.photo-group-label {
  display: block;
  margin-bottom: 6px;
}

.report-list {
  margin: 0;
  padding-left: 18px;
}

.report-list li {
  margin-bottom: 4px;
  page-break-inside: avoid;
  break-inside: avoid-page;
}

.report-section-heading,
.report-part-heading,
h2,
h3 {
  break-after: avoid-page;
  page-break-after: avoid;
}

.report-section > .field-table,
.report-section-block > .field-table,
.report-section > .comments,
.report-section > .report-list {
  break-before: avoid-page;
  page-break-before: avoid;
}

.comments,
.recommendations-block,
.declaration-block,
.hazard-assessment-section,
.conclusion-narrative {
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.report-supplement-block .photo-grid-row,
.photo-group--lead .photo-grid-row,
.photo-group--cont .photo-grid-row {
  break-inside: avoid-page;
  page-break-inside: avoid;
}

.field-section-photos-group.field-row-group--with-photos > tr.field-photo-row--lead {
  break-before: avoid-page;
  page-break-before: avoid;
}

.field-section-photos-group.field-row-group--with-photos > tr.field-photo-row--cont {
  break-before: auto;
  page-break-before: auto;
}

.recommendations-block {
  margin-bottom: 18px;
}

.recommendations-block h3,
.declaration-block h3 {
  font-size: 14px;
  margin: 0 0 10px;
  color: ${primaryColor};
}

.declaration-block {
  margin-top: 8px;
}

.hazard-assessment-section .hazard-list-block,
.hazard-assessment-section .hazard-summary-block {
  margin-top: 16px;
}

.hazard-assessment-section .hazard-list-block strong,
.hazard-assessment-section .hazard-summary-block strong {
  display: block;
  margin-bottom: 8px;
  color: ${primaryColor};
}

.inspection-summary-ratings th {
  width: 48%;
  font-weight: 600;
}

.inspection-summary-ratings td {
  font-weight: 400;
}

.pest-inspection-summary .pest-summary-disclaimer,
.building-inspection-summary .building-summary-disclaimer {
  margin: 0 0 14px;
  font-size: 10pt;
  color: #444;
  line-height: 1.5;
  padding: 10px 12px;
  background: #f8faf9;
  border: 1px solid #e2ebe6;
  border-left: 4px solid ${secondaryColor};
  border-radius: 4px;
}

.pest-inspection-summary .pest-summary-note {
  margin: 12px 0 0;
  font-size: 10pt;
  line-height: 1.5;
}

.pest-inspection-summary .pest-summary-risk {
  margin-top: 14px;
}

.pest-summary-table th {
  vertical-align: top;
}

.building-inspection-summary .building-summary-note {
  margin: 12px 0 0;
  font-size: 10pt;
  line-height: 1.5;
}

.building-inspection-summary .building-summary-recommendations {
  margin-top: 0;
}

.building-summary-table th {
  vertical-align: top;
}

.conclusion-section {
  page-break-before: auto;
  break-before: auto;
}

.conclusion-narrative {
  margin-bottom: 16px;
}

.conclusion-narrative h3 {
  font-size: 14px;
  margin: 0 0 10px;
  color: ${primaryColor};
}

.pest-next-inspection-highlight {
  margin: 16px 0 0;
  padding: 12px 14px;
  border: 2px solid ${primaryColor};
  border-radius: 6px;
  background: ${primaryColor}14;
  font-size: 11pt;
  font-weight: 700;
  line-height: 1.5;
  color: #1a1a1a;
}

.hazard-conclusion-note {
  margin: 16px 0 0;
  font-size: 10pt;
  line-height: 1.5;
  color: #444;
}

.finding-item {
  margin-bottom: 12px;
}

.finding-item p {
  margin: 4px 0 0;
}

.signature-block {
  margin-top: 18px;
  page-break-inside: avoid;
}

.signature-block strong {
  display: block;
  margin-bottom: 8px;
}

.report-signature {
  max-height: 100px;
  max-width: 280px;
  display: block;
}

.signature-missing {
  color: #666;
  font-style: italic;
  margin: 0;
}

.legal-section {
  page-break-before: always;
}

.legal-section h1,
.legal-section h2 {
  color: ${primaryColor};
}

.legal-section .warning {
  background: #fff3f3;
  border-left: 5px solid #d32f2f;
  padding: 12px;
  margin: 14px 0;
}

.legal-section .note {
  background: #fff8dc;
  border-left: 5px solid #d4aa00;
  padding: 12px;
  margin: 14px 0;
}
`;
}

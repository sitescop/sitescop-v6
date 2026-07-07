export function reportPrintStyles(primaryColor: string, secondaryColor: string): string {
  return `
@page {
  size: A4;
  margin: 18mm 15mm 22mm;
}

* { box-sizing: border-box; }

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #222;
  margin: 0;
}

.cover-page {
  page-break-after: always;
  min-height: 250mm;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 12mm 10mm 20mm;
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

.cover-title {
  font-size: 24pt;
  color: ${primaryColor};
  margin: 0 0 8px;
}

.cover-subtitle {
  font-size: 12pt;
  color: ${secondaryColor};
  margin: 0 0 24px;
}

.cover-meta {
  border-top: 3px solid ${primaryColor};
  padding-top: 16px;
  margin-top: 16px;
}

.cover-meta p {
  margin: 6px 0;
}

.report-section {
  page-break-inside: avoid;
  margin-bottom: 18px;
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
  background: #f5f7f6;
  font-weight: 600;
}

.comments {
  background: #fafafa;
  border-left: 4px solid ${secondaryColor};
  padding: 8px 12px;
  margin: 8px 0;
}

.comments p {
  margin: 4px 0 0;
  white-space: pre-wrap;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 10px;
}

.photo {
  margin: 0;
  page-break-inside: avoid;
}

.photo img {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border: 1px solid #ccc;
}

.photo figcaption {
  font-size: 9pt;
  color: #555;
  margin-top: 4px;
}

.photo-group {
  margin-top: 10px;
}

.photo-group strong {
  display: block;
  margin-bottom: 6px;
}

.report-list {
  margin: 0;
  padding-left: 18px;
}

.report-list li {
  margin-bottom: 4px;
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

.conclusion-section {
  page-break-before: always;
}

.conclusion-narrative {
  margin-bottom: 16px;
}

.conclusion-narrative h3 {
  font-size: 14px;
  margin: 0 0 10px;
  color: ${primaryColor};
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

.page-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 8pt;
  color: #666;
  text-align: center;
  padding: 4mm 15mm;
  border-top: 1px solid #ddd;
}
`;
}

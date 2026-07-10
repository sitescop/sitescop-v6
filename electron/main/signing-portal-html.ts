export const SIGNING_PORTAL_HTML = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>SiteScop — Sign Agreement</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fa;
      --surface: #ffffff;
      --text: #1a2332;
      --muted: #5c6b7a;
      --primary: #0066cc;
      --success: #059669;
      --danger: #dc2626;
      --border: #d8e0ea;
      --warning: #d97706;
      --warning-bg: #fffbeb;
      --warning-border: #fcd34d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .wrap {
      width: 90%;
      max-width: none;
      margin: 0 auto;
      padding: 12px 0 32px;
    }
    @media (min-width: 1024px) {
      .wrap { width: 75%; padding: 24px 0 48px; }
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    h2 { margin: 0 0 12px; font-size: 1.1rem; color: var(--primary); }
    .muted { color: var(--muted); font-size: 0.9rem; }
    .grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
    @media (min-width: 560px) { .grid { grid-template-columns: 1fr 1fr; } }
    .label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
    .price { font-size: 1.15rem; font-weight: 700; }
    .section + .section { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); }
    .section p { white-space: pre-wrap; font-size: 0.92rem; margin: 8px 0 0; }
    .terms-intro {
      margin: 0 0 14px;
      padding: 16px 18px;
      font-size: 1.05rem;
      font-weight: 800;
      line-height: 1.5;
      text-align: center;
      color: #b91c1c;
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border: 2px solid #ef4444;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.18);
    }
    .terms-item {
      border: 2px solid var(--warning-border);
      border-radius: 10px;
      background: var(--warning-bg);
      margin-bottom: 8px;
      overflow: hidden;
    }
    .terms-item.reviewed {
      border-color: rgba(5, 150, 105, 0.45);
      background: rgba(5, 150, 105, 0.1);
    }
    .terms-head {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: #92400e;
    }
    .terms-item.reviewed .terms-head { color: var(--success); }
    .terms-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #fbbf24;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .terms-item.reviewed .terms-icon {
      background: transparent;
      color: var(--success);
      font-size: 18px;
      font-weight: 700;
    }
    .terms-title { flex: 1; font-weight: 700; }
    .terms-chevron { flex-shrink: 0; transition: transform 0.2s; }
    .terms-item.open .terms-chevron { transform: rotate(180deg); }
    .terms-body {
      border-top: 1px solid rgba(0,0,0,0.08);
      width: 90%;
      margin: 0 auto;
      padding: 16px 0 20px;
      max-height: min(40vh, 280px);
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      background: #fff;
      box-sizing: border-box;
    }
    .terms-body p {
      white-space: pre-wrap;
      font-size: 1rem;
      margin: 0;
      width: 100%;
      color: #152033;
      line-height: 1.65;
      max-width: none;
    }
    @media (min-width: 640px) {
      .terms-body {
        padding: 20px 0 24px;
        max-height: min(52vh, 380px);
      }
      .terms-body p { font-size: 1.0625rem; line-height: 1.75; }
    }
    @media (min-width: 1024px) {
      .terms-body {
        padding: 24px 0 28px;
        min-height: 400px;
        max-height: 450px;
      }
      .terms-body p { font-size: 1.125rem; line-height: 1.8; }
    }
    .terms-body p { font-size: 1.125rem; line-height: 1.8; }
    }
    .agreement-header { padding: 18px 20px; margin-bottom: 16px; }
    .agreement-header-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
    .agreement-logo { width: 72px; height: 72px; object-fit: contain; border-radius: 8px; border: 1px solid var(--border); padding: 6px; background: #fff; flex-shrink: 0; }
    .agreement-logo-placeholder { width: 72px; height: 72px; border-radius: 8px; background: #eef4f0; color: #1b4332; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border); }
    .agreement-company-name { margin: 0 0 4px; font-size: 0.9rem; font-weight: 600; color: #2d6a4f; }
    .agreement-page-title { margin: 0 0 6px; font-size: 1.25rem; font-weight: 700; color: var(--text); }
    .agreement-ref { margin: 0; font-size: 0.88rem; color: var(--muted); }
    .agreement-summary { display: grid; gap: 12px; grid-template-columns: 1fr; }
    @media (min-width: 560px) { .agreement-summary { grid-template-columns: 1fr 1fr; } }
    .summary-item { background: #f8faf9; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }
    .summary-item-wide { grid-column: 1 / -1; }
    .summary-value { font-weight: 600; line-height: 1.4; word-break: break-word; }
    .summary-sub { margin-top: 4px; font-size: 0.88rem; color: var(--muted); }
    .legal-content .legal-subhead { font-size: 1.05em; font-weight: 700; color: #0b6b53; margin: 1em 0 0.45em; }
    .legal-content ul, .legal-content ol { margin: 0.5em 0 0.85em; padding-left: 1.35em; }
    .legal-content li { margin-bottom: 0.35em; }
    .legal-callout { margin: 0.85em 0; padding: 14px 16px; border-radius: 8px; line-height: 1.65; }
    .legal-callout-note { background: #eef8ff; border-left: 4px solid #2d6a4f; }
    .legal-callout-warning { background: #fef2f2; border-left: 4px solid #dc2626; color: #7f1d1d; }
    .terms-hint {
      border: 1px solid var(--warning-border);
      background: var(--warning-bg);
      color: #92400e;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 0.9rem;
      margin-bottom: 12px;
    }
    label.field { display: block; margin-bottom: 12px; font-size: 0.9rem; font-weight: 600; }
    input[type="text"] {
      width: 100%;
      margin-top: 6px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 16px;
    }
    .sig-wrap {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
      touch-action: none;
    }
    canvas { display: block; width: 100%; height: 160px; }
    .sig-actions { display: flex; gap: 8px; margin-top: 8px; }
    button {
      border: none;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary { background: var(--primary); color: #fff; width: 100%; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #eef2f7; color: var(--text); }
    .checkbox { display: flex; gap: 10px; align-items: flex-start; font-size: 0.9rem; margin: 16px 0; }
    .checkbox input { margin-top: 4px; width: 18px; height: 18px; }
    .error { color: var(--danger); font-size: 0.9rem; margin-bottom: 12px; }
    .center { text-align: center; padding: 48px 16px; }
    .success-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: rgba(5,150,105,0.12); color: var(--success);
      display: flex; align-items: center; justify-content: center;
      font-size: 2rem; margin: 0 auto 16px;
    }
    .loading { text-align: center; padding: 48px 16px; color: var(--muted); }
  </style>
</head>
<body>
  <div id="app" class="loading">Loading agreement…</div>
  <script>
    const TYPE_LABELS = { BUILDING: 'Building', PEST: 'Pest', COMBINED: 'Building & Pest' };
    const token = (function () {
      const m = location.pathname.match(/\\/sign\\/([^/?#]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    })();

    function formatAud(cents) {
      return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
    }

    function formatDate(iso) {
      if (!iso) return '';
      const [y, m, d] = iso.slice(0, 10).split('-');
      return d + '/' + m + '/' + y;
    }

    async function api(path, options) {
      const res = await fetch(path, options);
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && data.error) || 'Request failed');
      return data;
    }

    function renderError(message) {
      document.getElementById('app').innerHTML =
        '<div class="wrap"><div class="card center"><p class="error">' + message + '</p></div></div>';
    }

    function renderSuccess(agreementNumber) {
      document.getElementById('app').innerHTML =
        '<div class="wrap"><div class="card center">' +
        '<div class="success-icon">✓</div>' +
        '<h1>Agreement signed</h1>' +
        '<p class="muted">Thank you. Agreement <strong>' + agreementNumber + '</strong> has been submitted successfully.</p>' +
        '</div></div>';
    }

    function setupSignaturePad(canvas) {
      const ctx = canvas.getContext('2d');
      let drawing = false;
      let empty = true;

      function resize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width * devicePixelRatio);
        canvas.height = Math.floor(rect.height * devicePixelRatio);
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1a2332';
      }

      function pos(e) {
        const rect = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }

      function start(e) {
        e.preventDefault();
        drawing = true;
        empty = false;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      }

      function move(e) {
        if (!drawing) return;
        e.preventDefault();
        const p = pos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      function end() { drawing = false; }

      resize();
      window.addEventListener('resize', resize);
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      canvas.addEventListener('mouseup', end);
      canvas.addEventListener('mouseleave', end);
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);

      return {
        clear() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          empty = true;
        },
        isEmpty() { return empty; },
        toDataUrl() { return empty ? '' : canvas.toDataURL('image/png'); },
      };
    }

    function sectionBodyHtml(section) {
      if (section.contentHtml && String(section.contentHtml).trim()) {
        return String(section.contentHtml);
      }
      return '<p>' + section.content.replace(/</g, '&lt;') + '</p>';
    }

    function renderAgreementHeader(agreement) {
      const logo = agreement.companyLogoUrl
        ? '<img class="agreement-logo" src="' + agreement.companyLogoUrl.replace(/"/g, '&quot;') + '" alt="' + agreement.companyName.replace(/"/g, '&quot;') + '" />'
        : '<div class="agreement-logo-placeholder" aria-hidden="true">SS</div>';
      return (
        '<div class="card agreement-header">' +
        '<div class="agreement-header-row">' + logo +
        '<div><p class="agreement-company-name">' + agreement.companyName.replace(/</g, '&lt;') + '</p>' +
        '<h1 class="agreement-page-title">Inspection Agreement</h1>' +
        '<p class="agreement-ref">' + agreement.agreementNumber + ' · ' + (TYPE_LABELS[agreement.inspectionType] || agreement.inspectionType) + '</p></div></div>' +
        '<div class="agreement-summary">' +
        '<div class="summary-item"><div class="label">Client</div><div class="summary-value">' + agreement.clientName.replace(/</g, '&lt;') + '</div><div class="summary-sub">' + agreement.clientEmail.replace(/</g, '&lt;') + '</div></div>' +
        '<div class="summary-item summary-item-wide"><div class="label">Property</div><div class="summary-value">' + agreement.propertyAddress.replace(/</g, '&lt;') + '</div></div>' +
        '<div class="summary-item"><div class="label">Agreement date</div><div class="summary-value">' + formatDate(agreement.agreementDate) + '</div></div>' +
        '</div></div>'
      );
    }

    function renderAgreement(agreement) {
      const sectionItems = agreement.legalSections.sections.map(function (s) {
        return (
          '<div class="terms-item terms-pending" data-id="' + s.id + '">' +
          '<button type="button" class="terms-head" data-id="' + s.id + '">' +
          '<span class="terms-icon">!</span>' +
          '<span class="terms-title">' + s.title.replace(/</g, '&lt;') + '</span>' +
          '<span class="terms-chevron">▼</span></button>' +
          '<div class="terms-body legal-content" hidden>' + sectionBodyHtml(s) + '</div></div>'
        );
      }).join('');

      const termsBlock =
        '<div class="card">' +
        '<h2 style="color:var(--text);margin:0 0 8px">Terms &amp; conditions</h2>' +
        '<p class="terms-intro">Please read each section. Your signature unlocks after you open the Client Declaration.</p>' +
        '<div id="terms-accordion">' + sectionItems + '</div></div>';

      const signBlock = agreement.canSign
        ? '<div class="card" id="sign-form">' +
          '<h2 style="color:var(--text)">Sign agreement</h2>' +
          '<div id="terms-hint" class="terms-hint">Please open and read every terms section above before signing.</div>' +
          '<div id="form-error" class="error" hidden></div>' +
          '<label class="field">Full name<input type="text" id="signature-name" value="' + agreement.clientName.replace(/"/g, '&quot;') + '" /></label>' +
          '<p class="label">Signature</p>' +
          '<div class="sig-wrap"><canvas id="signature-canvas"></canvas></div>' +
          '<div class="sig-actions"><button type="button" class="btn-secondary" id="clear-sig">Clear signature</button></div>' +
          '<label class="checkbox"><input type="checkbox" id="accepted" disabled /><span>I have read and accept the terms, scope, limitations, privacy policy, and client declaration.</span></label>' +
          '<button type="button" class="btn-primary" id="submit-btn" disabled>Sign and submit</button>' +
          '</div>'
        : '<div class="card center"><p class="muted">This agreement is already ' + agreement.status.toLowerCase() + ' and cannot be signed again.</p></div>';

      document.getElementById('app').innerHTML =
        '<div class="wrap">' +
        renderAgreementHeader(agreement) +
        termsBlock +
        signBlock +
        '</div>';

      if (!agreement.canSign) return;

      const reviewed = {};
      let expandedId = null;
      const sections = agreement.legalSections.sections;

      function allTermsReviewed() {
        return sections.every(function (s) { return reviewed[s.id]; });
      }

      function markReviewed(id) {
        reviewed[id] = true;
        const item = document.querySelector('.terms-item[data-id="' + id + '"]');
        if (item) {
          item.classList.add('reviewed');
          item.classList.remove('terms-pending');
          item.querySelector('.terms-icon').textContent = '✓';
        }
      }

      function updateTermsUi() {
        const ready = allTermsReviewed();
        const hint = document.getElementById('terms-hint');
        if (hint) hint.hidden = ready;
        accepted.disabled = !ready;
        if (!ready) accepted.checked = false;
        validate();
      }

      document.querySelectorAll('.terms-head').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const id = btn.getAttribute('data-id');
          const item = btn.closest('.terms-item');
          const body = item.querySelector('.terms-body');
          if (expandedId === id) {
            body.hidden = true;
            item.classList.remove('open');
            expandedId = null;
            markReviewed(id);
            updateTermsUi();
            return;
          }
          if (expandedId) {
            const prev = document.querySelector('.terms-item[data-id="' + expandedId + '"]');
            if (prev) {
              prev.querySelector('.terms-body').hidden = true;
              prev.classList.remove('open');
              markReviewed(expandedId);
            }
          }
          expandedId = id;
          body.hidden = false;
          item.classList.add('open');
        });
      });

      const canvasEl = document.getElementById('signature-canvas');
      const pad = setupSignaturePad(canvasEl);
      const nameInput = document.getElementById('signature-name');
      const accepted = document.getElementById('accepted');
      const submitBtn = document.getElementById('submit-btn');
      const formError = document.getElementById('form-error');

      function validate() {
        submitBtn.disabled = !(nameInput.value.trim() && !pad.isEmpty() && accepted.checked && allTermsReviewed());
      }

      updateTermsUi();
      nameInput.addEventListener('input', validate);
      accepted.addEventListener('change', validate);
      document.getElementById('clear-sig').addEventListener('click', function () { pad.clear(); validate(); });
      canvasEl.addEventListener('mouseup', validate);
      canvasEl.addEventListener('touchend', validate);

      submitBtn.addEventListener('click', async function () {
        formError.hidden = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';
        try {
          const result = await api('/api/sign/' + encodeURIComponent(token), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signatureName: nameInput.value.trim(),
              signatureData: pad.toDataUrl(),
              declarationsAccepted: true,
            }),
          });
          renderSuccess(result.agreementNumber);
        } catch (e) {
          formError.textContent = e.message || 'Signing failed';
          formError.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign and submit';
          validate();
        }
      });
    }

    async function boot() {
      if (!token) {
        renderError('Invalid signing link.');
        return;
      }
      try {
        const agreement = await api('/api/sign/' + encodeURIComponent(token));
        void api('/api/sign/' + encodeURIComponent(token) + '/viewed', { method: 'POST' }).catch(function () {});
        renderAgreement(agreement);
      } catch (e) {
        renderError(e.message || 'This agreement link is invalid or has expired.');
      }
    }

    boot();
  </script>
</body>
</html>`;

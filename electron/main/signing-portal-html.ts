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
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 720px; margin: 0 auto; padding: 16px; }
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

    function renderAgreement(agreement) {
      const sections = agreement.legalSections.sections.map(function (s) {
        return '<div class="section"><h2>' + s.title + '</h2><p>' + s.content + '</p></div>';
      }).join('');

      const signBlock = agreement.canSign
        ? '<div class="card" id="sign-form">' +
          '<h2 style="color:var(--text)">Sign agreement</h2>' +
          '<div id="form-error" class="error" hidden></div>' +
          '<label class="field">Full name<input type="text" id="signature-name" value="' + agreement.clientName.replace(/"/g, '&quot;') + '" /></label>' +
          '<p class="label">Signature</p>' +
          '<div class="sig-wrap"><canvas id="signature-canvas"></canvas></div>' +
          '<div class="sig-actions"><button type="button" class="btn-secondary" id="clear-sig">Clear signature</button></div>' +
          '<label class="checkbox"><input type="checkbox" id="accepted" /><span>I have read and accept the terms, scope, limitations, privacy policy, and client declaration.</span></label>' +
          '<button type="button" class="btn-primary" id="submit-btn" disabled>Sign and submit</button>' +
          '</div>'
        : '<div class="card center"><p class="muted">This agreement is already ' + agreement.status.toLowerCase() + ' and cannot be signed again.</p></div>';

      document.getElementById('app').innerHTML =
        '<div class="wrap">' +
        '<div class="card"><p class="muted">' + agreement.companyName + '</p>' +
        '<h1>Client Inspection Agreement</h1>' +
        '<p class="muted">' + agreement.agreementNumber + ' · ' + (TYPE_LABELS[agreement.inspectionType] || agreement.inspectionType) + '</p></div>' +
        '<div class="card"><div class="grid">' +
        '<div><div class="label">Client</div><div>' + agreement.clientName + '</div><div class="muted">' + agreement.clientEmail + '</div></div>' +
        '<div><div class="label">Property</div><div>' + agreement.propertyAddress + '</div></div>' +
        '<div><div class="label">Total (inc. GST)</div><div class="price">' + formatAud(agreement.totalCents) + '</div></div>' +
        '<div><div class="label">Agreement date</div><div>' + formatDate(agreement.agreementDate) + '</div></div>' +
        '</div></div>' +
        '<div class="card">' + sections + '</div>' +
        signBlock +
        '</div>';

      if (!agreement.canSign) return;

      const canvasEl = document.getElementById('signature-canvas');
      const pad = setupSignaturePad(canvasEl);
      const nameInput = document.getElementById('signature-name');
      const accepted = document.getElementById('accepted');
      const submitBtn = document.getElementById('submit-btn');
      const formError = document.getElementById('form-error');

      function validate() {
        submitBtn.disabled = !(nameInput.value.trim() && !pad.isEmpty() && accepted.checked);
      }

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

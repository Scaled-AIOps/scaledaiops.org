/*! FFRS widget v0.1.0 — Fast Feedback Resolution System. MIT. https://github.com/Scaled-AIOps/ffrs-api
 * Embed: <script src="/assets/js/ffrs-widget.js" data-endpoint="/api/feedback" data-site="example.org"
 *          data-turnstile="<sitekey>" data-screenshot="bug|always|never" defer></script>
 * No dependencies. html2canvas is loaded on demand from data-html2canvas (default /assets/js/vendor/html2canvas.min.js).
 */
(function () {
  'use strict';
  var VERSION = '0.1.0';
  var script = document.currentScript;
  if (!script) return;
  var cfg = {
    endpoint: script.dataset.endpoint || '/api/feedback',
    site: script.dataset.site || location.hostname,
    turnstile: script.dataset.turnstile || '',
    screenshot: script.dataset.screenshot || 'bug',          // capture for bug reports by default, opt-out per submission
    html2canvas: script.dataset.html2canvas || '/assets/js/vendor/html2canvas.min.js',
    statusPath: script.dataset.statusPath || '/feedback/',
  };
  if (location.pathname.indexOf(cfg.statusPath) === 0) return; // the fallback page has its own form

  var KINDS = { feature: 'Request a feature', bug: 'Report a bug' };
  var state = { kind: 'feature', shot: null, token: '', idem: '', busy: false };

  /* ---------- DOM ---------- */
  var tab = el('button', { class: 'ffrs-tab', type: 'button', 'aria-label': 'Send feedback: report a bug or request a feature' },
    [svg(), el('span', {}, ['Feedback'])]);
  var dlg = el('dialog', { class: 'ffrs-dialog', 'aria-labelledby': 'ffrs-title' });
  dlg.innerHTML =
    '<form class="ffrs-form" method="dialog" novalidate>' +
    '  <header class="ffrs-head"><h2 id="ffrs-title">Send feedback</h2><button type="button" class="ffrs-close" aria-label="Close">&times;</button></header>' +
    '  <div class="ffrs-kinds" role="tablist">' +
    '    <button type="button" role="tab" data-kind="feature" aria-selected="true">Request a feature</button>' +
    '    <button type="button" role="tab" data-kind="bug" aria-selected="false">Report a bug</button>' +
    '  </div>' +
    '  <div class="ffrs-shot" hidden><img alt="Screenshot of this page"><button type="button" class="ffrs-shot-x" aria-label="Remove screenshot">&times;</button></div>' +
    '  <label>Title<input name="title" required minlength="3" maxlength="140" placeholder="Short summary"></label>' +
    '  <label>Details<textarea name="body" required minlength="10" maxlength="5000" rows="4" placeholder="What would you like to see?"></textarea></label>' +
    '  <label class="ffrs-sev" hidden>Severity<select name="severity"><option value="low">Low — cosmetic</option><option value="medium" selected>Medium — annoying</option><option value="high">High — blocks a task</option><option value="critical">Critical — site unusable</option></select></label>' +
    '  <label><span>Email <em class="ffrs-opt">(optional)</em></span><input name="email" type="email" maxlength="254" placeholder="you@example.org" autocomplete="email"></label>' +
    '  <label class="ffrs-consent"><input name="consent" type="checkbox"> Email me when this is resolved</label>' +
    '  <label class="ffrs-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
    '  <p class="ffrs-page">Page: <code></code></p>' +
    '  <div class="ffrs-turnstile"></div>' +
    '  <p class="ffrs-err" role="alert" hidden></p>' +
    '  <button type="submit" class="ffrs-submit">Send feature request</button>' +
    '</form>' +
    '<div class="ffrs-done" hidden><h2>Received — thank you.</h2><p>Your reference is <strong class="ffrs-ref"></strong>.<br>Track it at <a class="ffrs-link"></a>.</p><button type="button" class="ffrs-close2">Close</button></div>';
  document.body.appendChild(tab);
  document.body.appendChild(dlg);

  var $ = function (s) { return dlg.querySelector(s); };
  var form = $('.ffrs-form'), err = $('.ffrs-err'), submit = $('.ffrs-submit'), shotBox = $('.ffrs-shot');

  /* ---------- behaviour ---------- */
  tab.addEventListener('click', open);
  $('.ffrs-close').addEventListener('click', close);
  $('.ffrs-close2').addEventListener('click', close);
  $('.ffrs-shot-x').addEventListener('click', function () { state.shot = null; shotBox.hidden = true; });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); }); // backdrop
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });   // Escape
  Array.prototype.forEach.call(dlg.querySelectorAll('[role=tab]'), function (b) { b.addEventListener('click', function () { setKind(b.dataset.kind); }); });
  form.addEventListener('submit', onSubmit);

  function open() {
    state.idem = uuid();
    state.shot = null;
    form.reset();
    setKind('feature');
    err.hidden = true;
    $('.ffrs-done').hidden = true;
    form.hidden = false;
    $('.ffrs-page code').textContent = location.pathname + location.search;
    dlg.showModal();
    if (cfg.turnstile) mountTurnstile();
  }
  function close() { dlg.close(); }
  window.FFRS = { open: open, close: close, version: VERSION };

  function setKind(kind) {
    state.kind = kind;
    Array.prototype.forEach.call(dlg.querySelectorAll('[role=tab]'), function (b) { b.setAttribute('aria-selected', String(b.dataset.kind === kind)); });
    $('.ffrs-sev').hidden = kind !== 'bug';
    $('textarea').placeholder = kind === 'bug' ? 'What happened, and what did you expect?' : 'What would you like to see?';
    submit.textContent = kind === 'bug' ? 'Send bug report' : 'Send feature request';
    var wants = cfg.screenshot === 'always' || (cfg.screenshot === 'bug' && kind === 'bug');
    if (wants && !state.shot) capture(); else if (!wants) { state.shot = null; shotBox.hidden = true; }
  }

  function capture() {
    loadScript(cfg.html2canvas).then(function () {
      tab.style.display = 'none'; dlg.style.visibility = 'hidden';
      return window.html2canvas(document.documentElement, { scale: Math.min(1280 / innerWidth, 1), useCORS: true, logging: false, windowWidth: document.documentElement.scrollWidth, windowHeight: innerHeight });
    }).then(function (canvas) {
      var q = 0.6, url = canvas.toDataURL('image/jpeg', q);
      while (url.length * 0.75 > 300 * 1024 && q > 0.15) { q -= 0.1; url = canvas.toDataURL('image/jpeg', q); }
      state.shot = url; $('.ffrs-shot img').src = url; shotBox.hidden = false;
    }).catch(function () { /* screenshot is best-effort */ }).then(function () { tab.style.display = ''; dlg.style.visibility = ''; });
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.busy) return;
    err.hidden = true;
    if (!form.reportValidity()) return;
    var f = form.elements;
    if (f.consent.checked && !f.email.value) return fail('Add your email so we can tell you when it is resolved, or untick the box.');
    if (cfg.turnstile && !state.token) return fail('Human check is still running — try again in a second.');
    var payload = {
      kind: state.kind, title: f.title.value.trim(), body: f.body.value.trim(),
      pageUrl: location.href.slice(0, 2000), consent: f.consent.checked,
      meta: { vw: innerWidth, vh: innerHeight, widget: VERSION, site: cfg.site },
    };
    if (state.kind === 'bug') payload.severity = f.severity.value;
    if (f.email.value) payload.email = f.email.value.trim();
    if (state.shot) payload.screenshot = state.shot;
    if (f.website.value) payload.website = f.website.value;
    if (state.token) payload.turnstileToken = state.token;

    busy(true);
    fetch(cfg.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': state.idem }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        busy(false);
        if (res.s === 202 || res.s === 200) return done(res.j.ref);
        var code = res.j && res.j.error && res.j.error.code;
        if (code === 'ffrs_disabled') { tab.remove(); return fail('Feedback is paused right now. Please try again later.'); }
        if (code === 'rate_limited') return fail('Too many submissions from your network — wait a minute and retry.');
        if (code === 'invalid_input') return fail('Please check: ' + res.j.error.details.map(function (d) { return d.path + ' ' + d.message; }).join('; '));
        if (code === 'turnstile_failed') { state.token = ''; return fail('Human check failed — please retry.'); }
        fail('Could not send (' + res.s + '). Please try again.');
      })
      .catch(function () { busy(false); fail('Network error — your feedback was not sent. Please retry.'); });
  }

  function done(ref) {
    form.hidden = true;
    var d = $('.ffrs-done'); d.hidden = false;
    $('.ffrs-ref').textContent = ref;
    var a = $('.ffrs-link'); a.href = cfg.statusPath + '?ref=' + encodeURIComponent(ref); a.textContent = location.host + cfg.statusPath + '?ref=' + ref;
    $('.ffrs-close2').focus();
  }
  function fail(msg) { err.textContent = msg; err.hidden = false; }
  function busy(b) { state.busy = b; submit.disabled = b; submit.textContent = b ? 'Sending…' : (state.kind === 'bug' ? 'Send bug report' : 'Send feature request'); }

  function mountTurnstile() {
    var box = $('.ffrs-turnstile');
    if (box.dataset.mounted) { if (window.turnstile) window.turnstile.reset(box.dataset.mounted); return; }
    loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit').then(function () {
      box.dataset.mounted = window.turnstile.render(box, { sitekey: cfg.turnstile, size: 'flexible', appearance: 'interaction-only', callback: function (t) { state.token = t; }, 'expired-callback': function () { state.token = ''; } });
    });
  }

  /* ---------- utils ---------- */
  function el(tag, attrs, kids) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (k) { n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); }); return n; }
  function svg() { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>'; return s; }
  var loaded = {};
  function loadScript(src) { return loaded[src] || (loaded[src] = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = function () { delete loaded[src]; no(new Error('load ' + src)); }; document.head.appendChild(s); })); }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); }
})();

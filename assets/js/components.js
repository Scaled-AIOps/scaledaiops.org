/* ScaledAIOps — Shared Components */

(function () {
  var path = window.location.pathname;

  function isActive(href) {
    if (href === '/') return path === '/' || path === '/index.html';
    return path.startsWith(href);
  }

  function navLink(href, label) {
    var cls = isActive(href) ? ' class="active"' : '';
    return '<a href="' + href + '"' + cls + '>' + label + '</a>';
  }

  var headerHTML =
    '<header class="site-header">' +
      '<div class="header-inner">' +
        '<a href="/" class="site-logo">Scaled<span>AIOps</span></a>' +
        '<button class="nav-toggle" aria-label="Toggle navigation">&#9776;</button>' +
        '<nav class="site-nav">' +
          navLink('/', 'Framework') +
          navLink('/disciplines/', 'Disciplines') +
          navLink('/principles/', 'Principles') +
          navLink('/roles/', 'Roles') +
          navLink('/about/', 'About') +
          '<a href="https://github.com/Scaled-AIOps" class="btn btn-outline" style="padding:0.4rem 1rem;">GitHub</a>' +
        '</nav>' +
      '</div>' +
    '</header>';

  var footerHTML =
    '<footer class="site-footer">' +
      '<div class="container">' +
        '<div class="footer-links">' +
          '<a href="/about/">About</a>' +
          '<a href="/principles/">Principles</a>' +
          '<a href="https://github.com/Scaled-AIOps">GitHub</a>' +
        '</div>' +
        '<p>&copy; 2026 ScaledAIOps Contributors. This work is licensed under ' +
          '<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</p>' +
      '</div>' +
    '</footer>';

  // Inject components
  var headerEl = document.getElementById('site-header');
  var footerEl = document.getElementById('site-footer');
  if (headerEl) headerEl.innerHTML = headerHTML;
  if (footerEl) footerEl.innerHTML = footerHTML;

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      document.querySelector('.site-nav').classList.toggle('open');
    });
  }

  // Hide loader, show content
  var loader = document.getElementById('page-loader');
  var content = document.getElementById('page-content');
  if (loader) loader.style.display = 'none';
  if (content) {
    content.style.display = 'block';
    content.style.opacity = '0';
    content.style.transition = 'opacity 0.3s ease';
    requestAnimationFrame(function () {
      content.style.opacity = '1';
    });
  }
})();

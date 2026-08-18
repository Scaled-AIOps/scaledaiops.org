// Local run against dist/ served on :8765 (python3 -m http.server 8765 -d dist). Used by CI/agents; 404 test needs CloudFront and is skipped here.
const base = require('./playwright.config.js');
// ssl-redirects need real network to production; skip them locally too.
module.exports = { ...base, use: { ...base.use, baseURL: process.env.BASE_URL || 'http://localhost:8765' }, grepInvert: /404 page|SSL/ , workers: 2, timeout: 20000 };

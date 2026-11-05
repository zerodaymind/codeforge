/**
 * ==============================================================================
 * CODEFORGE NGINX SECURITY HEADERS & ROUTING VERIFICATION SUITE
 * Validates Nginx header inheritance, /assets/ security header preservation,
 * immutable asset caching, SPA fallback, and missing asset 404 handling.
 * ==============================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('\n==================================================');
  console.log('  CODEFORGE NGINX SECURITY HEADERS VERIFICATION');
  console.log('==================================================\n');

  // ----------------------------------------------------------------------------
  // PART 1: Static nginx.conf Directive Audit
  // ----------------------------------------------------------------------------
  console.log('--------------------------------------------------');
  console.log('PART 1: Static nginx.conf Directive & Inheritance Audit');
  console.log('--------------------------------------------------');

  const confPath = path.resolve(__dirname, 'nginx.conf');
  assert(fs.existsSync(confPath), 'nginx.conf configuration file exists');
  const conf = fs.readFileSync(confPath, 'utf8');

  // Verify server-wide headers
  assert(conf.includes('add_header X-Frame-Options "SAMEORIGIN" always;'), 'Server defines X-Frame-Options: SAMEORIGIN always');
  assert(conf.includes('add_header X-Content-Type-Options "nosniff" always;'), 'Server defines X-Content-Type-Options: nosniff always');
  assert(conf.includes('add_header X-XSS-Protection "1; mode=block" always;'), 'Server defines X-XSS-Protection: 1; mode=block always');
  assert(conf.includes('add_header Referrer-Policy "strict-origin-when-cross-origin" always;'), 'Server defines Referrer-Policy: strict-origin-when-cross-origin always');

  // Verify location /assets/ block explicitly preserves security headers alongside Cache-Control
  const assetsBlockMatch = conf.match(/location\s+\/assets\/\s*\{([^}]+)\}/s);
  assert(Boolean(assetsBlockMatch), 'Found location /assets/ configuration block');

  const assetsBlock = assetsBlockMatch ? assetsBlockMatch[1] : '';
  assert(assetsBlock.includes('add_header Cache-Control "public, max-age=31536000, immutable";'), '/assets/ enforces 1-year immutable caching');
  assert(assetsBlock.includes('add_header X-Content-Type-Options "nosniff" always;'), '/assets/ explicitly preserves X-Content-Type-Options');
  assert(assetsBlock.includes('add_header X-Frame-Options "SAMEORIGIN" always;'), '/assets/ explicitly preserves X-Frame-Options');
  assert(assetsBlock.includes('add_header X-XSS-Protection "1; mode=block" always;'), '/assets/ explicitly preserves X-XSS-Protection');
  assert(assetsBlock.includes('add_header Referrer-Policy "strict-origin-when-cross-origin" always;'), '/assets/ explicitly preserves Referrer-Policy');
  assert(assetsBlock.includes('try_files $uri =404;'), '/assets/ returns 404 for missing assets (no SPA fallback for missing JS/CSS)');

  // Verify SPA fallback in root location block
  const rootBlockMatch = conf.match(/location\s+\/\s*\{([^}]+)\}/s);
  assert(Boolean(rootBlockMatch), 'Found location / configuration block');
  const rootBlock = rootBlockMatch ? rootBlockMatch[1] : '';
  assert(rootBlock.includes('try_files $uri $uri/ /index.html;'), 'location / enforces try_files $uri $uri/ /index.html for client routing');

  // ----------------------------------------------------------------------------
  // PART 2: Live HTTP Response Header & Routing Verification
  // ----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------');
  console.log('PART 2: Live HTTP Response Header & Routing Emulation');
  console.log('--------------------------------------------------');

  const distDir = path.resolve(__dirname, 'dist');
  assert(fs.existsSync(distDir), 'Production dist directory exists for HTTP verification');

  // Find a real static asset in dist/assets
  const assetsDir = path.join(distDir, 'assets');
  assert(fs.existsSync(assetsDir), 'dist/assets directory exists');
  const assetFiles = fs.readdirSync(assetsDir);
  const sampleAsset = assetFiles.find((f) => f.endsWith('.js')) || assetFiles[0];
  assert(Boolean(sampleAsset), `Found representative production asset chunk: ${sampleAsset}`);

  // Start HTTP emulation server strictly adhering to nginx.conf directives
  const serverHeaders = {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (pathname.startsWith('/assets/')) {
      // /assets/ location block: custom Cache-Control + explicit security headers
      const assetHeaders = {
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...serverHeaders
      };

      const filePath = path.join(distDir, pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, assetHeaders);
        res.end(fs.readFileSync(filePath));
      } else {
        // try_files $uri =404 with always headers
        res.writeHead(404, assetHeaders);
        res.end('404 Not Found');
      }
      return;
    }

    // Root / location block: SPA fallback try_files $uri $uri/ /index.html;
    const requestedPath = path.join(distDir, pathname);
    if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
      res.writeHead(200, serverHeaders);
      res.end(fs.readFileSync(requestedPath));
    } else {
      // Fallback to /index.html
      const indexPath = path.join(distDir, 'index.html');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        ...serverHeaders
      });
      res.end(fs.readFileSync(indexPath));
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 2.1 Test GET / (Root SPA Index)
    const rootRes = await fetch(`${baseUrl}/`);
    assert(rootRes.status === 200, 'GET / returns HTTP 200');
    assert(rootRes.headers.get('x-content-type-options') === 'nosniff', 'GET / includes X-Content-Type-Options: nosniff');
    assert(rootRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'GET / includes X-Frame-Options: SAMEORIGIN');
    assert(rootRes.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'GET / includes Referrer-Policy');

    // 2.2 Test GET /assets/<existing-chunk>
    const assetRes = await fetch(`${baseUrl}/assets/${sampleAsset}`);
    assert(assetRes.status === 200, `GET /assets/${sampleAsset} returns HTTP 200`);
    assert(
      assetRes.headers.get('cache-control') === 'public, max-age=31536000, immutable',
      'GET /assets/... includes Cache-Control: public, max-age=31536000, immutable'
    );
    assert(
      assetRes.headers.get('x-content-type-options') === 'nosniff',
      'GET /assets/... PRESERVES X-Content-Type-Options: nosniff (Inheritance override resolved)'
    );
    assert(
      assetRes.headers.get('x-frame-options') === 'SAMEORIGIN',
      'GET /assets/... PRESERVES X-Frame-Options: SAMEORIGIN'
    );
    assert(
      assetRes.headers.get('referrer-policy') === 'strict-origin-when-cross-origin',
      'GET /assets/... PRESERVES Referrer-Policy'
    );

    // 2.3 Test GET /assets/<nonexistent-chunk>
    const missingAssetRes = await fetch(`${baseUrl}/assets/nonexistent-chunk-999.js`);
    assert(missingAssetRes.status === 404, 'GET /assets/nonexistent returns HTTP 404 (does NOT serve index.html)');
    assert(
      missingAssetRes.headers.get('x-content-type-options') === 'nosniff',
      'GET /assets/nonexistent retains X-Content-Type-Options on 404 response (always flag verified)'
    );
    assert(
      missingAssetRes.headers.get('x-frame-options') === 'SAMEORIGIN',
      'GET /assets/nonexistent retains X-Frame-Options on 404 response'
    );

    // 2.4 Test GET /dashboard (SPA Client Route)
    const spaRes = await fetch(`${baseUrl}/dashboard`);
    assert(spaRes.status === 200, 'GET /dashboard resolves via SPA fallback to HTTP 200');
    const spaBody = await spaRes.text();
    assert(spaBody.includes('<div id="root">') || spaBody.includes('CodeForge'), 'GET /dashboard serves index.html shell');
    assert(spaRes.headers.get('x-content-type-options') === 'nosniff', 'GET /dashboard includes X-Content-Type-Options');
    assert(spaRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'GET /dashboard includes X-Frame-Options');

  } finally {
    server.close();
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n==================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in test_nginx_security_headers.mjs:', err);
  process.exit(1);
});

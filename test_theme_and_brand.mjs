import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('==================================================');
console.log('  CODEFORGE BRAND IDENTITY, FAVICON & DARK MODE  ');
console.log('  Automated Verification & Integrity Suite       ');
console.log('==================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failed++;
  }
}

// --------------------------------------------------
// PART 1: Brand Assets & Favicon Architecture
// --------------------------------------------------
console.log('--------------------------------------------------');
console.log('PART 1: Brand Assets & Favicon Architecture');
console.log('--------------------------------------------------');

const svgPath = path.join(__dirname, 'public', 'favicon.svg');
assert(fs.existsSync(svgPath), 'public/favicon.svg asset exists');

const svgContent = fs.readFileSync(svgPath, 'utf8');
assert(svgContent.includes('<svg') && svgContent.includes('</svg>'), 'favicon.svg is a valid SVG document');
assert(svgContent.includes('viewBox="0 0 64 64"'), 'favicon.svg has scalable 64x64 viewBox');
assert(svgContent.includes('#0f172a') || svgContent.includes('#0d1117') || svgContent.includes('#090d16'), 'favicon.svg has dark charcoal/slate container base');
assert(svgContent.includes('d="M 23 18 L 11 32 L 23 46"'), 'favicon.svg features code bracket (<) chevron motif');
assert(svgContent.includes('d="M 31 18 L 31 46"'), 'favicon.svg features forge (F) vertical spine monogram');
assert(svgContent.includes('d="M 31 18 L 47 18"'), 'favicon.svg features forge (F) top bar');
assert(svgContent.includes('#fbbf24') || svgContent.includes('✦'), 'favicon.svg features radiant gold forge spark (✦)');

const png32Path = path.join(__dirname, 'public', 'favicon-32x32.png');
assert(fs.existsSync(png32Path), 'public/favicon-32x32.png asset exists');

const pngBuffer = fs.readFileSync(png32Path);
const isPngSignature =
  pngBuffer[0] === 0x89 &&
  pngBuffer[1] === 0x50 &&
  pngBuffer[2] === 0x4e &&
  pngBuffer[3] === 0x47 &&
  pngBuffer[4] === 0x0d &&
  pngBuffer[5] === 0x0a &&
  pngBuffer[6] === 0x1a &&
  pngBuffer[7] === 0x0a;
assert(isPngSignature, 'favicon-32x32.png has valid PNG magic signature');

const indexPath = path.join(__dirname, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
assert(indexHtml.includes('rel="icon" type="image/svg+xml" href="/favicon.svg"'), 'index.html references SVG favicon');
assert(indexHtml.includes('rel="alternate icon" type="image/png" href="/favicon-32x32.png"'), 'index.html references alternate PNG favicon');
assert(indexHtml.includes('rel="apple-touch-icon" href="/favicon.svg"'), 'index.html references Apple Touch icon');
assert(indexHtml.includes('localStorage.getItem(\'codeforge-theme\')'), 'index.html includes anti-FOUC theme script reading localStorage');
assert(indexHtml.includes('document.documentElement.setAttribute(\'data-bs-theme\''), 'index.html sets data-bs-theme prior to DOM paint');
assert(indexHtml.includes('prefers-color-scheme: dark'), 'index.html checks prefers-color-scheme media query');

// --------------------------------------------------
// PART 2: Theme Context & Navbar Control
// --------------------------------------------------
console.log('\n--------------------------------------------------');
console.log('PART 2: Centralized Theme Context & Navigation Toggle');
console.log('--------------------------------------------------');

const themeContextPath = path.join(__dirname, 'src', 'context', 'ThemeContext.jsx');
assert(fs.existsSync(themeContextPath), 'src/context/ThemeContext.jsx exists');

const themeContextContent = fs.readFileSync(themeContextPath, 'utf8');
assert(themeContextContent.includes('function ThemeProvider'), 'ThemeProvider component implemented');
assert(themeContextContent.includes('codeforge-theme'), 'ThemeContext uses "codeforge-theme" localStorage key');
assert(themeContextContent.includes('addEventListener(\'storage\''), 'ThemeContext synchronizes across browser tabs via storage event');
assert(themeContextContent.includes('matchMedia(\'(prefers-color-scheme: dark)\')'), 'ThemeContext observes OS system preference changes');
assert(themeContextContent.includes('data-bs-theme'), 'ThemeContext updates data-bs-theme on documentElement');

const useThemePath = path.join(__dirname, 'src', 'context', 'useTheme.js');
assert(fs.existsSync(useThemePath), 'src/context/useTheme.js exists');

const useThemeContent = fs.readFileSync(useThemePath, 'utf8');
assert(useThemeContent.includes('export function useTheme()'), 'useTheme custom hook exported');

const appPath = path.join(__dirname, 'src', 'App.jsx');
const appContent = fs.readFileSync(appPath, 'utf8');
assert(appContent.includes('<ThemeProvider>'), 'App.jsx wraps application tree in ThemeProvider');

const themeTogglePath = path.join(__dirname, 'src', 'components', 'ThemeToggle.jsx');
assert(fs.existsSync(themeTogglePath), 'src/components/ThemeToggle.jsx exists');

const themeToggleContent = fs.readFileSync(themeTogglePath, 'utf8');
assert(themeToggleContent.includes('aria-label='), 'ThemeToggle provides accessible aria-label');
assert(themeToggleContent.includes('aria-haspopup="true"'), 'ThemeToggle implements aria-haspopup');
assert(themeToggleContent.includes('aria-expanded='), 'ThemeToggle implements aria-expanded state');
assert(themeToggleContent.includes('handleKeyDown'), 'ThemeToggle implements keyboard navigation handler');
assert(themeToggleContent.includes('Escape'), 'ThemeToggle handles Escape key dismiss');
assert(themeToggleContent.includes('ArrowDown') && themeToggleContent.includes('ArrowUp'), 'ThemeToggle handles Arrow key navigation');

const navbarPath = path.join(__dirname, 'src', 'components', 'Navbar.jsx');
const navbarContent = fs.readFileSync(navbarPath, 'utf8');
assert(navbarContent.includes('<ThemeToggle />') || navbarContent.includes('<ThemeToggle/>'), 'Navbar includes ThemeToggle control');
assert(navbarContent.includes('src="/favicon.svg"'), 'Navbar brand includes CodeForge brand icon');

const footerPath = path.join(__dirname, 'src', 'components', 'Footer.jsx');
const footerContent = fs.readFileSync(footerPath, 'utf8');
assert(footerContent.includes('src="/favicon.svg"'), 'Footer brand includes CodeForge brand icon');

// --------------------------------------------------
// PART 3: Monaco Editor Theme Synchronization
// --------------------------------------------------
console.log('\n--------------------------------------------------');
console.log('PART 3: Monaco Editor Theme Synchronization');
console.log('--------------------------------------------------');

const editorPath = path.join(__dirname, 'src', 'components', 'CodeEditor.jsx');
assert(fs.existsSync(editorPath), 'src/components/CodeEditor.jsx exists');

const editorContent = fs.readFileSync(editorPath, 'utf8');
assert(editorContent.includes('useTheme()'), 'CodeEditor consumes useTheme hook');
assert(editorContent.includes('resolvedTheme === \'dark\' ? \'vs-dark\' : \'light\''), 'CodeEditor synchronizes editor theme with app resolvedTheme');
assert(editorContent.includes('codeforge-editor-theme'), 'CodeEditor persists explicit manual user overrides in localStorage');
assert(editorContent.includes('theme={effectiveEditorTheme}'), 'CodeEditor applies effectiveEditorTheme to Monaco Editor instance');

// --------------------------------------------------
// PART 4: Design Tokens & Dark Mode CSS Rules
// --------------------------------------------------
console.log('\n--------------------------------------------------');
console.log('PART 4: Design Tokens & Dark Mode CSS Rules');
console.log('--------------------------------------------------');

const cssPath = path.join(__dirname, 'src', 'index.css');
assert(fs.existsSync(cssPath), 'src/index.css exists');

const cssContent = fs.readFileSync(cssPath, 'utf8');
assert(cssContent.includes('--cf-bg: #f8f9fa;'), 'Light theme defines --cf-bg design token');
assert(cssContent.includes('--cf-surface: #ffffff;'), 'Light theme defines --cf-surface design token');
assert(cssContent.includes('[data-bs-theme="dark"]'), 'CSS defines [data-bs-theme="dark"] ruleset');
assert(cssContent.includes('--cf-bg: #0d1117;'), 'Dark theme uses dark charcoal background (--cf-bg: #0d1117)');
assert(cssContent.includes('--cf-surface: #161b22;'), 'Dark theme defines elevated card surface (--cf-surface: #161b22)');
assert(cssContent.includes('--cf-surface-elevated: #21262d;'), 'Dark theme defines header/sub-panel surface (--cf-surface-elevated: #21262d)');
assert(cssContent.includes('--cf-border: #30363d;'), 'Dark theme defines border token (--cf-border: #30363d)');
assert(cssContent.includes('--cf-text-primary: #f0f6fc;'), 'Dark theme defines primary text token (--cf-text-primary: #f0f6fc)');
assert(cssContent.includes('--cf-text-secondary: #8b949e;'), 'Dark theme defines secondary text token (--cf-text-secondary: #8b949e)');
assert(cssContent.includes('--cf-primary: #38bdf8;'), 'Dark theme defines cyan interactive accent (--cf-primary: #38bdf8)');
assert(cssContent.includes('--cf-accent: #818cf8;'), 'Dark theme defines violet brand accent (--cf-accent: #818cf8)');
assert(cssContent.includes('[data-bs-theme="dark"] .bg-white'), 'Dark mode overrides .bg-white containers to prevent light flashes');
assert(cssContent.includes('[data-bs-theme="dark"] .bg-light'), 'Dark mode overrides .bg-light containers');
assert(cssContent.includes('[data-bs-theme="dark"] .text-dark'), 'Dark mode overrides .text-dark for high contrast readability');
assert(cssContent.includes('[data-bs-theme="dark"] .card'), 'Dark mode styles cards with dark surface and borders');
assert(cssContent.includes('[data-bs-theme="dark"] .form-control'), 'Dark mode styles form inputs and focus rings');
assert(cssContent.includes('[data-bs-theme="dark"] thead.table-secondary th'), 'Dark mode styles table header rows for readability');
assert(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'CSS supports prefers-reduced-motion');

// --------------------------------------------------
// PART 5: Production Build Output Verification
// --------------------------------------------------
console.log('\n--------------------------------------------------');
console.log('PART 5: Production Build Output Verification');
console.log('--------------------------------------------------');

const distPath = path.join(__dirname, 'dist');
assert(fs.existsSync(distPath), 'dist/ production directory exists');

const distFaviconSvg = path.join(distPath, 'favicon.svg');
assert(fs.existsSync(distFaviconSvg), 'dist/favicon.svg exists in production build');

const distFaviconPng = path.join(distPath, 'favicon-32x32.png');
assert(fs.existsSync(distFaviconPng), 'dist/favicon-32x32.png exists in production build');

const distIndexPath = path.join(distPath, 'index.html');
const distHtml = fs.readFileSync(distIndexPath, 'utf8');
assert(distHtml.includes('favicon.svg'), 'dist/index.html includes SVG favicon reference');
assert(distHtml.includes('data-bs-theme'), 'dist/index.html includes inline anti-FOUC theme script');

console.log('\n==================================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
}

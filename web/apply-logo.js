// Run from the web/ folder:  node apply-logo.js
// Puts the FarseIT logo (BrandLogo component) in every brand spot. Safe to run twice.
const fs = require('fs');

const SITE_BLOCK =
  /<span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink">\s*<span className="h-2 w-2 rounded-full bg-signal" \/>\s*<\/span>\s*<span className="font-display text-lg font-semibold tracking-tight">\s*Farse<span className="text-brand">IT<\/span>\s*<\/span>/;
const SHELL_BLOCK =
  /<span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink">\s*<span className="h-2 w-2 rounded-full bg-signal" \/>\s*<\/span>\s*<span className="font-display text-lg font-semibold tracking-tight">\s*Farse<span className="text-primary"> AI<\/span>\s*<\/span>/;

const EDITS = [
  { file: 'src/components/site/Navbar.js', q: '"', re: SITE_BLOCK, to: '<BrandLogo className="h-14 w-auto" />' },
  { file: 'src/components/site/Footer.js', q: '"', re: SITE_BLOCK, to: '<BrandLogo className="h-14 w-auto" />' },
  { file: 'src/components/site/LegalPage.js', q: '"', re: SITE_BLOCK, to: '<BrandLogo className="h-14 w-auto" />' },
  {
    file: 'src/components/shop/ShopShell.tsx',
    q: "'",
    re: SHELL_BLOCK,
    to: `<BrandLogo className="h-10 w-auto" />
        <span className="rounded-md bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">AI</span>`,
  },
  {
    file: 'src/app/(app)/shop/start/page.tsx',
    q: "'",
    re: /function Logo\(\{ dark = false \}: \{ dark\?: boolean \}\) \{[\s\S]*?\n\}\r?\n/,
    to: `function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className={dark ? 'rounded-lg bg-white px-2.5 py-1.5' : ''}>
      <BrandLogo className="h-10 w-auto" />
    </span>
  );
}
`,
  },
  {
    file: 'src/components/admin/SaasAdminShell.tsx',
    q: "'",
    re: /<span className="[^"]*">F<\/span>\s*Farse AI /,
    to: '<BrandLogo className="h-9 w-auto" /> ',
  },
  {
    file: 'src/components/shop/LandingView.tsx',
    q: "'",
    re: /<Link href="\/shop\/start" className="font-semibold hover:underline">\s*Farse AI\s*<\/Link>/,
    to: '<Link href="/shop/start" className="inline-flex items-center gap-1 align-middle font-semibold hover:underline"><BrandLogo className="h-6 w-auto" /><span className="font-display">AI</span></Link>',
  },
  {
    file: 'src/components/shop/PendingApproval.tsx',
    q: "'",
    re: /<div className="relative mx-auto grid h-16 w-16 place-items-center">/,
    to: '<div className="mb-5 flex justify-center"><BrandLogo className="h-12 w-auto" /></div>\n        <div className="relative mx-auto grid h-16 w-16 place-items-center">',
  },
];

function addImport(src, q) {
  const line = `import { BrandLogo } from ${q}@/components/BrandLogo${q};`;
  if (src.includes('@/components/BrandLogo')) return src;
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const m = src.match(/^(\uFEFF)?\s*(['"])use client\2;?\r?\n/);
  if (m) return src.slice(0, m[0].length) + line + eol + src.slice(m[0].length);
  return line + eol + src;
}

let n = 0;
for (const e of EDITS) {
  if (!fs.existsSync(e.file)) { console.log('missing  ', e.file); continue; }
  const src = fs.readFileSync(e.file, 'utf8');
  if (src.includes('@/components/BrandLogo')) { console.log('already  ', e.file); continue; }
  if (!e.re.test(src)) { console.log('no match ', e.file, '(already done or file differs)'); continue; }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const out = addImport(src.replace(e.re, e.to.replace(/\n/g, eol)), e.q);
  fs.writeFileSync(e.file, out);
  n++;
  console.log('updated  ', e.file);
}
console.log(`\nDone. ${n} file(s) updated.`);

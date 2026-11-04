// Run from the web/ folder:  node restyle.js
// Applies the Farse theme find/replace rules to every dashboard page.
const fs = require('fs');
const path = require('path');

const ROOTS = [
  'src/app/(app)/shop/(panel)',
  'src/app/(app)/shop/start',
  'src/app/(app)/admin',
  'src/components/shop/PendingApproval.tsx',
  'src/components/admin/SaasAdminShell.tsx',
];

const RULES = [
  // headings -> Space Grotesk
  [/font-extrabold/g, 'font-display font-semibold'],
  [/<h1 className="text-2xl font-bold tracking-tight sm:text-\[28px\]"/g, '<h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[30px]"'],
  [/<h1 className="mt-5 text-xl font-bold"/g, '<h1 className="mt-5 font-display text-xl font-semibold"'],
  [/<h2 className="text-xl font-bold tracking-tight"/g, '<h2 className="font-display text-xl font-semibold tracking-tight"'],
  [/<(h2|h3) className="font-semibold"/g, '<$1 className="font-display text-base font-semibold"'],
  [/<h2 className="flex items-center gap-2 font-semibold leading-tight"/g, '<h2 className="flex items-center gap-2 font-display font-semibold leading-tight"'],
  // card radius = website f-card
  [/rounded-2xl/g, 'rounded-xl'],
  // hard-coded amber/colors -> theme orange (works in dark mode too)
  [/bg-amber-100 text-amber-700/g, 'bg-signal/15 text-signal'],
  [/bg-amber-50 px-([\d.]+) py-([\d.]+) text-xs text-amber-800/g, 'bg-signal/10 px-$1 py-$2 text-xs text-signal'],
  [/bg-amber-50 text-amber-800/g, 'bg-signal/10 text-signal'],
  [/bg-amber-50/g, 'bg-signal/10'],
  [/border-amber-200/g, 'border-signal/30'],
  [/text-amber-900/g, 'text-signal'],
  [/text-amber-700/g, 'text-signal'],
  [/text-amber-800/g, 'text-signal'],
  [/bg-amber-100/g, 'bg-signal/15'],
  [/bg-amber-400/g, 'bg-signal'],
  [/bg-amber-500/g, 'bg-signal'],
  [/border-white(?=[ "'])/g, 'border-background'],
  // inbox avatar palette -> theme colors
  [/'bg-rose-100 text-rose-700'/g, "'bg-danger/10 text-danger'"],
  [/'bg-sky-100 text-sky-700'/g, "'bg-primary-soft text-primary'"],
  [/'bg-emerald-100 text-emerald-700'/g, "'bg-success/15 text-success'"],
  [/'bg-violet-100 text-violet-700'/g, "'bg-surface-2 text-foreground'"],
  [/'bg-teal-100 text-teal-700'/g, "'bg-ink text-white'"],
];

let changed = 0;
const walk = (p) => {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) return fs.readdirSync(p).forEach((f) => walk(path.join(p, f)));
  if (!/\.(tsx|ts|js|jsx)$/.test(p)) return;
  const src = fs.readFileSync(p, 'utf8');
  let out = src;
  for (const [re, to] of RULES) out = out.replace(re, to);
  if (out !== src) {
    fs.writeFileSync(p, out);
    changed++;
    console.log('updated', p);
  }
};
ROOTS.forEach(walk);
console.log(`\nDone. ${changed} file(s) updated.`);
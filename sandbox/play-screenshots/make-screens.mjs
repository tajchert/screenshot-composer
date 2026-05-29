// Generates placeholder "Basket" grocery-app screens as 1080x2400 PNGs.
// Reproducible: `node sandbox/play-screenshots/make-screens.mjs` from the repo root.
// Writes the same six screens into every locale's phone input dir.
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const W = 1080;
const H = 2400;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = ['en-US', 'de-DE'];

// --- palette (the fictional app's own UI, distinct from the listing theme) ---
const INK = '#0F172A';
const SUB = '#64748B';
const LINE = '#E2E8F0';
const CARD = '#FFFFFF';
const GREEN = '#16A34A';
const GREEN_SOFT = '#DCFCE7';
const AMBER = '#F59E0B';

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

function statusBar(fg = INK) {
  return `
    <text x="64" y="92" fill="${fg}" font-family="${FONT}" font-size="40" font-weight="600">9:41</text>
    <g fill="${fg}">
      <rect x="900" y="64" width="34" height="26" rx="5"/>
      <rect x="946" y="58" width="60" height="34" rx="8"/>
      <rect x="1010" y="68" width="6" height="14" rx="3"/>
    </g>`;
}

function shell(inner, bg = '#F8FAFC') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${bg}"/>
    ${inner}
  </svg>`;
}

function logo(x, y, fg = INK) {
  return `
    <circle cx="${x + 26}" cy="${y}" r="26" fill="${GREEN}"/>
    <path d="M ${x + 14} ${y + 2} q 12 18 24 0" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>
    <text x="${x + 70}" y="${y + 16}" fill="${fg}" font-family="${FONT}" font-size="48" font-weight="800">Basket</text>`;
}

function pill(x, y, w, label, fill, fg) {
  return `<rect x="${x}" y="${y}" width="${w}" height="64" rx="32" fill="${fill}"/>
    <text x="${x + w / 2}" y="${y + 42}" fill="${fg}" font-family="${FONT}" font-size="30" font-weight="600" text-anchor="middle">${label}</text>`;
}

// --- 1. onboarding: hero ---
function onboarding() {
  return shell(`
    ${statusBar('#fff')}
    <rect width="${W}" height="${H}" fill="${GREEN}"/>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.45" stop-color="#16A34A"/><stop offset="1" stop-color="#0E7A36"/>
    </linearGradient></defs>
    ${logo(64, 200, '#fff')}
    <circle cx="540" cy="980" r="340" fill="#ffffff" opacity="0.12"/>
    <circle cx="540" cy="980" r="230" fill="#ffffff" opacity="0.16"/>
    <text x="540" y="1005" font-size="220" text-anchor="middle">🛒</text>
    <text x="64" y="1560" fill="#fff" font-family="${FONT}" font-size="92" font-weight="800">Groceries in</text>
    <text x="64" y="1670" fill="#fff" font-family="${FONT}" font-size="92" font-weight="800">10 minutes.</text>
    <text x="64" y="1770" fill="#DCFCE7" font-family="${FONT}" font-size="42">Fresh produce, snacks &amp; essentials,</text>
    <text x="64" y="1828" fill="#DCFCE7" font-family="${FONT}" font-size="42">delivered before you unpack.</text>
    ${pill(64, 2080, 952, 'Get started', '#fff', GREEN)}
    <text x="540" y="2240" fill="#DCFCE7" font-family="${FONT}" font-size="34" text-anchor="middle">Already have an account? Log in</text>
  `, GREEN);
}

// --- 2. browse: category + product grid ---
function card(x, y, emoji, name, price) {
  return `<rect x="${x}" y="${y}" width="440" height="520" rx="40" fill="${CARD}" stroke="${LINE}" stroke-width="2"/>
    <rect x="${x + 40}" y="${y + 40}" width="360" height="300" rx="28" fill="${GREEN_SOFT}"/>
    <text x="${x + 220}" y="${y + 245}" font-size="150" text-anchor="middle">${emoji}</text>
    <text x="${x + 40}" y="${y + 408}" fill="${INK}" font-family="${FONT}" font-size="38" font-weight="700">${name}</text>
    <text x="${x + 40}" y="${y + 470}" fill="${GREEN}" font-family="${FONT}" font-size="40" font-weight="800">${price}</text>
    <circle cx="${x + 372}" cy="${y + 448}" r="36" fill="${GREEN}"/>
    <text x="${x + 372}" y="${y + 463}" fill="#fff" font-family="${FONT}" font-size="48" font-weight="700" text-anchor="middle">+</text>`;
}
function browse() {
  const cats = ['Fruit', 'Bakery', 'Dairy', 'Drinks'];
  let catRow = '';
  cats.forEach((c, i) => {
    const x = 64 + i * 240;
    const active = i === 0;
    catRow += pill(x, 470, 210, c, active ? GREEN : '#fff', active ? '#fff' : SUB);
  });
  return shell(`
    ${statusBar()}
    ${logo(64, 220, INK)}
    <rect x="64" y="300" width="952" height="96" rx="48" fill="${CARD}" stroke="${LINE}" stroke-width="2"/>
    <text x="120" y="362" fill="${SUB}" font-family="${FONT}" font-size="38">Search fresh groceries…</text>
    ${catRow}
    ${card(64, 600, '🍓', 'Strawberries', '$3.49')}
    ${card(576, 600, '🥐', 'Croissant', '$1.20')}
    ${card(64, 1160, '🥛', 'Oat Milk', '$2.80')}
    ${card(576, 1160, '🥑', 'Avocado', '$0.99')}
    ${card(64, 1720, '🧀', 'Cheddar', '$4.10')}
    ${card(576, 1720, '🍅', 'Tomatoes', '$2.30')}
    ${tabBar('home')}
  `);
}

// --- 3. product detail ---
function product() {
  return shell(`
    ${statusBar()}
    <rect x="0" y="0" width="${W}" height="1180" fill="${GREEN_SOFT}"/>
    <circle cx="84" cy="180" r="48" fill="#fff"/>
    <text x="84" y="198" fill="${INK}" font-family="${FONT}" font-size="52" text-anchor="middle">‹</text>
    <text x="540" y="780" font-size="420" text-anchor="middle">🍓</text>
    <rect x="0" y="1100" width="${W}" height="1300" rx="56" fill="#fff"/>
    <text x="64" y="1320" fill="${INK}" font-family="${FONT}" font-size="76" font-weight="800">Organic Strawberries</text>
    <text x="64" y="1400" fill="${SUB}" font-family="${FONT}" font-size="42">250g punnet · Spain</text>
    ${pill(64, 1470, 220, '★ 4.8', GREEN_SOFT, GREEN)}
    ${pill(304, 1470, 280, 'In stock', GREEN_SOFT, GREEN)}
    <text x="64" y="1700" fill="${SUB}" font-family="${FONT}" font-size="40">Hand-picked, sweet and juicy. Perfect for</text>
    <text x="64" y="1760" fill="${SUB}" font-family="${FONT}" font-size="40">breakfast bowls, smoothies and desserts.</text>
    <line x1="64" y1="1880" x2="1016" y2="1880" stroke="${LINE}" stroke-width="2"/>
    <text x="64" y="2160" fill="${SUB}" font-family="${FONT}" font-size="40">Total</text>
    <text x="64" y="2230" fill="${INK}" font-family="${FONT}" font-size="72" font-weight="800">$3.49</text>
    ${pill(560, 2120, 456, 'Add to basket', GREEN, '#fff')}
  `);
}

// --- 4. checkout / cart ---
function lineItem(y, emoji, name, qty, price) {
  return `<rect x="40" y="${y - 60}" width="${W - 80}" height="140" rx="32" fill="${CARD}" stroke="${LINE}" stroke-width="2"/>
    <rect x="72" y="${y - 28}" width="76" height="76" rx="20" fill="${GREEN_SOFT}"/>
    <text x="110" y="${y + 30}" font-size="52" text-anchor="middle">${emoji}</text>
    <text x="184" y="${y - 4}" fill="${INK}" font-family="${FONT}" font-size="40" font-weight="700">${name}</text>
    <text x="184" y="${y + 44}" fill="${SUB}" font-family="${FONT}" font-size="32">Qty ${qty}</text>
    <text x="${W - 72}" y="${y + 16}" fill="${INK}" font-family="${FONT}" font-size="42" font-weight="700" text-anchor="end">${price}</text>`;
}
function checkout() {
  return shell(`
    ${statusBar()}
    <text x="64" y="240" fill="${INK}" font-family="${FONT}" font-size="76" font-weight="800">Your basket</text>
    <text x="64" y="312" fill="${SUB}" font-family="${FONT}" font-size="40">3 items · arrives in ~9 min</text>
    ${lineItem(520, '🍓', 'Strawberries', 1, '$3.49')}
    ${lineItem(700, '🥛', 'Oat Milk', 2, '$5.60')}
    ${lineItem(880, '🥐', 'Croissant', 4, '$4.80')}
    <rect x="40" y="1080" width="${W - 80}" height="96" rx="24" fill="${GREEN_SOFT}"/>
    <text x="84" y="1142" fill="${GREEN}" font-family="${FONT}" font-size="36" font-weight="700">🎁  FRESH10 applied — 10% off</text>
    <line x1="64" y1="1320" x2="1016" y2="1320" stroke="${LINE}" stroke-width="2"/>
    <text x="64" y="1430" fill="${SUB}" font-family="${FONT}" font-size="40">Subtotal</text>
    <text x="${W - 64}" y="1430" fill="${INK}" font-family="${FONT}" font-size="40" text-anchor="end">$13.89</text>
    <text x="64" y="1510" fill="${SUB}" font-family="${FONT}" font-size="40">Delivery</text>
    <text x="${W - 64}" y="1510" fill="${GREEN}" font-family="${FONT}" font-size="40" text-anchor="end">Free</text>
    <text x="64" y="1620" fill="${INK}" font-family="${FONT}" font-size="56" font-weight="800">Total</text>
    <text x="${W - 64}" y="1620" fill="${INK}" font-family="${FONT}" font-size="56" font-weight="800" text-anchor="end">$12.50</text>
    ${pill(64, 2080, 952, 'Checkout in one tap', GREEN, '#fff')}
  `);
}

// --- 5. track delivery ---
function track() {
  return shell(`
    ${statusBar('#fff')}
    <rect width="${W}" height="1360" fill="#0E7A36"/>
    <rect width="${W}" height="1360" fill="url(#map)"/>
    <defs><linearGradient id="map" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#15803D"/><stop offset="1" stop-color="#166534"/>
    </linearGradient></defs>
    <path d="M 120 1200 Q 400 900 540 700 T 940 320" stroke="#fff" stroke-width="14" fill="none" stroke-dasharray="4 36" stroke-linecap="round" opacity="0.8"/>
    <circle cx="120" cy="1200" r="34" fill="#fff"/>
    <circle cx="940" cy="320" r="40" fill="${AMBER}" stroke="#fff" stroke-width="10"/>
    <circle cx="540" cy="700" r="56" fill="#fff"/>
    <text x="540" y="722" font-size="60" text-anchor="middle">🛵</text>
    <rect x="0" y="1300" width="${W}" height="1100" rx="56" fill="#fff"/>
    <rect x="470" y="1360" width="140" height="14" rx="7" fill="${LINE}"/>
    <text x="64" y="1560" fill="${INK}" font-family="${FONT}" font-size="80" font-weight="800">Arriving in 4 min</text>
    <text x="64" y="1640" fill="${SUB}" font-family="${FONT}" font-size="42">Maya is on the way with your order</text>
    <rect x="64" y="1740" width="952" height="20" rx="10" fill="${LINE}"/>
    <rect x="64" y="1740" width="680" height="20" rx="10" fill="${GREEN}"/>
    <circle cx="120" cy="2000" r="64" fill="${GREEN_SOFT}"/>
    <text x="120" y="2022" font-size="60" text-anchor="middle">🧑‍🦱</text>
    <text x="220" y="1980" fill="${INK}" font-family="${FONT}" font-size="44" font-weight="700">Maya R.</text>
    <text x="220" y="2040" fill="${SUB}" font-family="${FONT}" font-size="36">Your courier · ★ 4.9</text>
    ${pill(700, 1948, 316, 'Message', GREEN_SOFT, GREEN)}
    ${pill(64, 2180, 952, 'Track on map', GREEN, '#fff')}
  `);
}

// --- 6. rewards ---
function rewards() {
  return shell(`
    ${statusBar('#fff')}
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="64" y="260" fill="#fff" font-family="${FONT}" font-size="76" font-weight="800">Rewards</text>
    <rect x="64" y="360" width="952" height="520" rx="48" fill="url(#gold)"/>
    <defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F59E0B"/><stop offset="1" stop-color="#D97706"/>
    </linearGradient></defs>
    <text x="112" y="520" fill="#fff" font-family="${FONT}" font-size="44" opacity="0.9">Your points</text>
    <text x="112" y="660" fill="#fff" font-family="${FONT}" font-size="160" font-weight="800">2,480</text>
    <text x="112" y="780" fill="#fff" font-family="${FONT}" font-size="40" opacity="0.9">520 points to your next free delivery</text>
    <text x="64" y="1020" fill="#fff" font-family="${FONT}" font-size="52" font-weight="700">Earn on every order</text>
    ${rewardRow(1120, '🚚', 'Free delivery', '500 pts')}
    ${rewardRow(1320, '🍓', '$5 off fresh produce', '900 pts')}
    ${rewardRow(1520, '☕', 'Free barista coffee', '1,200 pts')}
    ${rewardRow(1720, '🎁', 'Mystery weekend box', '2,000 pts')}
    ${pill(64, 2120, 952, 'Redeem points', AMBER, '#fff')}
  `, INK);
}
function rewardRow(y, emoji, label, cost) {
  return `<rect x="64" y="${y}" width="952" height="150" rx="36" fill="#1E293B"/>
    <rect x="104" y="${y + 35}" width="80" height="80" rx="22" fill="#334155"/>
    <text x="144" y="${y + 95}" font-size="52" text-anchor="middle">${emoji}</text>
    <text x="220" y="${y + 95}" fill="#fff" font-family="${FONT}" font-size="42" font-weight="600">${label}</text>
    <text x="${W - 104}" y="${y + 95}" fill="${AMBER}" font-family="${FONT}" font-size="40" font-weight="700" text-anchor="end">${cost}</text>`;
}

function tabBar(active) {
  const items = [['Home', '🏠'], ['Search', '🔍'], ['Basket', '🛒'], ['You', '👤']];
  let out = `<rect x="0" y="${H - 180}" width="${W}" height="180" fill="#fff"/>
    <line x1="0" y1="${H - 180}" x2="${W}" y2="${H - 180}" stroke="${LINE}" stroke-width="2"/>`;
  items.forEach(([label, ico], i) => {
    const x = 135 + i * 270;
    const on = label.toLowerCase() === active;
    out += `<text x="${x}" y="${H - 95}" font-size="56" text-anchor="middle">${ico}</text>
      <text x="${x}" y="${H - 40}" fill="${on ? GREEN : SUB}" font-family="${FONT}" font-size="30" font-weight="${on ? 700 : 400}" text-anchor="middle">${label}</text>`;
  });
  return out;
}

const SCREENS = {
  onboarding: onboarding(),
  browse: browse(),
  product: product(),
  checkout: checkout(),
  track: track(),
  rewards: rewards(),
};

for (const locale of LOCALES) {
  const dir = path.join(HERE, 'inputs', locale, 'phone');
  await fs.mkdir(dir, { recursive: true });
  for (const [name, svg] of Object.entries(SCREENS)) {
    const out = path.join(dir, `${name}.png`);
    await sharp(Buffer.from(svg)).png().toFile(out);
    console.log('wrote', path.relative(HERE, out));
  }
}
console.log('done:', Object.keys(SCREENS).length, 'screens ×', LOCALES.length, 'locales');

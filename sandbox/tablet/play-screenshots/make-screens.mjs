// Generates placeholder landscape "Basket" tablet screens as 2560x1600 PNGs — the exact
// screen size of the AOSP `pixel-tablet` frame, so they drop in without cropping.
// Reproducible: `node sandbox/tablet/play-screenshots/make-screens.mjs` from the repo root.
// Writes the same screens into every locale's tablet7 AND tablet10 input dirs (the
// pixel-tablet frame is landscape-native and shared across both tablet form factors).
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const W = 2560;
const H = 1600;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = ['en-US', 'de-DE'];
const FORMATS = ['tablet7', 'tablet10'];

const INK = '#0F172A';
const SUB = '#64748B';
const LINE = '#E2E8F0';
const CARD = '#FFFFFF';
const GREEN = '#16A34A';
const GREEN_SOFT = '#DCFCE7';
const AMBER = '#F59E0B';
const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

function shell(inner, bg = '#F8FAFC') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${bg}"/>${inner}</svg>`;
}

function logo(x, y, fg = INK) {
  return `<circle cx="${x + 22}" cy="${y}" r="22" fill="${GREEN}"/>
    <path d="M ${x + 12} ${y + 2} q 10 15 20 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <text x="${x + 58}" y="${y + 14}" fill="${fg}" font-family="${FONT}" font-size="44" font-weight="800">Basket</text>`;
}

function pill(x, y, w, label, fill, fg) {
  return `<rect x="${x}" y="${y}" width="${w}" height="62" rx="31" fill="${fill}"/>
    <text x="${x + w / 2}" y="${y + 41}" fill="${fg}" font-family="${FONT}" font-size="28" font-weight="600" text-anchor="middle">${label}</text>`;
}

function prodCard(x, y, emoji, name, price) {
  return `<rect x="${x}" y="${y}" width="380" height="440" rx="36" fill="${CARD}" stroke="${LINE}" stroke-width="2"/>
    <rect x="${x + 36}" y="${y + 36}" width="308" height="240" rx="24" fill="${GREEN_SOFT}"/>
    <text x="${x + 190}" y="${y + 210}" font-size="130" text-anchor="middle">${emoji}</text>
    <text x="${x + 36}" y="${y + 340}" fill="${INK}" font-family="${FONT}" font-size="34" font-weight="700">${name}</text>
    <text x="${x + 36}" y="${y + 398}" fill="${GREEN}" font-family="${FONT}" font-size="36" font-weight="800">${price}</text>
    <circle cx="${x + 312}" cy="${y + 372}" r="32" fill="${GREEN}"/>
    <text x="${x + 312}" y="${y + 385}" fill="#fff" font-family="${FONT}" font-size="42" font-weight="700" text-anchor="middle">+</text>`;
}

// home: landscape catalog — left rail + product grid
function home() {
  const cats = ['Fruit', 'Bakery', 'Dairy', 'Drinks', 'Frozen'];
  let rail = '';
  cats.forEach((c, i) => {
    const y = 300 + i * 130;
    const active = i === 0;
    rail += `<rect x="64" y="${y}" width="420" height="100" rx="28" fill="${active ? GREEN : '#fff'}" stroke="${LINE}" stroke-width="${active ? 0 : 2}"/>
      <text x="110" y="${y + 64}" fill="${active ? '#fff' : SUB}" font-family="${FONT}" font-size="38" font-weight="600">${c}</text>`;
  });
  const items = [['🍓', 'Strawberries', '$3.49'], ['🥐', 'Croissant', '$1.20'], ['🥛', 'Oat Milk', '$2.80'],
    ['🥑', 'Avocado', '$0.99'], ['🧀', 'Cheddar', '$4.10'], ['🍅', 'Tomatoes', '$2.30'],
    ['🍌', 'Bananas', '$1.10'], ['☕', 'Coffee', '$5.40']];
  let grid = '';
  items.forEach((it, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    grid += prodCard(560 + col * 480, 360 + row * 520, it[0], it[1], it[2]);
  });
  return shell(`
    ${logo(64, 130, INK)}
    <rect x="1500" y="100" width="996" height="84" rx="42" fill="${CARD}" stroke="${LINE}" stroke-width="2"/>
    <text x="1548" y="153" fill="${SUB}" font-family="${FONT}" font-size="34">Search fresh groceries…</text>
    ${rail}${grid}`);
}

// product: left hero, right info panel
function product() {
  return shell(`
    ${logo(64, 110, INK)}
    <rect x="64" y="220" width="1180" height="1300" rx="48" fill="${GREEN_SOFT}"/>
    <text x="654" y="1000" font-size="640" text-anchor="middle">🍓</text>
    <text x="1320" y="380" fill="${INK}" font-family="${FONT}" font-size="96" font-weight="800">Organic Strawberries</text>
    <text x="1320" y="470" fill="${SUB}" font-family="${FONT}" font-size="44">250g punnet · Spain</text>
    ${pill(1320, 540, 220, '★ 4.8', GREEN_SOFT, GREEN)}
    ${pill(1560, 540, 280, 'In stock', GREEN_SOFT, GREEN)}
    <text x="1320" y="760" fill="${SUB}" font-family="${FONT}" font-size="42">Hand-picked, sweet and juicy — perfect for</text>
    <text x="1320" y="822" fill="${SUB}" font-family="${FONT}" font-size="42">breakfast bowls, smoothies and desserts.</text>
    <line x1="1320" y1="960" x2="2496" y2="960" stroke="${LINE}" stroke-width="2"/>
    <text x="1320" y="1140" fill="${SUB}" font-family="${FONT}" font-size="44">Total</text>
    <text x="1320" y="1230" fill="${INK}" font-family="${FONT}" font-size="84" font-weight="800">$3.49</text>
    ${pill(1980, 1150, 516, 'Add to basket', GREEN, '#fff')}`);
}

// track: left map, right courier panel
function track() {
  return shell(`
    <rect x="0" y="0" width="1500" height="${H}" fill="#0E7A36"/>
    <rect x="0" y="0" width="1500" height="${H}" fill="url(#map)"/>
    <defs><linearGradient id="map" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#15803D"/><stop offset="1" stop-color="#166534"/></linearGradient></defs>
    <path d="M 200 1300 Q 600 900 760 700 T 1240 300" stroke="#fff" stroke-width="14" fill="none" stroke-dasharray="4 38" stroke-linecap="round" opacity="0.8"/>
    <circle cx="200" cy="1300" r="34" fill="#fff"/>
    <circle cx="1240" cy="300" r="40" fill="${AMBER}" stroke="#fff" stroke-width="10"/>
    <circle cx="760" cy="700" r="58" fill="#fff"/>
    <text x="760" y="724" font-size="64" text-anchor="middle">🛵</text>
    <rect x="1500" y="0" width="1060" height="${H}" fill="#fff"/>
    <text x="1564" y="320" fill="${INK}" font-family="${FONT}" font-size="92" font-weight="800">Arriving in 4 min</text>
    <text x="1564" y="404" fill="${SUB}" font-family="${FONT}" font-size="44">Maya is on the way with your order</text>
    <rect x="1564" y="500" width="932" height="22" rx="11" fill="${LINE}"/>
    <rect x="1564" y="500" width="660" height="22" rx="11" fill="${GREEN}"/>
    <circle cx="1624" cy="780" r="64" fill="${GREEN_SOFT}"/>
    <text x="1624" y="802" font-size="60" text-anchor="middle">🧑‍🦱</text>
    <text x="1724" y="760" fill="${INK}" font-family="${FONT}" font-size="46" font-weight="700">Maya R.</text>
    <text x="1724" y="822" fill="${SUB}" font-family="${FONT}" font-size="36">Your courier · ★ 4.9</text>
    ${pill(1564, 1180, 932, 'Track on map', GREEN, '#fff')}`);
}

const SCREENS = { home: home(), product: product(), track: track() };

let count = 0;
for (const locale of LOCALES) {
  for (const format of FORMATS) {
    const dir = path.join(HERE, 'inputs', locale, format);
    await fs.mkdir(dir, { recursive: true });
    for (const [name, svg] of Object.entries(SCREENS)) {
      const out = path.join(dir, `${name}.png`);
      await sharp(Buffer.from(svg)).png().toFile(out);
      count++;
    }
  }
}
console.log('done:', count, 'files (', Object.keys(SCREENS).length, 'screens ×', LOCALES.length, 'locales ×', FORMATS.length, 'tablet formats )');

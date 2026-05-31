import { defineConfig } from 'screenshot-composer';

// Tablet showcase for screenshot-composer (new in v0.2.0: tablet form factors).
// Same fictional "Basket" grocery app and listing theme as the phone showcase, but
// rendered on the landscape-native `pixel-tablet` frame at BOTH tablet form factors:
//   • tablet7  → 1920×1200
//   • tablet10 → 3840×2160 (2× device scale)
// Regenerate the placeholder landscape inputs with
// `node sandbox/tablet/play-screenshots/make-screens.mjs`.
export default defineConfig({
  locales: ['en-US', 'de-DE'],
  defaultLocale: 'en-US',

  // Render every slot for both tablet sizes. Each form factor reads its own input dir
  // (inputs/{locale}/tablet7/… and …/tablet10/…) — here both get the same 2560×1600 art.
  formFactors: ['tablet7', 'tablet10'],

  theme: {
    fontFamily: 'system-ui',
    palette: { fg: '#FFFFFF', accent: '#34D399', muted: '#A7F3D0' },
    background: { type: 'gradient', direction: 135, stops: ['#064E3B', '#10B981'] },
  },

  slots: [
    // 1 — showcase · gentle tilt. The `orientation` map sets the OUTPUT canvas per form
    //     factor. Tablets already default to landscape (the pixel-tablet frame is
    //     landscape-native), so this is shown explicitly just to document the syntax —
    //     you could set e.g. `{ tablet10: 'portrait' }` to export a portrait canvas.
    {
      id: '01-catalog',
      template: 'showcase',
      screenshot: 'home.png',
      frame: { id: 'pixel-tablet' },
      layout: { tilt: { x: 2, y: -8, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2600 },
      orientation: { tablet7: 'landscape', tablet10: 'landscape' },
      copy: {
        eyebrow: { 'en-US': 'NOW ON TABLET', 'de-DE': 'JETZT AUF DEM TABLET' },
        headline: { 'en-US': 'The whole store, on the big screen', 'de-DE': 'Der ganze Laden auf dem großen Bildschirm' },
        subhead: { 'en-US': 'Browse thousands of items in a roomy grid.', 'de-DE': 'Durchstöbere Tausende Produkte im großzügigen Raster.' },
      },
    },

    // 2 — overlap · subtle Z-roll
    {
      id: '02-product',
      template: 'overlap',
      screenshot: 'product.png',
      frame: { id: 'pixel-tablet' },
      layout: { tilt: { x: 0, y: 0, z: -5 }, translate: { x: 0, y: -10 }, perspective: 2200 },
      copy: {
        headline: { 'en-US': 'Every detail, side by side', 'de-DE': 'Jedes Detail, nebeneinander' },
        subhead: { 'en-US': 'Photo, ratings and stock without scrolling.', 'de-DE': 'Foto, Bewertungen und Bestand ohne Scrollen.' },
      },
    },

    // 3 — bold-headline · slight back-lean
    {
      id: '03-track',
      template: 'bold-headline',
      screenshot: 'track.png',
      frame: { id: 'pixel-tablet' },
      layout: { tilt: { x: 8, y: -4, z: 0 }, translate: { x: 0, y: 20 }, perspective: 2400 },
      copy: {
        headline: { 'en-US': 'Track delivery in real time', 'de-DE': 'Lieferung in Echtzeit verfolgen' },
      },
    },

    // 4 — showcase · flat, no tilt
    {
      id: '04-catalog-flat',
      template: 'showcase',
      screenshot: 'home.png',
      frame: { id: 'pixel-tablet' },
      layout: { tilt: { x: 0, y: 0, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2600 },
      copy: {
        eyebrow: { 'en-US': 'FRESH DAILY', 'de-DE': 'TÄGLICH FRISCH' },
        headline: { 'en-US': 'Thousands of items, one tap away', 'de-DE': 'Tausende Produkte, nur ein Tipp entfernt' },
        subhead: { 'en-US': 'From farm-fresh produce to midnight snacks.', 'de-DE': 'Von erntefrischem Obst bis zum Mitternachtssnack.' },
      },
    },
  ],
});

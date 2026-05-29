import { defineConfig } from 'screenshot-composer';

// Showcase config for screenshot-composer.
// Fictional app "Basket" (10-minute grocery delivery). One cohesive listing theme;
// eight slots exercise all three templates, seven device frames, every tilt style,
// and two locales (en-US + de-DE). Regenerate the placeholder inputs with
// `node sandbox/play-screenshots/make-screens.mjs`.
export default defineConfig({
  locales: ['en-US', 'de-DE'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],

  // Config-level theme: a fresh-green gradient with a mint accent so white frames pop.
  theme: {
    fontFamily: 'system-ui',
    palette: { fg: '#FFFFFF', accent: '#34D399', muted: '#A7F3D0' },
    background: { type: 'gradient', direction: 135, stops: ['#064E3B', '#10B981'] },
  },

  slots: [
    // 1 — bold-headline · strong left Y-rotation
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9-pro' },
      layout: { tilt: { x: 4, y: -22, z: 0 }, translate: { x: 0, y: 30 }, perspective: 2000 },
      copy: {
        headline: { 'en-US': 'Groceries in 10 minutes', 'de-DE': 'Lebensmittel in 10 Minuten' },
      },
    },

    // 2 — showcase · gentle right Y-tilt
    {
      id: '02-browse',
      template: 'showcase',
      screenshot: 'browse.png',
      frame: { id: 'pixel-8' },
      layout: { tilt: { x: 2, y: 12, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 },
      copy: {
        eyebrow: { 'en-US': 'FRESH DAILY', 'de-DE': 'TÄGLICH FRISCH' },
        headline: { 'en-US': 'Thousands of items, one tap away', 'de-DE': 'Tausende Produkte, nur ein Tipp entfernt' },
        subhead: { 'en-US': 'From farm-fresh produce to midnight snacks.', 'de-DE': 'Von erntefrischem Obst bis zum Mitternachtssnack.' },
      },
    },

    // 3 — overlap · Z-roll + float
    {
      id: '03-product',
      template: 'overlap',
      screenshot: 'product.png',
      frame: { id: 'pixel-10-pro' },
      layout: { tilt: { x: 0, y: 0, z: -8 }, translate: { x: 0, y: -20 }, perspective: 1600 },
      copy: {
        headline: { 'en-US': 'Know what you get', 'de-DE': 'Wisse, was du bekommst' },
        subhead: { 'en-US': 'Ratings, origin and stock on every item.', 'de-DE': 'Bewertungen, Herkunft und Bestand bei jedem Produkt.' },
      },
    },

    // 4 — bold-headline · flat, no tilt
    {
      id: '04-checkout',
      template: 'bold-headline',
      screenshot: 'checkout.png',
      frame: { id: 'pixel-7a' },
      layout: { tilt: { x: 0, y: 0, z: 0 }, translate: { x: 0, y: 0 }, perspective: 2000 },
      copy: {
        headline: { 'en-US': 'Checkout in one tap', 'de-DE': 'Bezahlen mit einem Tipp' },
      },
    },

    // 5 — showcase · X-tilt (leaning back)
    {
      id: '05-track',
      template: 'showcase',
      screenshot: 'track.png',
      frame: { id: 'pixel-9' },
      layout: { tilt: { x: 16, y: -6, z: 0 }, translate: { x: 0, y: 0 }, perspective: 1800 },
      copy: {
        eyebrow: { 'en-US': 'LIVE TRACKING', 'de-DE': 'LIVE-VERFOLGUNG' },
        headline: { 'en-US': 'Track every minute', 'de-DE': 'Verfolge jede Minute' },
        subhead: { 'en-US': 'Watch your courier arrive in real time.', 'de-DE': 'Sieh deinem Kurier in Echtzeit zu.' },
      },
    },

    // 6 — overlap · opposite Y-rotation
    {
      id: '06-rewards',
      template: 'overlap',
      screenshot: 'rewards.png',
      frame: { id: 'pixel-6-pro' },
      layout: { tilt: { x: 2, y: 20, z: 0 }, translate: { x: 0, y: -10 }, perspective: 1800 },
      copy: {
        headline: { 'en-US': 'Earn on every order', 'de-DE': 'Bei jeder Bestellung sammeln' },
        subhead: { 'en-US': 'Points add up to free deliveries and treats.', 'de-DE': 'Punkte werden zu Gratis-Lieferungen und Extras.' },
      },
    },

    // 7 — bold-headline · dramatic low perspective
    {
      id: '07-aisle',
      template: 'bold-headline',
      screenshot: 'browse.png',
      frame: { id: 'pixel-10-pro-xl' },
      layout: { tilt: { x: -12, y: -16, z: 0 }, translate: { x: 0, y: 60 }, perspective: 1200 },
      copy: {
        headline: { 'en-US': 'Shop the whole aisle', 'de-DE': 'Kauf den ganzen Gang' },
      },
    },

    // 8 — showcase · subtle combined X+Y+Z
    {
      id: '08-quality',
      template: 'showcase',
      screenshot: 'product.png',
      frame: { id: 'pixel-8a' },
      layout: { tilt: { x: 6, y: 8, z: -3 }, translate: { x: 0, y: 0 }, perspective: 2000 },
      copy: {
        eyebrow: { 'en-US': 'QUALITY FIRST', 'de-DE': 'QUALITÄT ZUERST' },
        headline: { 'en-US': 'Picked fresh, just for you', 'de-DE': 'Frisch gepflückt, nur für dich' },
        subhead: { 'en-US': 'Hand-checked before it reaches your door.', 'de-DE': 'Handgeprüft, bevor es deine Tür erreicht.' },
      },
    },
  ],
});

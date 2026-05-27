import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', stops: ['#000', '#111'] },
  },
  // Intentionally invalid at runtime (not at type level): tilt.y is out of the
  // [-45, 45] range enforced by Zod. Caught by ConfigSchema.safeParse, not tsc.
  slots: [
    {
      id: '01',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9' },
      layout: { tilt: { x: 0, y: -75, z: 0 } },
      copy: { headline: { 'en-US': 'x' } },
    },
  ],
});

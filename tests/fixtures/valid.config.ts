import { defineConfig } from 'screenshot-composer';

export default defineConfig({
  locales: ['en-US'],
  defaultLocale: 'en-US',
  formFactors: ['phone'],
  theme: {
    palette: { fg: '#0F172A', accent: '#6366F1', muted: '#94A3B8' },
    background: { type: 'gradient', direction: 135, stops: ['#6366F1', '#8B5CF6'] },
  },
  slots: [
    {
      id: '01-onboarding',
      template: 'bold-headline',
      screenshot: 'onboarding.png',
      frame: { id: 'pixel-9', color: 'obsidian' },
      copy: { headline: { 'en-US': 'Order in seconds' } },
    },
  ],
});

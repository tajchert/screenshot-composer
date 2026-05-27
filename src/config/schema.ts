import { z } from 'zod';

export const FormFactor = z.enum(['phone', 'tablet7', 'tablet10']);
export type FormFactorT = z.infer<typeof FormFactor>;

const TiltSchema = z.object({
  x: z.number().min(-45).max(45),
  y: z.number().min(-45).max(45),
  z: z.number().min(-45).max(45),
});

const LayoutSchema = z.object({
  tilt: TiltSchema.default({ x: 0, y: 0, z: 0 }),
  translate: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  perspective: z.number().positive().default(2000),
});

const FrameRefSchema = z.object({
  id: z.string(),
  color: z.string().optional(),
});

// Permissive CSS color: hex, rgb(a)/hsl(a) functions, or a bare keyword.
const CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)$/;
const cssColor = z.string().regex(CSS_COLOR, 'must be a valid CSS color');

const SolidBackground = z.object({
  type: z.literal('solid'),
  color: cssColor,
});

const GradientBackground = z.object({
  type: z.literal('gradient'),
  direction: z.number().default(135),
  stops: z.array(cssColor).min(2, 'a gradient needs at least 2 color stops'),
});

const BackgroundSchema = z.discriminatedUnion('type', [SolidBackground, GradientBackground]);

const ThemeSchema = z.object({
  fontFamily: z.string().default('system-ui'),
  palette: z.object({ fg: cssColor, accent: cssColor, muted: cssColor }),
  background: BackgroundSchema,
});

const SlotSchema = z.object({
  id: z.string(),
  template: z.string(),
  screenshot: z.string(),
  frame: FrameRefSchema,
  layout: LayoutSchema.default({}),
  copy: z.record(z.string(), z.record(z.string(), z.string())),
});

const PathsSchema = z
  .object({
    inputs: z.string().default('./inputs'),
    outputs: z.string().default('./outputs'),
    templates: z.string().default('./templates'),
    assets: z.string().default('./assets'),
  })
  .default({});

export const ConfigSchema = z
  .object({
    locales: z.array(z.string()).min(1),
    defaultLocale: z.string(),
    formFactors: z.array(FormFactor).min(1),
    paths: PathsSchema,
    theme: ThemeSchema,
    slots: z.array(SlotSchema).min(1).max(8),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.locales.length === 0) return;
    if (!cfg.locales.includes(cfg.defaultLocale)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultLocale'],
        message: `'${cfg.defaultLocale}' is not one of locales [${cfg.locales.join(', ')}]`,
      });
    }
  });

export type Config = z.infer<typeof ConfigSchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type Theme = z.infer<typeof ThemeSchema>;

/** Identity helper that gives IDE autocomplete + type-checking in user config files. */
export function defineConfig(config: z.input<typeof ConfigSchema>): z.input<typeof ConfigSchema> {
  return config;
}

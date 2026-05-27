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

const BackgroundSchema = z.object({
  type: z.enum(['solid', 'gradient']),
  color: z.string().optional(),
  direction: z.number().default(135),
  stops: z.array(z.string()).optional(),
});

const ThemeSchema = z.object({
  fontFamily: z.string().default('system-ui'),
  palette: z.object({ fg: z.string(), accent: z.string(), muted: z.string() }),
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

export const ConfigSchema = z.object({
  locales: z.array(z.string()).min(1),
  defaultLocale: z.string(),
  formFactors: z.array(FormFactor).min(1),
  paths: PathsSchema,
  theme: ThemeSchema,
  slots: z.array(SlotSchema).min(1).max(8),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type Theme = z.infer<typeof ThemeSchema>;

/** Identity helper that gives IDE autocomplete + type-checking in user config files. */
export function defineConfig(config: z.input<typeof ConfigSchema>): z.input<typeof ConfigSchema> {
  return config;
}

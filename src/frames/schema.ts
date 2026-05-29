import { z } from 'zod';

const intrinsicSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const screenSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  radius: z.number().nonnegative(),
});

const shadowSchema = z.object({
  x: z.number(),
  y: z.number(),
  blur: z.number().nonnegative(),
  color: z.string().min(1),
});

export const FrameManifestSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    manufacturer: z.string().min(1),
    intrinsic: intrinsicSchema,
    screen: screenSchema,
    shadow: shadowSchema.optional(),
    image: z.string().min(1),
    mask: z.string().min(1).optional(),
    // Optional provenance; the import tool always sets license (Apache-2.0).
    source: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.screen.x + m.screen.width > m.intrinsic.width) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['screen'],
        message: `screen rect exceeds intrinsic width (${m.screen.x}+${m.screen.width} > ${m.intrinsic.width})`,
      });
    }
    if (m.screen.y + m.screen.height > m.intrinsic.height) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['screen'],
        message: `screen rect exceeds intrinsic height (${m.screen.y}+${m.screen.height} > ${m.intrinsic.height})`,
      });
    }
  });

export type FrameManifest = z.infer<typeof FrameManifestSchema>;

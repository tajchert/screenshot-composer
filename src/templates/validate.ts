import type { Config } from '../config/schema.js';
import type { ProjectPaths } from '../paths.js';
import { resolveTemplate } from './resolve.js';
import { ConfigValidationError } from '../errors.js';

/** Resolve each slot's template (throws on unknown id) and assert that every
 *  required copy field has a non-empty value for the default locale. */
export async function validateSlotTemplates(config: Config, paths: ProjectPaths): Promise<void> {
  for (const slot of config.slots) {
    const template = await resolveTemplate(slot.template, paths);
    for (const field of template.meta.copyFields) {
      if (!field.required) continue;
      const value = slot.copy[field.key]?.[config.defaultLocale];
      if (!value || value.trim() === '') {
        throw new ConfigValidationError(
          paths.config,
          `Slot '${slot.id}' (template '${slot.template}') is missing required copy '${field.key}' for default locale '${config.defaultLocale}'.`,
        );
      }
    }
  }
}

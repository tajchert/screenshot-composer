import { describe, it, expect } from 'vitest';
import {
  ConfigValidationError, MissingInputError, RenderError, ConstraintError, exitCodeFor,
} from '../src/errors.js';

describe('errors', () => {
  it('maps each error type to its documented exit code', () => {
    expect(exitCodeFor(new ConfigValidationError('cfg.ts', 'bad'))).toBe(1);
    expect(exitCodeFor(new MissingInputError('a.png'))).toBe(2);
    expect(exitCodeFor(new RenderError('boom'))).toBe(3);
    expect(exitCodeFor(new ConstraintError('too big'))).toBe(4);
  });

  it('maps unknown errors to exit code 3', () => {
    expect(exitCodeFor(new Error('???'))).toBe(3);
  });

  it('includes the file path in a config error message', () => {
    const e = new MissingInputError('inputs/en-US/phone/onboarding.png');
    expect(e.message).toContain('onboarding.png');
  });
});

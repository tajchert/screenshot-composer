export class ConfigValidationError extends Error {
  constructor(public file: string, message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export class MissingInputError extends Error {
  constructor(public file: string) {
    super(`Missing input screenshot: ${file}`);
    this.name = 'MissingInputError';
  }
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
  }
}

export class ConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConstraintError';
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof ConfigValidationError) return 1;
  if (err instanceof MissingInputError) return 2;
  if (err instanceof ConstraintError) return 4;
  if (err instanceof RenderError) return 3;
  return 3;
}

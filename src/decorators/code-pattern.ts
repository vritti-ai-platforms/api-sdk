// Canonical entity "code" format — the single source of truth for DTOs, DB checks, and frontend forms.
// A code is a single lowercase word: starts with a letter, then lowercase letters, digits, or hyphens.
// The dotted variant allows dot-separated segments (e.g. permission codes like "add.salt").

const SEGMENT = '[a-z][a-z0-9-]*';

export const CODE_PATTERN_SOURCE = `^${SEGMENT}$`;
export const DOTTED_CODE_PATTERN_SOURCE = `^${SEGMENT}(\\.${SEGMENT})*$`;

export const CODE_PATTERN = new RegExp(CODE_PATTERN_SOURCE);
export const DOTTED_CODE_PATTERN = new RegExp(DOTTED_CODE_PATTERN_SOURCE);

export interface CodeOptions {
  dotted?: boolean;
}

// Returns the regex for the requested code variant
export function codePattern(options?: CodeOptions): RegExp {
  return options?.dotted ? DOTTED_CODE_PATTERN : CODE_PATTERN;
}

// Returns the Postgres regex source string for the requested code variant (for CHECK constraints)
export function codePatternSource(options?: CodeOptions): string {
  return options?.dotted ? DOTTED_CODE_PATTERN_SOURCE : CODE_PATTERN_SOURCE;
}

// Human-readable validation message for the requested code variant
export function codeMessage(property: string, options?: CodeOptions): string {
  return options?.dotted
    ? `${property} must be dot-separated lowercase words (e.g. add.salt).`
    : `${property} must be a single lowercase word, hyphens allowed (e.g. inventory-items).`;
}

// How many conditions one saved context or patch may carry, and how many values one list condition may hold — well
// under what a query can bind
export const MAX_CONDITIONS = 50;
export const MAX_CONDITION_VALUES = 500;

// A saved state's slug: lowercase letters, digits and hyphens
export const STATE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
export const STATE_SLUG_MESSAGE = 'slug must be lowercase letters, digits and hyphens';

import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { type CurrencyCode, majorToMinor, SUPPORTED_CURRENCIES } from '../money';

// Self-contained validator for `{currency, value}` payloads. Intentionally does NOT compose
// `@ValidateNested()` + `@Type(() => CurrencyAmountDto)` — api-sdk and the consuming app each
// load their own copy of `class-validator` (different MetadataStorage singletons), so any
// field-level decorators registered on `CurrencyAmountDto` from inside api-sdk are invisible
// to the consumer's validator. Doing everything here, at the consumer's call site, sidesteps
// that and keeps the decorator usable everywhere.
//
// Checks performed (in order, short-circuiting):
//   1. Value is a non-null object.
//   2. `currency` and `value` are both strings.
//   3. `currency` is in `SUPPORTED_CURRENCIES`.
//   4. `majorToMinor(value, currency)` succeeds — enforces decimal precision ≤ currency exponent.
export function IsCurrency(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isCurrency',
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!value || typeof value !== 'object') return false;
          const { currency, value: amount } = value as Record<string, unknown>;
          if (typeof currency !== 'string' || typeof amount !== 'string') return false;
          if (!(currency in SUPPORTED_CURRENCIES)) return false;
          try {
            majorToMinor(amount, currency as CurrencyCode);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be {currency, value} where currency is a valid ISO 4217 code and value precision matches the currency exponent.`;
        },
      },
    });
  };
}

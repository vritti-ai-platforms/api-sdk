import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { type CurrencyCode, majorToMinor, SUPPORTED_CURRENCIES } from '../money';

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

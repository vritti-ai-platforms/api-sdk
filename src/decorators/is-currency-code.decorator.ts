import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../money';

export function IsCurrencyCode(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isCurrencyCode',
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          return value in SUPPORTED_CURRENCIES;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid ISO 4217 currency code.`;
        },
      },
    });
  };
}

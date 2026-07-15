import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { ISO_COUNTRY_CODES } from './iso-countries';

export function IsCountry(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isCountry',
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          return ISO_COUNTRY_CODES.has(value.toUpperCase());
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid ISO 3166-1 alpha-2 country code.`;
        },
      },
    });
  };
}

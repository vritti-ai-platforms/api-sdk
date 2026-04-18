import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

const ZONED_ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function IsZonedIsoDateString(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isZonedIsoDateString',
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (!ZONED_ISO_DATE_REGEX.test(value)) return false;
          return !Number.isNaN(Date.parse(value));
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be an ISO date-time string with timezone (Z or ±HH:mm).`;
        },
      },
    });
  };
}

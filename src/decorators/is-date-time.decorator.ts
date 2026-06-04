import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

const UTC_ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function IsDateTime(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isDateTime',
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (!UTC_ISO_DATETIME_REGEX.test(value)) return false;
          return !Number.isNaN(Date.parse(value));
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a UTC ISO date-time string ending with Z.`;
        },
      },
    });
  };
}

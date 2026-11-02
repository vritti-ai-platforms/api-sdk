import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

// The array must contain the value of a sibling field, e.g. a default that has to be one of the options
export function ArrayIncludesField(field: string, options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'arrayIncludesField',
      target: object.constructor,
      propertyName: String(propertyName),
      constraints: [field],
      options: { message: `${String(propertyName)} must include ${field}`, ...options },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const sibling = (args.object as Record<string, unknown>)[args.constraints[0]];
          return Array.isArray(value) && value.includes(sibling);
        },
      },
    });
  };
}

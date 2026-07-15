import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { type CodeOptions, codeMessage, codePattern } from './code-pattern';

// Validates a canonical lowercase-kebab code. Pass { dotted: true } for dot-separated codes (permissions).
export function IsCode(options?: CodeOptions, validationOptions?: ValidationOptions): PropertyDecorator {
  const pattern = codePattern(options);
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isCode',
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && pattern.test(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return codeMessage(args.property, options);
        },
      },
    });
  };
}

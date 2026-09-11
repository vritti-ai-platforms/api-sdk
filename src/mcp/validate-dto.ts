import { type ClassConstructor, plainToInstance } from 'class-transformer';
import { type ValidationError, validate } from 'class-validator';
import { BadRequestException } from '../exceptions';

interface FieldError {
  field: string;
  message: string;
}

export class McpValidationError extends BadRequestException {
  constructor(errors: FieldError[]) {
    super({ label: 'Validation Failed', detail: 'Please check your input and try again.', errors });
  }
}

// Nested paths ("entries.0.amount") where the global pipe only reports the top-level property — an agent needs the path
function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    const nested = error.children?.length ? flattenValidationErrors(error.children, field) : [];
    return [...own, ...nested];
  });
}

// Validates tool input against the same class-validator DTO the REST endpoint uses, with the global pipe's options
export async function validateDto<T extends object>(cls: ClassConstructor<T>, input: unknown): Promise<T> {
  const instance = plainToInstance(cls, input ?? {}, { enableImplicitConversion: true });
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) throw new McpValidationError(flattenValidationErrors(errors));
  return instance;
}

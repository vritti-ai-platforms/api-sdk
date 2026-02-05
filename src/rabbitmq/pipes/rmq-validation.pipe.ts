/**
 * RabbitMQ Validation Pipe
 *
 * Validates incoming message payloads against DTO class decorators.
 * @module rabbitmq/rmq-validation.pipe
 */

import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { type ValidationError, validate } from 'class-validator';

// ============================================================================
// RabbitMQ Validation Pipe
// ============================================================================

/**
 * Validation pipe for RabbitMQ message payloads.
 *
 * Validates incoming data against DTO class decorators from `class-validator`.
 * Throws `RpcException` with detailed error messages on validation failure.
 *
 * @example
 * ```typescript
 * // DTO with validation decorators
 * class CreateCustomerDto {
 *   @IsString()
 *   @IsNotEmpty()
 *   tenantId: string;
 *
 *   @IsString()
 *   @IsNotEmpty()
 *   name: string;
 *
 *   @IsEmail()
 *   email: string;
 * }
 *
 * // Use in handler
 * @MessagePattern({ role: 'customers', cmd: 'create' })
 * async create(@Payload(RmqValidationPipe) data: CreateCustomerDto) {
 *   return this.service.create(data);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Apply globally in main.ts
 * async function bootstrap() {
 *   const app = await NestFactory.createMicroservice(AppModule, { ... });
 *   app.useGlobalPipes(new RmqValidationPipe());
 *   await app.listen();
 * }
 * ```
 */
@Injectable()
export class RmqValidationPipe implements PipeTransform {
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    // Skip if no metatype or if it's a primitive type
    if (!metadata.metatype || !this.shouldValidate(metadata.metatype)) {
      return value;
    }

    // Transform plain object to class instance
    const object = plainToInstance(metadata.metatype, value);

    // Validate the instance
    const errors = await validate(object as object);

    if (errors.length > 0) {
      const messages = this.formatErrors(errors);

      throw new RpcException({
        statusCode: 400,
        message: 'Validation failed',
        errors: messages,
      });
    }

    return object;
  }

  /**
   * Check if the metatype should be validated.
   * Skip primitive types that don't need validation.
   */
  private shouldValidate(metatype: unknown): boolean {
    const types: unknown[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Format validation errors into readable messages.
   */
  private formatErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => {
      if (error.constraints) {
        return Object.values(error.constraints);
      }
      if (error.children && error.children.length > 0) {
        return this.formatErrors(error.children);
      }
      return [];
    });
  }
}
